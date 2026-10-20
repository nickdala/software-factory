# Project facts

<!-- Written by /factory init from the repo, then reviewed by a human.
     Every factory agent reads this file (and AGENTS.md / CLAUDE.md, if present) first.
     Keep it short and true. -->

## Stack
A Claude Code plugin (`software-factory`). Mostly Markdown prompts; read CLAUDE.md first.
- `skills/factory/SKILL.md`: the `/factory` orchestrator. `agents/*.md`: the worker agents.
- `scripts/factory_state.py`: Python 3 stdlib, read-only job queries.
- `hooks/register.ts` (+ `register.test.ts`), `types/index.d.ts`: TypeScript mod (status line, toasts),
  run by the plugin runtime. No package.json, no build step.
- `templates/`, `references/`, `examples/factory/jobs/` (demo board data).
- `PROMPT.md` is the design spec; `README.md` documents it.

## Branches
- Integration: `develop`. Jobs merge here, locally. A push deploys nothing (no CI).
- Production: `main`. The factory never touches it. Users install the plugin from `origin/main`,
  so a push to main ships to them.

## Setup
- none (no dependencies to install)

## Verify
<!-- Run from the worktree root. All three were run during init and passed. -->
- Test: `claude plugin test .` (runs `hooks/register.test.ts`; 5 pass)
- Lint: `claude plugin validate .` (whole plugin; one expected warning: "CLAUDE.md at the plugin root
  is not loaded as project context"; any other warning or error is a failure)
  and `python3 -m py_compile scripts/factory_state.py` if that script changed.
  `validate` does not parse agent/skill frontmatter: every `agents/*.md` and `skills/*/SKILL.md`
  must start with YAML frontmatter whose `name` equals the file (or folder) name and that has a
  non-empty `description` (the check lives in `.claude/hooks/check-plugin.sh`).
- Format check: none configured
- Build: skipped: no build step
- `examples/factory/dashboard.html` must remain a working symlink to `../../templates/dashboard.html`.

## Dev server
`cd examples/factory && python3 -m http.server {port} --bind 127.0.0.1`
(serves the board with the example jobs at `/dashboard.html`)

## Browser check
none

## Verification
none

## Conventions
- Prompts are plain, direct English, second person to the agent; short sentences; code spans for
  paths, commands and contract words.
- Machine-read contracts are the first line of each agent's file (`STATUS:`, `VERDICT:`,
  `APPROVE | ESCALATE`). Changing one means updating the agent, `SKILL.md`, `templates/dashboard.html`,
  `hooks/register.ts` / `types/index.d.ts` and the examples together.
- The loop diagram lives in `README.md`, `PROMPT.md` (Mermaid) and `skills/factory/SKILL.md` (ASCII):
  keep all three in sync. Keep `PROMPT.md` consistent with the implementation.
- `MAX_PARALLEL` and the active-stage set are duplicated in `SKILL.md`, `hooks/register.ts` and
  `scripts/factory_state.py`.
- Nothing in the plugin may mention a specific repo, stack or command.
- Credit adapted material in README's Credits section.
- Commit messages: short imperative subject, sentence case, no prefix
  (e.g. "Show how to run /factory init from the terminal").

## Guardrails
- Never commit secrets. Never push. Never touch the production branch.
- The approver escalates any change to:
  - `.claude-plugin/` (plugin manifest, marketplace, version)
  - `.claude/` (this repo's own hooks and settings) and `hooks/hooks.json`
  - the machine-read contracts (status/verdict/decision words, `Stage` union in `types/index.d.ts`)
  - the factory invariants: job state files, atomic claims, `factory/.merge.lock`, worktree/branch
    naming, never pushing
