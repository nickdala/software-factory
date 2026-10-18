<!-- Adapted from pstack's create-verification-skill
     (https://github.com/cursor/plugins/tree/main/pstack/skills/create-verification-skill),
     MIT License, Copyright (c) 2026 Lauren Tan. The "Factory requirements" section is new. -->

# Create a verification skill

You write a project-local skill, `<repo>/.agents/skills/verify-<app>/`, that
drives the real app the way a user does: launch it, exercise a feature, and
capture evidence. Factory agents (the builder, the UX and UI reviewers, the
approver) will read it cold, mid-job, without ever having seen the app. Write it
for them, not for a human.

Use `.agents/skills/` even if the repo keeps other skills in `.claude/skills/`.
Factory agents read this skill by the path in `factory/project.md`, so it
doesn't need to be registered with Claude Code. Claude Code asks for approval
before anything writes into `.claude/`, and an unattended run can't give it, so
you couldn't write the skill there. Codex also loads skills from
`.agents/skills/`. Factory jobs never edit the skill, wherever it lives: a
human updates its feature map after a merge.

## Factory requirements

Factory jobs run up to three at a time, each in its own worktree with its own
ports. The generated skill must support that:

- **Worktree and port are inputs.** Every Launch, Drive and Cleanup command
  takes the worktree path and a port (`{worktree}`, `{port}`). Never hard-code a
  port, and never assume the main checkout.
- **Isolated state.** Each run gets its own data dir, profile or database,
  keyed by `{port}` or a run id. Two jobs must never share or reset each other's
  state. If the app can't be isolated, say so in the skill, and say that agents
  must work from the code instead of driving a shared instance.
- **Browser sessions are named.** With `agent-browser`, every call passes
  `--session {session}`. Factory agents use `<job-id>-<role>`.
- **Evidence goes where the caller says.** Commands write proof to
  `{evidence}`. Factory agents pass `<job folder>/evidence/<role>/`, which is
  outside the worktree, so proof never dirties the job branch.
- **Say what is safe.** Add a `Safety` line near the top: does the launched
  instance talk only to local, seeded services, or can it reach real ones (a
  payment provider, email, a shared database)? Factory agents sign in or submit
  forms only when this line says the instance is local and seeded.
- **Helpers run by absolute path.** Agents read the skill from the main checkout
  and run its helper scripts by absolute path against `{worktree}`.

## 1. Interview the repo, not the user

Answer these from the codebase. Ask the user only what you can't observe:

- **Surface:** what does a user actually touch? A web UI, a CLI/TUI, a desktop
  app, an API, a mobile app, a library? A repo can have several. Pick the
  primary one and note the rest.
- **Run:** how does the app start locally? Prefer the repo's own documented dev
  command (package scripts, Makefile, README quickstart), and `factory/project.md`'s
  Dev server line. Note ports, env vars, seed data and auth.
- **Drive:** how can an agent interact with it programmatically? Existing
  harnesses first: Playwright/Cypress specs, expect scripts, PTY helpers,
  curl-able endpoints, a debug port. Only then pick a generic recipe:
  `agent-browser` or another CDP browser for web and Electron, tmux or a PTY for
  CLIs and TUIs, plain HTTP for services.
- **Observe:** what evidence can be captured? Screenshots, ARIA snapshots,
  terminal transcripts, response bodies, logs, exit codes, DB state.
- **Isolate:** can two instances run side by side (ports, data dirs, profiles)?
  See Factory requirements.

If the checkout doesn't build or start as-is, fix that first or report it
precisely before generating. A skill written against a broken base teaches
wrong steps. When an irrelevant missing asset blocks startup (a static dir the
API never serves, a sample config), the generated skill may create it, clearly
marked as verification scaffolding, and remove it in cleanup.

## 2. Generate the skill

Write `verify-<app>/SKILL.md` with YAML frontmatter: `name: verify-<app>` and a
`description` that names the app, the surface, and when to reach for it.
Without frontmatter the skill never registers. Then these sections, each
grounded in what the interview found, with no placeholders left except the
factory inputs (`{worktree}`, `{port}`, `{session}`, `{evidence}`):

- **Safety:** the one line described above.
- **Launch:** the exact command that starts the app for verification, and how
  to tell it's ready (a log line, a prompt). Launch must reach a usable state
  from an empty data dir, including migrations and seed data. Ready means
  usable, not just that a process answers: a database health check can pass
  while its init scripts are still running. For a short-lived CLI or TUI there
  is no server to keep alive: Launch means build the binary (or install deps)
  once, then start each drive in its own isolated PTY or tmux session.
- **Doctor:** one read-only check that answers "is this instance worth
  driving?": process up, right build (from `{worktree}`, not the main
  checkout), port owned by us, auth valid. An agent runs this first, and again
  whenever anything looks off.
- **Drive:** the harness recipe with real selectors and commands from this
  repo, not examples. Prefer stable handles (ARIA roles and names, data
  attributes, prompt strings, route paths) over coordinates and tab order.
- **Evidence:** what to capture for a proof, written under `{evidence}`. Proof
  standards: exercise the real user path, not internal setters or test-only
  endpoints. Capture the action and the resulting state, not just the final
  screen. Verify side effects (files written, rows inserted, messages sent)
  alongside what's visible. Use mocks only where a production boundary already
  isolates the external system. When the safe path is a dry-run or test mode,
  verify what it actually skips by observing (files, network, git refs) rather
  than trusting its name: some dry-runs still touch the network.
- **Cleanup:** how to tear down what the run created. Never kill by process
  name: kill what you started (record the PID at launch). Cleanup removes
  instances and scratch state, never the evidence.
- **Helpers:** any script the skill ships is executable, and its invocation is
  shown in the skill body. A helper the reader has to reverse-engineer is not a
  helper.

## 3. Seed the feature map

Create `verify-<app>/features/README.md` plus one file per user-facing feature
you can identify. Start with the top 3–5, from routes, commands, menus or docs.
Follow the shape in `feature-map-example/` next to this file: a README index,
then one file per feature.

Each feature file answers, from the user's point of view: what the feature is,
how to reach it, how to drive it with the harness, and what observable end
state proves it works. Its four H2s are `Sub-features`,
`How to get to it (user POV)`, `Driving it with <harness>`, and `Gotchas`.

If the seed data lacks a precondition that a journey needs, the journey reports
a failure and the reason goes in that feature's `Gotchas`. Never weaken the
journey to make it pass. The map is the repo's verification source: a proof
that drives one convenient entry point is incomplete when the map lists others.

## 4. Prove the generated skill before handing it over

Run its own instructions end to end once, the way a factory agent would: from
a fresh `git worktree` of the integration branch (or the main checkout if
you can't make one), on a port in the factory range such as `5199`, with
`{evidence}` set to a scratch folder. Launch, doctor, drive ONE mapped feature,
capture evidence, clean up. Then confirm the evidence still exists. A cleanup
that eats the proof fails this step.

Fix what fails, and run the generated cleanup after every failed attempt too,
so broken attempts don't strand processes and ports. Remove any worktree you
made. A generated skill that was never executed is a draft, not a deliverable.

## 5. Report

Reply with:
- the skill's path
- the surface it drives and the Safety line
- the features in the map
- what the proof run did, and where its evidence is
- anything you couldn't verify, and why

Remind the user that the skill lives in the repo, so they should review and
commit it. pstack's `maintain-verification-skill` can keep the feature map
honest as the app changes.
