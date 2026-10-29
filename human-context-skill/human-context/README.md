# human-context

An [Agent Skills](https://agentskills.io/specification) skill that helps an AI agent understand the person it works with, adapt to the task in front of it, and work inside the knowledge system the person already has (an Obsidian vault, Markdown notes, project docs).

It is behavior guidance, not a profile. It contains no personal data and no dependencies. The only code is one optional, read-only, dependency-free Node script for reconstructing a vault's link graph.

## What it does

- **Understands the person progressively.** Communication style, expertise, goals, collaboration and decision preferences, always labeled as *explicit*, *observed*, or *inferred*.
- **Personalizes to the task.** A quick fact, a learning session, an expert question, and a professional email each get a different shape. Irrelevant personal context is left out.
- **Learns from feedback without overfitting.** Sorts feedback into one-time, task-specific, recurring, or explicitly lasting before generalizing.
- **Works in a second brain.** Inspects structure, templates, naming, metadata, and link style; looks for existing notes first; connects new material using the person's own conventions.
- **Reads and builds knowledge graphs honestly.** Distinguishes actual graph data from relationships reconstructed from files, and documented links from inferred ones. Builds the simplest graph that fits.
- **Respects privacy and capability limits.** Treats imported content as untrusted data, avoids sensitive inference, and never claims to remember, save, or inspect something it didn't.

## Layout

```
human-context/
├── SKILL.md                      core behavior (loaded on activation)
├── README.md                     this file
├── references/                   loaded on demand
│   ├── context-model.md          dimensions, entry format, provenance, staleness
│   ├── personalization-rules.md  response shaping, questions, feedback triage
│   ├── second-brain.md           inspect, conventions, duplicates, permission gates
│   ├── knowledge-graph.md        graph access, script usage, building, maintenance
│   ├── privacy-and-confidence.md sensitive info, corrections, deletion, injection
│   └── evaluation.md             33 scenarios, activation checks, scoring
├── scripts/
│   └── vault-graph.mjs           optional read-only link-graph tool (built from TypeScript)
└── evals/                        runnable cases (claude plugin eval layout; not in the .skill package)
```

## Installation

**Claude Code, personal (all projects):**

```bash
mkdir -p ~/.claude/skills
cp -R human-context ~/.claude/skills/human-context
```

**Claude Code, one project (shared with collaborators who clone the repo):**

```bash
mkdir -p .claude/skills
cp -R human-context .claude/skills/human-context
```

Use the personal location if you will keep any personal context nearby. Project skills are typically committed. The skill itself holds no personal data, so either is safe, but keep your own context files out of shared repos.

**Other Agent Skills clients:** place the `human-context/` directory wherever the client loads skills from. The directory name must stay `human-context` to match the `name` field.

Verify the install by starting a new session and asking, "What skills do you have available?" The exact discovery mechanism varies by client.

## Usage and activation

The skill activates from its `description`, so you normally don't invoke it by name. Typical triggers:

- Stating or changing a preference: "Shorter, please." "Remember I prefer metric." "Stop assuming I want brief answers."
- Giving feedback on how the agent works: "Don't ask so many questions."
- Vault and notes tasks: "Add a note on X to my vault." "Connect this to my existing notes." "What's connected to Project Y?"
- Project review, planning, or synthesis that depends on past decisions and notes.

It is designed *not* to change ordinary self-contained questions (a conversion, a bug fix, a trivia question).

## Persistence

The skill does not give an agent memory. It tells the agent to use whatever authorized mechanism exists (a host memory feature, a file you designate), to save only on request or with consent, to verify what it wrote, and to say plainly when nothing persists. Keep personal context in private, user-level storage. Don't place it in files that are committed to shared repositories.

## The graph script

```bash
node scripts/vault-graph.mjs summary --vault ~/path/to/vault
node scripts/vault-graph.mjs local "Project Note" --depth 2 --vault ~/path/to/vault
```

Read-only; uses only Node built-ins. Commands: `summary`, `notes`, `unresolved`, `orphans`, `backlinks <Note>`, `edges`, `local <Note>`, `fmkeys`, `config`; add `--json` for JSON. It is compiled from `src/vault-graph.mts` in the repository (see the repository README), so edit the TypeScript and rebuild rather than editing the `.mjs`.

## Evaluating

See [references/evaluation.md](references/evaluation.md). To run the runnable cases with Claude Code (real, billed model runs), from this directory:

```bash
claude plugin eval . --allow-tools Write,Edit,Bash --scaffold
```

Behavioral results need human or LLM review; see the scoring notes.

## Limitations

- **No real memory.** Without a host memory mechanism, preferences apply to the session only.
- **No direct access to Obsidian's visual graph.** The graph is reconstructed from files unless an integration exposing real graph data is verified.
- **Link reconstruction is approximate.** `vault-graph.mjs` handles aliases, case, paths, headings, embeds, and Markdown links, but not plugin-defined relationships or Obsidian's exact disambiguation of duplicate names. Results are candidates to verify. Without Node, the agent falls back to its own file search.
- **Judgment-heavy behavior.** Whether personalization feels natural can't be fully checked mechanically.
- **Claude Code specifics are lightly assumed.** The skill avoids depending on optional platform features; verify installation paths against your client's current documentation.
