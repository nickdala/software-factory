# Project facts

<!-- Written by /factory init from the repo, then reviewed by a human.
     Every factory agent reads this file (and AGENTS.md / CLAUDE.md, if present) first.
     Keep it short and true. -->

## Stack
<!-- Language, framework, major libraries; where source, content and tests live. -->

## Branches
- Integration: `<branch>`. Jobs merge here, locally. <!-- does a push deploy anything? -->
- Production: `<branch>`. The factory never touches it. <!-- does a push deploy anything? -->

## Setup
<!-- Command(s) that prepare a fresh checkout (a new worktree), e.g. `npm ci`.
     Optional opt-in instead: "symlink <folder>" to reuse the main checkout's
     dependencies. That's faster, but a dependency a builder adds lands in the main checkout. -->
- `<command>`

## Verify
<!-- Exact commands, run from the worktree root. Say what's missing or broken on
     this machine, and what to use instead. -->
- Test: `<command>` | none
- Lint (changed files): `<command> <files>`
- Format check (changed files): `<command> <files>`
- Build: `<command>` | skipped: <why>

## Dev server
<!-- Command that serves the app on a given port, e.g. `npm run dev -- --port {port}`, or "none". -->

## Browser check
<!-- `agent-browser` (installed, and the dev server works) or `none`. When `none`,
     the builder and the UX/UI reviewers work from the code and diff alone. -->
none

## Verification
<!-- Path, from the repo root, to a project skill that launches and drives the
     app on a given port, e.g. `.agents/skills/verify-<app>/SKILL.md`, or `none`.
     When set, the builder, the UX/UI reviewers and the approver follow it to
     prove behavior in the running app. /factory init can generate one. -->
none

## Conventions
<!-- From the repo's config files and code: formatting, naming, file layout, commit style. -->

## Guardrails
- Never commit secrets. Never push. Never touch the production branch.
- The approver escalates any change to:
  - <!-- CI/deploy config, e.g. .github/workflows/ -->
  - <!-- secrets and env files, e.g. .env* -->
  - <!-- dependency manifests and lockfiles -->
