# software-factory

A small, visual software factory for Claude Code. `/factory` takes a feature
through a fixed loop of agents (spec → build → four parallel reviews → approval
→ merge queue). Each job gets its own git worktree. Up to 3 jobs run at once,
in one session or several. A browser board and a status line show where
everything stands.

Inspired by [ZazenCodes' software factory](https://github.com/zazencodes/zazencodes-season-3/tree/main/src/software-factory-claude-code).
See [Credits](#credits).

```
feature → [worktree] → spec-writer → builder ◄──────────────────┐
                        (opus)       (opus)  │ STATUS: READY     │
            ┌──────────┬──────────┬──────────┴┐                  │
         security      ux        ui        code                  │
          (opus)    (sonnet)  (sonnet)   (sonnet)                │
            └──────────┴────┬─────┴──────────┘                   │
                      WAIT FOR ALL 4 ── any CHANGES ─────────────┘ (max 2 resumes)
                            │ all PASS
                         approver ── ESCALATE / BLOCKED / rounds exhausted ──► needs-human
                          (opus)                                               │
                            │ APPROVE                                          │
                       merge queue ◄──────────── /factory approve ─────────────┘
                            │ one at a time (lock)
                  merged into your integration branch (local, never pushed)
```

## How it works

- **The session that runs `/factory` orchestrates its jobs.** It spawns every
  agent and is the only writer of each job's `factory/jobs/<id>/job.json`.
- **Agents talk through files.** Each one reads `factory/project.md` (and
  `AGENTS.md`/`CLAUDE.md`), then writes exactly one file in the job folder:
  - `spec.md`
  - `build.md`, whose first line is `STATUS: READY` or `BLOCKED`
  - `round-N/review-*.md`, whose first line is a verdict: `VERDICT: PASS`,
    `CHANGES` or, for UX/UI only, `PASS (n/a)` (see [Review verdicts](#review-verdicts))
  - `decision.md`, whose first line is `APPROVE` or `ESCALATE`
- **Each job has its own worktree** at `../<repo>-factory/<id>` on branch
  `factory/<id>`. The worktree is outside the repo, so your tools never scan
  it, and it gets a real dependency install. It also gets its own dev-server ports.
- **Safe in parallel.** One state file per job means no two sessions write the
  same file. Job ids and backlog items are claimed atomically, and merges take a
  lock. `MAX_PARALLEL = 3` applies across all sessions.
- **Reviews:** a round is done only when all four files exist. Reviewers check
  their own previous round's findings. Any CHANGES resumes the same builder.
  After 2 resumes, the job escalates.
- **Approval:** the approver spot-checks a criterion and checks
  `git merge-tree` for conflicts. It escalates guardrail changes and spec
  assumptions that are really product decisions.
- **Merge:** one job at a time, only when the main checkout is clean and on the
  integration branch. The job's branch is brought up to date and re-verified
  first. **Nothing is ever pushed, and the production branch is never touched.**

### Review verdicts

Every review file starts with one of three verdicts:

| Verdict | Meaning | Who can use it | Board chip |
| --- | --- | --- | --- |
| `VERDICT: PASS` | Reviewed. Nothing blocks the merge. | All four reviewers | green |
| `VERDICT: CHANGES` | Reviewed. At least one finding must be fixed. The builder is resumed. | All four reviewers | red |
| `VERDICT: PASS (n/a)` | Not applicable. The change has nothing in this reviewer's area, so there was nothing to judge. | **UX and UI only** | grey outline |

`PASS (n/a)` exists because all four reviewers run on every job, and many
changes have no user-facing part: a refactor, a CI tweak, a backend fix. In
those cases the UX or UI reviewer writes that single line and stops. It doesn't
write a review of nothing, and it doesn't invent nitpicks.

The orchestrator and the approver treat `n/a` exactly like `PASS`. The board
shows it as a separate grey chip, so you can tell "checked and fine" from "not
relevant". Security and code always apply to every change, so those two
reviewers must answer `PASS` or `CHANGES`.

For example, in `examples/factory`, `003-contact-rate-limit` adds a rate limit
to a form's submit handler. UI is `n/a`, because nothing visual changed. UX
still does a full review, because users can now see a rejection message.

## Install

```
/plugin marketplace add <path or git URL of this repo>
/plugin install software-factory@software-factory
```

Then, in the repo you want to run it on:

```
/factory init
```

`init` creates `factory/` and fills in `factory/project.md` by inspecting the repo:
- stack and branches
- setup, verify and dev-server commands, and the browser-check setting
- conventions and guardrails

It also gitignores `factory/jobs/` (runtime state) and `factory/.merge.lock`.
**Review project.md before running jobs**, because every agent trusts it.

**Optional:** install [`agent-browser`](https://github.com/vercel-labs/agent-browser)
and set `Browser check: agent-browser`. The builder and the UX/UI reviewers will
then look at the running app on per-job ports. Each uses its own browser
session, so parallel jobs never drive each other's browsers.

## Watch it

```
cd factory && python3 -m http.server 8000
open http://localhost:8000/dashboard.html
```

The board lists `factory/jobs/` and reads every `job.json`, so jobs from every
session show up. To try it with no jobs of your own:

```
cd examples/factory && python3 -m http.server 8000   # five example jobs
```

In Claude Code, the status line shows something like
`factory ▸ 2/3 running · 1 in review · 1 needs-human`. Toasts appear when a job
needs a human, merges, or fails to merge.

## Commands

| Command | What it does |
| --- | --- |
| `/factory init` | Create `factory/` and fill in `project.md` |
| `/factory <feature>` | Run a new job through the loop |
| `/factory next [N]` | Claim and run the first N (≤ 3) unchecked items of `backlog.md` |
| `/factory approve <job-id>` | Send a needs-human job to the merge queue |
| `/factory rework <job-id> <note>` | Send a needs-human job back to its builder with your note |
| `/factory resume [job-id]` | Pick up unfinished jobs after a session ends |

For more throughput, open more sessions in the same repo and run `/factory` in
each. If another plugin also defines `factory`, use `/software-factory:factory`.

## Layout

Plugin (this repo):

```
.claude-plugin/              plugin.json, marketplace.json
skills/factory/SKILL.md      the orchestrator: loop, job state machine, merge queue, commands
agents/                      spec-writer, builder, approver, review-{security,ux,ui,code}
scripts/factory_state.py     read-only queries over every job.json (active count, merge-queue head, next id)
templates/                   dashboard.html, project.md, backlog.md
hooks/register.ts            the mod: status line + toasts (tests: register.test.ts)
types/index.d.ts             the mod's state contract
examples/factory/            five example jobs for the board
PROMPT.md                    the prompt that builds this plugin
```

Each target repo:

```
factory/
  project.md                 repo facts every agent reads (commit this)
  backlog.md                 "- [ ] feature" queue (commit this)
  dashboard.html             the board
  jobs/<id>/                 job.json, spec.md, build.md, round-N/*.md, decision.md (gitignored)
../<repo>-factory/<id>/      one worktree per active job
```

## Changing the factory

- **The loop:** the diagram and steps in `skills/factory/SKILL.md`.
  `MAX_PARALLEL` and `MAX_RESUMES` are at the top.
- **An agent's checklist or model:** its file in `agents/`.
- **A repo's commands, ports or guardrails:** that repo's `factory/project.md`.

## Credits

This plugin is inspired by the software factory in
[zazencodes/zazencodes-season-3](https://github.com/zazencodes/zazencodes-season-3/tree/main/src/software-factory-claude-code)
by [ZazenCodes](https://github.com/zazencodes). The core idea comes from that
project: one `/factory` skill orchestrating a spec-writer, a builder, four
parallel reviewers and an approver, all talking through markdown files and
shown on a browser board. So do several lessons from running it on a real site:
- one state file per job
- worktrees outside the repo
- `STATUS: READY | BLOCKED` builds
- reviewers re-checking their earlier findings
- the approver spot-checking a criterion and running `git merge-tree`
- race-safe claims of job ids and backlog items

This version packages the idea as an installable plugin. On top of it, it adds:
- `/factory init` with a per-repo `project.md`
- a configurable integration branch instead of `main`
- a cap on parallel jobs, enforced across sessions
- a serial merge queue that re-verifies before merging
- `/factory resume`
- `PASS (n/a)` verdicts, so UX/UI reviewers can skip changes outside their area
- a status line and toast mod

## Develop

```
claude plugin validate .
claude plugin test .        # the mod's tests
```
