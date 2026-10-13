---
name: factory
description: Run the software factory. Use when the user types /factory (init, a feature, next, approve, rework, resume) to take features through spec → build → 4 parallel reviews → approval → merge queue, each job in its own git worktree.
argument-hint: "init | <feature> | next [N] | approve <job-id> | rework <job-id> <note> | resume [job-id]"
---

# /factory: you are the orchestrator

Arguments: `$ARGUMENTS`

The session running this skill orchestrates the jobs it starts, or is handed
with `resume`. It spawns every agent and is the **only writer** of those jobs'
`job.json`. You never write code, specs, reviews or approvals yourself. Agents
do the work, each writes one file, and you move each job along.

You can run several jobs in this session (`/factory next 3`), and other
sessions can run jobs in the same repo at the same time. That's safe because
every job has its own state file, its own worktree and its own ports. Shared
things (job ids, the backlog, the merge) are claimed atomically.

```
MAX_PARALLEL = 3      # active jobs across ALL sessions (spec … merging)
MAX_RESUMES  = 2      # builder resumes after CHANGES → at most 3 review rounds
REVIEWERS    = security, ux, ui, code
STATE        = python3 ${CLAUDE_PLUGIN_ROOT}/scripts/factory_state.py
```

## The loop (edit this to change the factory)

```
feature → [worktree] → spec-writer → builder ◄──────────────────┐
                                        │ STATUS: READY          │
            ┌──────────┬──────────┬─────┴────┐                   │
         security      ux        ui        code                  │
            └──────────┴────┬─────┴──────────┘                   │
                      WAIT FOR ALL 4 ── any CHANGES ─────────────┘ (max 2 resumes)
                            │ all PASS
                         approver ── ESCALATE / BLOCKED / rounds exhausted ──► needs-human
                            │ APPROVE                                             │
                       merge queue ◄─────────── /factory approve ─────────────────┘
                            │ one at a time (lock)
                  merged into the integration branch (local, never pushed)
```

| Step | Agent (`subagent_type`) | Writes |
| --- | --- | --- |
| spec | `software-factory:spec-writer` | `spec.md` |
| build | `software-factory:builder` | `build.md` + commits on `factory/<id>` |
| review | `software-factory:review-security`, `-ux`, `-ui`, `-code` | `round-<N>/review-<name>.md` |
| approve | `software-factory:approver` | `decision.md` |

## Files and names

- `REPO`: the main checkout, from `git rev-parse --show-toplevel`. `NAME` is
  its folder name.
- `project.md`: `REPO/factory/project.md`. Read it at the start of every
  command. It names:
  - `INTEGRATION` (the branch jobs merge into) and `PRODUCTION`
  - the **Setup** command for a fresh checkout
  - the **Verify** commands
  - the **Dev server** command and the **Browser check** setting
  - the **Guardrails**

  Agents also read the repo's own `AGENTS.md` / `CLAUDE.md` when present.
- Job id: `NNN-slug`, e.g. `004-reading-time`.
- `JOB_DIR = REPO/factory/jobs/<id>/`. This is gitignored runtime state, and it
  always lives in the main checkout, never in a worktree.
- `WORKTREE = $(dirname REPO)/NAME-factory/<id>`, outside the repo so the
  project's tools never scan it. Always use the absolute path.
- `BRANCH = factory/<id>`.
- Ports: with `n` the job number (`004` → 4), the builder gets `5100+10n`,
  review-ux gets `5101+10n` and review-ui gets `5102+10n`. They're only used
  when Browser check isn't `none`.
- Templates live in `${CLAUDE_PLUGIN_ROOT}/templates/`. If that variable isn't
  expanded, find them with
  `find ~/.claude/plugins -path '*software-factory*/templates/dashboard.html'`.

### job.json

```json
{ "id": "004-reading-time", "title": "Reading time on posts",
  "feature": "<the request, verbatim>",
  "branch": "factory/004-reading-time",
  "worktree": "/abs/path/my-app-factory/004-reading-time",
  "stage": "review", "round": 2, "resumes": 1, "port": 5140,
  "builderAgent": "builder-004-reading-time",
  "approvedAt": null, "updated": "<ISO time>", "note": "",
  "history": [ { "security": "CHANGES", "ux": "PASS", "ui": "n/a", "code": "PASS" } ],
  "reviews": { "security": "pending", "ux": "PASS", "ui": "n/a", "code": "PASS" } }
```

- Stages: `queued`, `spec`, `build`, `review`, `approval`, `merging`, `merged`,
  `needs-human`. The active stages are spec through merging. Worktree setup counts as spec.
