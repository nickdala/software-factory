# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A Claude Code **plugin** (`software-factory`). It provides `/factory`, which takes a feature through this loop: spec → build → four parallel reviews → approval → serial merge queue. Each job runs in its own git worktree, and up to 3 jobs run at once. Most of the "code" is prompts. The only executable pieces are a Python state script and a TypeScript mod (status line + toasts).

`PROMPT.md` is the build prompt the plugin was generated from. It is the design spec. Keep it consistent with the implementation.

## Commands

```
claude plugin validate .                 # validate plugin/agent/skill structure
claude plugin test .                     # run the mod's tests (hooks/register.test.ts)
python3 scripts/factory_state.py active|queue-head|next-id <repo>   # read-only job queries
cd examples/factory && python3 -m http.server 8000 --bind 127.0.0.1  # view the board with example jobs
```

A project `Stop` hook (`.claude/settings.json` → `.claude/hooks/check-plugin.sh`) runs both commands, plus an agent/skill frontmatter check, whenever plugin files have uncommitted changes. `validate` does not parse agent or skill frontmatter, which is why the hook checks it separately.

There is no build step and no package.json. The mod imports from `claude-code` and `claude-code/testing`, which the plugin runtime provides.

## Architecture

- **`skills/factory/SKILL.md` is the orchestrator.** It holds the loop, the job state machine, the merge queue and every subcommand (`init`, `<feature>`, `next`, `approve`, `rework`, `resume`, `retro`). The session running it is the **only writer** of each job's `factory/jobs/<id>/job.json`, and it never writes code, specs, reviews or decisions itself. `MAX_PARALLEL` and `MAX_RESUMES` are at the top.
- **`agents/*.md` are the workers.** They are spawned as `software-factory:<name>`: spec-writer, builder, review-{security,ux,ui,code}, approver. Each one reads the target repo's `factory/project.md` (plus its `AGENTS.md`/`CLAUDE.md`) and writes **exactly one file** in the job folder. The file's first line is a machine-read contract:
  - `build.md` → `STATUS: READY | BLOCKED`
  - `round-N/review-*.md` → `VERDICT: PASS | CHANGES | PASS (n/a)`. Only UX/UI may use `n/a`. Security and code must answer PASS or CHANGES.
  - `decision.md` → `APPROVE | ESCALATE`

  If you change a verdict or status word, update the agent, `SKILL.md`, `templates/dashboard.html`, `hooks/register.ts`/`types/index.d.ts` (if stages change), and the examples together.
- **`scripts/factory_state.py`** answers read-only queries over every `job.json`, across all sessions. The skill calls it as `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/factory_state.py <cmd> REPO`, written out in full each time. Don't store it in a shell variable, because zsh won't word-split it.
- **The mod** (`hooks/hooks.json` → `hooks/register.ts`) polls `<cwd>/factory/jobs/*/job.json`. It is read-only. It shows the status line and toasts on stage transitions. `types/index.d.ts` is the state contract (the `Stage` union and the `Job` fields the mod reads). It is referenced from `plugin.json` `"types"`. `MAX_PARALLEL` and the active-stage set are duplicated in `register.ts` and `factory_state.py`. Keep them in sync with `SKILL.md`.
- **`templates/`** is copied into a target repo by `/factory init`. It holds `project.md`, `backlog.md` and `dashboard.html`. `examples/factory/dashboard.html` is a symlink to `templates/dashboard.html`, so edit the template only.
- **`references/`** is guidance that agents and the skill load on demand: generating a repo's verification skill (`verification-skill.md`, `feature-map-example/`) and running `/factory retro` (`retro.md`).
- **`examples/factory/jobs/`** holds five hand-written example jobs that cover the stages and verdicts (including a 2-round job and `n/a` reviews), for the board demo.

## Rules for changes

- **Nothing in the plugin may mention a specific repo, stack, or command.** Everything repo-specific comes from the target repo's `factory/project.md`.
- The loop diagram appears in three places: `README.md` and `PROMPT.md` (Mermaid) and `skills/factory/SKILL.md` (ASCII). Keep all three in sync when the loop changes. Agent model choices (opus/sonnet) are shown in the diagrams and set in each agent's frontmatter.
- Factory invariants to preserve: one state file per job; atomic claims for job ids and backlog items; merges serialized under `factory/.merge.lock`; worktrees at `../<repo>-factory/<id>` on branch `factory/<id>`; nothing is ever pushed, and the production branch is never touched.
- Adapted material is credited in the README's Credits section (ZazenCodes, pstack, Matt Pocock's skills). Update it when you adapt more.
