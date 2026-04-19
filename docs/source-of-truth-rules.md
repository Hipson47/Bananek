# Source Of Truth Rules

## Priority Order

1. explicit user instruction
2. actual code, tests, config, infra artifacts
3. stable project decision log
4. current docs in this folder
5. strategy report
6. older notes, comments, TODOs, prompts

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
- it does not override repo reality