- `reviews` holds the current round: `pending`, `PASS`, `n/a` or `CHANGES`.
  `history` holds finished rounds, oldest first.
- `note` is one short line for the board: why it's waiting, what failed.
- **Write it atomically on every change:** Write `job.json.tmp`, then
  `mv job.json.tmp job.json`. Set `updated` each time. The dashboard and status
  line watch these files.

### Agent prompts

Every agent prompt starts with:
`Job folder: <JOB_DIR>. Worktree: <WORKTREE>. Branch: <BRANCH>. Integration: <INTEGRATION>.`
Then add the step-specific part: `Feature: …`, `Build round N.`, `Review round N.`
or `Final round: N.`. The builder, review-ux and review-ui also get
` Port: <port>.` when Browser check is on. Spawn the four reviewers in **one
message**, so they run in parallel.

## Running a job

Subagents run in the background, and you're told when each one finishes.
Advance each of your jobs on its own: never block one job on another, and never
poll an agent. To wait for something outside this session (a free slot, the
merge lock), run a background Bash loop such as `until <check>; do sleep 15; done`.
You'll be notified when it exits.

1. **Claim.** Pick an id: `NNN=$($STATE next-id REPO)`, plus a 2–4 word
   kebab-case slug. Claim it with `mkdir REPO/factory/jobs/<id>` (no `-p`). If
   that fails, another session took the number: pick the next one and retry.
   Write job.json with stage `queued`, round 0, resumes 0, and all four reviews pending.
2. **Slot.** Start only when `$STATE active REPO` is below `MAX_PARALLEL`.
   Otherwise stay queued, and wait in the background for a slot to free.
3. **Worktree** (stage spec). Run:
   `git -C REPO worktree add -b BRANCH WORKTREE INTEGRATION`. Then run
   project.md's **Setup** command in it: `cd WORKTREE && <setup>`. Symlink a
   dependencies folder instead only if project.md explicitly opts in. If setup
   fails, go to **Needs human**.
4. **Spec.** Spawn `spec-writer` with the paths and `Feature: <verbatim>`. When
   it finishes, check that `spec.md` exists.
5. **Build** (stage build). Spawn `builder` **named `builder-<id>`** (also its
   description), with `Build round 1.`. Record `builderAgent`. When it finishes,
   do the **build check**: read the first line of `build.md`.
   `STATUS: READY` → review. `STATUS: BLOCKED` → **Needs human**, with the
   `## Blocked` reason as the note.
6. **Review round N** (stage review). Set `round: N` and all reviews to pending,
   then create `JOB_DIR/round-<N>/`. Spawn all four reviewers. As each finishes,
   read the first line of its file and record the verdict right away
   (`VERDICT: PASS (n/a)` is recorded as `n/a`). If a reviewer finishes without
   writing a valid first line, stop and tell the user.
7. **WAIT FOR ALL.** The round is done only when all four `review-*.md` files
   exist in `round-<N>/`. Never resume the builder mid-round. When it's done,
   append `reviews` to `history`, then:
   - **All PASS or n/a:** go to **Approve**.
   - **Any CHANGES and `resumes < MAX_RESUMES`:** increment `resumes` and set
     stage build. Resume the builder (see "Resuming the builder") with:
     `Round N reviews are in <JOB_DIR>/round-<N>/. Address every VERDICT: CHANGES finding, commit, and update build.md for round N+1.`
     Then do the build check and go to round N+1.
   - **Any CHANGES and no resumes left:** write `decision.md` yourself:
     `ESCALATE`, a blank line, then
     `Review rounds exhausted. Outstanding CHANGES in round-<N>/ from: <reviewers>.`
     Go to **Needs human**.
8. **Approve** (stage approval). Spawn `approver` with `Final round: N.`, then
   read the first line of `decision.md`. `APPROVE` → set stage merging and
   `approvedAt` to now, then go to **Merge**. `ESCALATE` → **Needs human**, with the
   decision's second line as the note.

### Merge (one at a time, across all sessions)

1. **Wait your turn.** Your job must be the merge-queue head
   (`$STATE queue-head REPO` prints its id), and you must take the lock with
   `mkdir REPO/factory/.merge.lock` and write the id to `.merge.lock/owner`.
   Wait in the background until both are true. If the lock's owner job is no
   longer merging, the lock is stale: remove it.
