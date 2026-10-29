# Validation results

Sections 1-3 are verbatim command output from the build sandbox (Node v22.22.2). Section 4 is written by hand and lists what was not run.

## 1. Official validator (skills-ref 0.1.1 from PyPI; CLI name agentskills)

```
$ agentskills validate human-context
Valid skill: human-context
(exit 0)
```

Negative control (deliberately invalid skill name, to confirm the validator can fail):

```
Validation failed for /tmp/bad/Bad_Name:
  - Skill name 'Bad--Name' must be lowercase
  - Skill name cannot contain consecutive hyphens
  - Directory name 'Bad_Name' must match skill name 'Bad--Name'
(exit 1)
```

## 2. Typecheck

```
$ npm run typecheck
> tsc -p tsconfig.json

(exit 0)
```

## 3. Tests (npm test: build, then node:test)

```
ok 1 - frontmatter: name follows the specification
ok 2 - frontmatter: description is non-empty, <=1024 chars, says what and when
ok 3 - frontmatter: only known keys; metadata values are strings
ok 4 - size: SKILL.md under 500 lines and ~5000 tokens
ok 5 - size: each reference file stays focused (<500 lines)
ok 6 - links: every relative link in SKILL.md, README, references resolves
ok 7 - links: every reference file is linked from SKILL.md
ok 8 - hygiene: no placeholder text in SKILL.md
ok 9 - scripts: skill ships exactly one built script, with only node: imports
ok 10 - scripts: built output is in sync with src/vault-graph.mts
ok 11 - evaluation.md: scenarios 1..33 in order, each with all five fields
ok 12 - evals: runnable cases are well formed and referenced in evaluation.md
ok 13 - vault-graph: unresolved links on the main fixture
ok 14 - vault-graph: orphan candidates (incl. the unlinked newer decision) on the main fixture
ok 15 - vault-graph: backlinks to Event Sourcing, by name and by alias
ok 16 - vault-graph: depth-1 local graph for Atlas Migration equals the six touching edges
ok 17 - vault-graph: depth-2 local graph reaches CQRS and the unresolved Saga Pattern
ok 18 - vault-graph: frontmatter key census
ok 19 - vault-graph: config reports graph.json as view settings only, never edges
ok 20 - vault-graph edge cases: alias, case, path, heading, display text, markdown links, embeds
ok 21 - vault-graph edge cases: links in code, external URLs and same-note headings are ignored
ok 22 - vault-graph: frontmatter parsing handles inline lists, YAML lists, and scalar aliases
ok 23 - vault-graph CLI: usage errors and missing notes return non-zero
ok 24 - vault-graph: built .mjs CLI agrees with the library (parity check)
ok 25 - fixtures: properties the evaluation scenarios depend on
# tests 25
# pass 25
# fail 0
# skipped 0
```

Negative control: adding the missing Saga Pattern note to the fixture vault made tests 13 (unresolved links) and 17 (depth-2 local graph) fail; removing it restored 25/25.

## 4. What was NOT run

- **No model-behavior evaluation was executed.** The 33 scenarios in human-context/references/evaluation.md and the 14 runnable cases in human-context/evals/ have not been run against a model: this build environment has no claude CLI, so claude plugin eval could not be used. Behavioral claims about the skill are unverified until those cases are run and reviewed.
- **Description triggering was not measured.** The activation and restraint checks are specified but unexecuted.
- **No real Obsidian instance or real-world vault.** vault-graph was tested only on two small synthetic fixtures (tests/fixtures/vault and tests/fixtures/edge-vault), not on a large, messy vault, and not against Obsidian's own link resolution. Plugin-defined relationships and duplicate-name disambiguation are not modeled.
- **Node versions.** Tested on Node v22.22.2 only. package.json declares >=22.6 for the TypeScript tests (type stripping). The compiled .mjs uses only long-standing Node built-ins but was not run on older versions.
- **Memory and persistence behavior** (scenarios 5, 29, 30, 32, 33) depends on host tooling that was not present.
