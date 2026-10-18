<!-- Adapted from Matt Pocock's retro skill
     (https://github.com/mattpocock/skills/tree/main/skills/engineering/retro),
     MIT License, Copyright (c) 2026 Matt Pocock. The factory sources and targets are new. -->

# Retro on a factory job

You look back at one finished factory job and suggest changes to the
factory's **environment** so the next job goes better. The environment is the
repo's `factory/project.md`, the repo's verification skill and checks, and the
plugin's agents and orchestrator. You write one file, `<job folder>/retro.md`.
You never edit or create anything else, not even a helper script in `/tmp`:
search with `grep`, and use `python3 -c` for anything grep can't do. A human
decides which suggestions to apply.

## Read

1. `<repo>/factory/project.md`, and the repo's `AGENTS.md` / `CLAUDE.md` if present.
2. Everything in the job folder: job.json (its `history` and `note`), spec.md,
   build.md (especially its Log and any Diagnosis), every `round-*/` file
   including `human.md`, and decision.md.
3. The change, if the branch still exists:
   `git -C <repo> log --oneline <integration>..factory/<job-id>`. If it merged,
   find the merge with `git -C <repo> log --oneline --grep <job-id> <integration>`.
4. The session transcripts, when they're on this machine. They show what the
   job files don't: failed commands, permission prompts, retries. Look in
   `~/.claude/projects/<folder>/`, where `<folder>` is the absolute path with
   every `/` and `.` turned into `-`. Check both the repo's folder and the
   job's worktree folder. Find the orchestrator's session with
   `grep -l <job-id> <dir>/*.jsonl`, and its agents' sessions under
   `<session>/subagents/`. Search them for errors rather than reading them whole:
   `grep -o '"is_error":true[^}]*' <file> | head`. If there are none, say so and
   work from the job files.

Redact every secret you quote: write `<REDACTED>` in its place.

## Look for

- **Wrong or missing facts.** A project.md command that failed or needed a
  workaround, or a gotcha that more than one agent discovered on its own. The
  fix is a line in project.md.
- **Missing automated checks.** A mistake a reviewer caught, or that got
  through, that a linter, test, type check, hook or CI job could have caught.
  Look at the repo's own check scripts and CI first: a check that exists but
  is broken or not run is the finding, not a reason to write a new one. A repo
  with no check at all (no pre-commit hook, no CI job running lint or tests) is
  a finding too.
- **Review gaps.** A problem a later round, the approver or a human caught that
  a reviewer should have caught first. If the rule is mechanical (a banned
  call, an import shape, where a file goes), suggest a check, not a rule. Save
  agent rules for judgement calls.
- **Agent instructions.** An agent that broke one of its rules, or followed one
  that didn't fit this repo. Name the agent file and the line, and say what the
  rule should say.
- **Verification.** Launch, Doctor or Drive steps that failed. A feature-map
  entry that's now out of date, or one that's missing for a feature this job
  touched.
- **Orchestration.** Tool errors, permission prompts, shell problems, agents
  that were resumed or retried, and rounds spent on something one rule up
  front would have prevented.
- **Cost.** Expensive steps that could be cheaper: a full build where a smaller
  check would do, a command run over and over, a large file read whole.

Skip anything that went fine. A short retro is a good outcome.

The plugin and the repo may have changed since the job ran. Before you suggest
a change, read the target file as it is now, in the plugin folder your prompt
gives or the repo's main checkout. If it already says what you'd suggest, drop
the suggestion and mention it under Went well. Judge files by what they say,
not by their git status: uncommitted edits may be someone's work in progress.

## Write retro.md

```markdown
# Retro: <job id>

<one line: how the job went, e.g. "Merged in round 2 after one rework; 3 suggestions">

## Suggestions
1. **<severity: high | medium | low>. <one-line title>**
   - Evidence: <file:line or transcript excerpt, quoted and redacted>
   - Change: <target file> — <the exact line to add, change or remove, or the check to build>
   - Why: <what it prevents next time>

## Went well
Optional. Anything worth keeping, in a line or two.
```

- Order suggestions by severity: high first.
- Each target is one file. Say whether it's in the repo (project.md, the
  verification skill, a check) or in the plugin (`agents/<name>.md`,
  `skills/factory/SKILL.md`, `references/*.md`).
- Write "None." under Suggestions if there's nothing to change.

When you're done, reply with the one-line summary and the number of suggestions.
