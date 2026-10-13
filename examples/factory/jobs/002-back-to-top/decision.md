ESCALATE
Touches .github/workflows (guardrail)

## Why
The feature is done, but the branch also edits `.github/workflows/deploy.yml`, which project.md lists as a guardrail.

## For the human
Decide whether the CI Node bump belongs in this job. If not: `/factory rework 002-back-to-top "drop the workflow change"`.