2. **Main checkout ready?** Run
   `git -C REPO status --porcelain -- . ':!factory/backlog.md'`. It must print
   nothing, and `git -C REPO branch --show-current` must print INTEGRATION. If
   not: release the lock and set **Needs human** with the note
   "approved; main checkout busy". The user runs `/factory approve <id>` once it's clean.
3. **Bring the branch up to date and re-verify.** Run
   `cd WORKTREE && git merge INTEGRATION`, then project.md's Verify commands in WORKTREE.
   - On a conflict or a failure: run `git merge --abort` if a merge is in
     progress, and release the lock.
     - The first time, set stage build, round +1, with the note
       "merge: <reason>". Resume the builder with the error, then build check →
       a fresh review round.
     - The second time, go to **Needs human**.
4. **Merge.** Run
   `git -C REPO merge --no-ff BRANCH -m "factory: merge <id> — <title>"`, then
   `git -C REPO worktree remove WORKTREE` and `git -C REPO branch -d BRANCH`.
   Set stage merged, then release the lock (`rm -r REPO/factory/.merge.lock`).
   If removing the worktree fails, the job is still merged: report what git printed.

**Never push. Never check out, merge into or reset PRODUCTION.** Pushing is always the human's call.

### Needs human

Set stage needs-human. The worktree and branch stay for inspection. Tell the user:
- which job is waiting
- the worktree path
- the reason (from decision.md, the BLOCKED part of build.md, or the note)
- the commands they can use: `/factory approve <id>` or `/factory rework <id> <note>`

When a job leaves the active stages, start the next of your queued jobs.

### Resuming the builder

Use SendMessage to `builderAgent`. If it can't be reached (for example, after a
session restart), spawn a fresh `software-factory:builder` named `builder-<id>`.
Tell it: "You are resuming. Read spec.md, build.md, every round folder, and
<the new input>, then continue." Update `builderAgent`.

## Commands

### `/factory init`
1. Create `REPO/factory/` and copy `project.md`, `backlog.md` and
   `dashboard.html` from the templates. Never overwrite an existing project.md
   or backlog.md. On a re-run, only refresh dashboard.html.
2. Fill in project.md by inspecting the repo: `AGENTS.md`/`CLAUDE.md`,
   manifests, lint, format and test configs, CI workflows, `git branch -a`,
   README.
   - Run every Verify and Setup command once and record what actually happens.
   - If there's no obvious integration branch, ask the user. Never pick PRODUCTION.
   - Set Browser check to `agent-browser` only if `agent-browser` is installed
     and the dev server starts. Otherwise set it to `none`.
3. Add `factory/jobs/` and `factory/.merge.lock` to `.gitignore`.
4. If CI deploys on push, *suggest* a `paths-ignore` for `factory/**`. Don't edit CI files.
5. Tell the user to review project.md, then watch the board:
   `cd factory && python3 -m http.server 8000 --bind 127.0.0.1` → http://localhost:8000/dashboard.html

### `/factory <feature>`
Run one job with this feature, from step 1.

### `/factory next [N]`
N defaults to 1, max `MAX_PARALLEL`. For each item: read `factory/backlog.md`
and claim the first `- [ ]` line with one Edit that replaces that exact line
with `- [x] <item> → claimed`. If the Edit fails, another session changed the
line, so re-read and try the next item. After step 1, replace `claimed` with
the job id. Run the claimed jobs in parallel.

### `/factory approve <job-id>`
The job must be in needs-human. If decision.md is missing or says ESCALATE,
set the note to `human approved <date>`. Set stage merging and `approvedAt` to
now, then run **Merge**.

### `/factory rework <job-id> <note>`
The job must be in needs-human. Write the note, verbatim, to
`JOB_DIR/round-<round+1>/human.md`. Set stage build and resumes 0 (a rework
gets a fresh `MAX_RESUMES`). Resume the builder with
`Rework: read <that file> and address it, then update build.md for round <round+1>.`
Then do the build check and run review round `round+1` in that same folder.

### `/factory resume [job-id]`
For the given job, or for every job whose stage is queued or active:
1. Show the job's stage and the age of its `updated` time.
2. Ask the user to confirm that no other live session is running it. Two
   orchestrators must never drive one job.
3. Continue from the first missing artifact:
   - spec.md
   - a READY build.md
   - the current round's four reviews
   - decision.md
   - the merge

   Re-spawn any agent whose file is missing.

## Reporting
Post one short line per transition, for example:
`004-reading-time: round 2, security CHANGES, ux/ui/code PASS → resuming builder`.
When this session's jobs are all merged or waiting, summarize:
- what merged into INTEGRATION and is ready for the human to push
- what needs a human, and why
