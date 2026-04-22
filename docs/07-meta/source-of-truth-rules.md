# Source Of Truth Rules

## Priority Order

1. explicit user instruction
2. filesystem reality
3. executable/config evidence (`package.json`, scripts, imports, real directories, actual test files)
4. stable project decision log
5. current status / progress docs
6. current docs in this folder
7. strategy / recommendation / roadmap docs
8. historical notes, older reports, TODOs, comments, prompts

## Contradiction Handling

When sources disagree:
1. state the contradiction explicitly
2. trust the higher-priority source
3. label the lower-priority claim as `Outdated or Contradicted`
4. update shared docs if the task includes documentation maintenance

## Assumption Discipline

- If not proven, label it `Assumption`.
- If recommended future state, label it `Proposal`.
- Do not silently promote assumptions into facts.

## Change Documentation Rule

If a task changes one of these, update docs in the same task when practical:
- product scope
- architectural boundary
- workstream ownership
- security posture
- roadmap priority
- major open question status

## Strategy Report Rule

`docs/product-strategy-report.md` is a strong planning artifact.

It must be used actively, but:
- it is not code
- it is not a decision log
- it does not override filesystem or executable reality

## Missing-Code Rule

- Do not claim a source tree, tests, backend, or infrastructure exist unless the filesystem proves it.
- If git metadata or earlier docs suggest code should exist but the working tree does not contain it, label that as historical, planned, or blocked.
- Do not silently turn `HEAD`-backed or historical implementation notes into current-state truth.
