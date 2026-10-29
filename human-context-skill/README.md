# human-context-skill

Project-local repository for the `human-context` Agent Skill, with TypeScript tooling.

```
human-context/            the skill (SKILL.md, references/, scripts/, evals/, README.md). Install this directory.
src/vault-graph.mts       TypeScript source of the optional graph tool (compiled into human-context/scripts/)
tests/                    TypeScript tests, fixture vaults, RESULTS.md
package.json, tsconfig*.json
```

## Commands (Node >= 22.6)

```bash
npm install          # dev tooling only: typescript and @types/node. The skill itself has no dependencies.
npm run build        # compile src/vault-graph.mts -> human-context/scripts/vault-graph.mjs
npm run typecheck    # tsc --noEmit over src and tests
npm test             # build, then run tests/check-skill.test.mts with node:test (type stripping, no extra runner)
```

- Skill install and usage: [human-context/README.md](human-context/README.md)
- Evaluation specification (33 scenarios): [human-context/references/evaluation.md](human-context/references/evaluation.md)
- Validation results and what was not run: [tests/RESULTS.md](tests/RESULTS.md)
- Official validator (Python, separate from this tooling): `pip install skills-ref && agentskills validate human-context`
