# Knowledge graphs

Read this when a task depends on how notes connect: finding related knowledge, checking for duplicates or contradictions, summarizing a project's connections, or creating and improving links.

## Contents

- What is actually accessible
- Inspecting an Obsidian graph
- Reconstructing the graph from files
- Grades of relationship evidence
- Using the graph to answer questions
- Building a graph when one is missing
- Maintaining and improving connectivity
- Scoping and audits
- Reporting findings

## What is actually accessible

Obsidian's graph view is a UI rendered from links in the Markdown files. In ordinary file access, you can usually read:

- the **notes** and the links, embeds, properties, tags, and aliases inside them;
- `.obsidian/graph.json`, which holds **graph view settings** (filters, color groups, display forces). It does not contain the edges;
- `.obsidian/community-plugins.json` and `.obsidian/plugins/`, which show which plugins are installed.

You usually cannot read the rendered graph, the live backlinks pane, or plugin APIs unless an integration (a CLI, an MCP server, or the app's own API) is verified to exist in this session. Check before relying on one.

State which of these you did:

- **Read actual graph data** - through a verified integration or export.
- **Reconstructed from files** - parsed links and metadata yourself.
- **Not accessible** - say so.

Never say you "looked at the graph view" unless you did.

## Inspecting an Obsidian graph

1. Confirm it is a vault (`.obsidian/` exists) and note which folder is the root.
2. Read `.obsidian/app.json` for link behavior (`useMarkdownLinks`, `newLinkFormat`). This tells you whether to write `[[wikilinks]]` or Markdown links, and whether paths are shortest, relative, or absolute.
3. Read `.obsidian/graph.json` to learn what the person's graph view hides or colors (for example orphans hidden, or a color group for `path:Projects`). It reveals how they use the graph, but not the connections.
4. Check `community-plugins.json` for relevant plugins (Dataview, Breadcrumbs, graph or canvas plugins). Plugin-defined relationships may live in properties; read them as data. Don't assume a plugin's query language works in your environment.
5. Find indexes, MOCs, and hubs (`type: moc` properties, "MOC" or "Index" in names).
6. Reconstruct the relevant links (below), scoped to the task.

**Global vs local.** Use global structure (MOCs, hubs, tag and folder clusters) to understand broad themes. Use the **local graph**, meaning the notes linked from and to a given note at depth 1, sometimes 2, to investigate one project or topic.

## Reconstructing the graph from files

### Preferred: the bundled script

`scripts/vault-graph.mjs` is a read-only, dependency-free Node script (it uses only `node:` built-ins, and never writes). Check that `node` exists in this environment first; if it doesn't, use the manual fallback below. Run it from the skill directory, or give an absolute path, and point it at the vault with `--vault`:

```bash
node scripts/vault-graph.mjs summary   --vault <vault>   # counts, unresolved targets, orphan candidates
node scripts/vault-graph.mjs unresolved --vault <vault>  # link targets matching no note or alias, with their sources
node scripts/vault-graph.mjs orphans   --vault <vault>   # notes nothing links to (candidates, not defects)
node scripts/vault-graph.mjs backlinks "Event Sourcing" --vault <vault>
node scripts/vault-graph.mjs local "Atlas Migration" --depth 1 --vault <vault>
node scripts/vault-graph.mjs edges     --vault <vault>   # source, target, resolved/unresolved
node scripts/vault-graph.mjs fmkeys    --vault <vault>   # which frontmatter keys the vault actually uses
node scripts/vault-graph.mjs config    --vault <vault>   # link style, plugins, graph.json view settings
```

Add `--json` for machine-readable output. Exit codes: `0` ok, `1` note or vault not found, `2` usage error.

What it handles: `[[Note]]`, `[[Note|alias]]`, `[[Note#Heading]]`, `[[folder/Note]]`, embeds (`![[Note]]`), Markdown links to `.md` files (URL-decoded), links inside frontmatter properties, frontmatter `aliases`, and case-insensitive matching. It ignores links inside code, external URLs, and same-note heading links. `.obsidian/` and other dot-directories are skipped.

What it does not do, so verify by reading the notes:

- It reconstructs from files; it does not read Obsidian's rendered graph or live backlinks pane.
- It doesn't model plugin-defined relationships (Dataview queries, Breadcrumbs fields) or Obsidian's exact path disambiguation when two notes share a name (it lists such names under `ambiguousNames` in `summary`).
- Unresolved and orphan lists are candidates. A note may be deliberately standalone, a template, or a clip.

Quote its method honestly: "reconstructed from files with vault-graph", not "I inspected your graph".

### Manual fallback (no Node)

Use your own file search and read tools. If a shell is available, these approximate the script (run from the vault root in `bash`; case-sensitive, no alias resolution):

```bash
# all link targets with the note that contains them
grep -rnoE '\[\[[^]]+\]\]' --include='*.md' --exclude-dir=.obsidian .
# backlinks to one note
grep -rliE '\[\[Event Sourcing([#|]|\]\])' --include='*.md' --exclude-dir=.obsidian .
```

Then compare targets against note filenames by hand to find unresolved links. Pitfalls: Obsidian matches names case-insensitively and by shortest unique path; `[[Note|text]]`, `[[Note#Heading]]`, and `![[Note]]` all link to `Note`; links in code blocks are not links; frontmatter links are; `aliases` in frontmatter mean `[[ES]]` may resolve with no file named `ES`.

## Grades of relationship evidence

| Grade | Example | How to treat it |
|---|---|---|
| **Documented** | `[[Note]]` link, a `project:` or `supersedes:` property, an MOC entry | Report as a fact about the vault |
| **Structural** | Shared tag, same folder, same date range | Weak evidence. Say "shares a tag", not "related" |
| **Inferred** | Two notes discuss the same concept in different words; a newer decision seems to replace an older one | Label as inferred, cite the text, ask before recording it as a link |

Verify any meaningful relationship against the content before acting on it. Don't assume two notes are connected because they share a tag, sit near each other in a visualization, or mention similar terms.

## Using the graph to answer questions

Use graph evidence to answer questions such as:

- Does this idea already exist? Which note holds it (check aliases and neighbors)?
- Which project does this belong to? Which decisions affect the current task?
- What evidence supports this conclusion? Is it a documented source?
- Are several notes describing the same concept?
- Do older and newer decisions contradict each other? Which is current?
- Which important connections aren't represented?
- Can an existing explanation be reused or linked instead of rewritten?

**Conflicting decisions.** When two notes disagree, compare dates and statuses, then check for an explicit supersession link or property. If none exists, report: what each says, their dates, that the vault has no documented supersession, your inference about which is current and why, and that the project note may be stale. Ask before editing statuses or links. Do not silently pick a winner.

## Building a graph when one is missing

Build one only if no useful graph exists, links are too sparse for the task, or the person asks. Pick the simplest representation that fits, in this order:

1. **Native links** in the person's existing style. Almost always enough.
2. **An MOC or index note** listing related notes with a one-line description each.
3. **Frontmatter properties** following existing keys (for example `project:`, `related:`, `supersedes:`). Create new keys only if none exist.
4. **A Mermaid diagram** in a note for communication or review.
5. **A structured entity-and-relationship file** (CSV, JSON, or YAML edge list), only when the task needs to be machine-processed or the vault isn't Markdown-link based.
6. **A graph database or export pipeline**, only with explicit justification and permission. A small personal vault doesn't need one.

Entities worth modeling when relevant: people, projects and objectives, concepts, resources (notes, articles, books), decisions and their evidence, tasks and milestones, skills and learning goals, findings and open questions.

Relationship vocabulary is illustrative. Reuse the vault's own words first. If you need labels: `relates_to`, `belongs_to_project`, `depends_on`, `supports`, `contradicts`, `derived_from`, `implements`, `supersedes`, `authored_by`. Don't use all of them. Only label what you can support.

Mermaid example for a decision lineage (only as a communication aid, not a replacement for links):

```mermaid
graph LR
  A[2025-03-12 Use Postgres for Atlas] -->|belongs_to_project| P[Atlas Migration]
  B[2025-09-02 Use DynamoDB for Atlas] -->|belongs_to_project| P
  B -.->|supersedes (inferred)| A
```

## Maintaining and improving connectivity

When adding or updating:

1. Search for existing notes and likely duplicates first.
2. Reuse existing note names and link forms.
3. Connect the new note to relevant existing knowledge, both ways when the vault's convention does that.
4. Update an MOC or index when the vault uses them for that topic.
5. Preserve existing metadata and link conventions.
6. Avoid excessive links, artificial relationships, and unneeded notes.
7. Keep sources, decisions, assumptions, and conclusions distinguishable.
8. Flag meaningful contradictions and missing relationships; don't resolve them silently.
9. Explain any substantial organizational change.
10. Ask before destructive changes or broad restructuring.

Prefer small, reversible improvements. Don't reorganize a vault to make the graph look better. To improve connectivity without restructuring, propose a short list of specific additive links, each with a one-line justification and its evidence grade, and add only the ones the person approves.

Opportunities worth surfacing (as observations, not mandates): disconnected but important project notes; duplicate or overlapping concepts; missing links between related research; decisions lacking links to their rationale; conflicting or superseded information; reusable knowledge that could serve several projects; a topic that would benefit from a hub.

**Orphans are not automatically problems.** A note with `standalone: true`, a scratch list, a template, or a clipped source may be deliberately independent. Look at its content and properties first. An orphan that is a decision, a project note, or evidence for a conclusion is more worth flagging than a reading list.

## Scoping and audits

- Scope graph work to the objective. An ordinary question doesn't warrant a vault-wide scan.
- A full-vault audit is expensive and may lead to many changes. Offer it, describe what it would cover, and get a go-ahead. Do the audit read-only and report before changing anything.
- For project review, research synthesis, or planning, inspecting the project's local graph (depth 1-2) and its MOC is usually enough.

## Reporting findings

Structure what you tell the person so grades stay visible:

- **How I looked:** reconstructed from files / read graph data via X / could not access.
- **Documented connections:** the explicit links and properties.
- **Inferred or uncertain:** your readings, with the text that supports them.
- **Gaps and contradictions:** unresolved links, stale statuses, undocumented supersession.
- **Suggested additions:** specific, small, optional.

Example summary for a project's local graph: "Reconstructed from links (I could not open the graph view). Atlas Migration links to Event Sourcing, the Postgres decision, and the Distributed Systems MOC. Two decisions point back to it by property. The DynamoDB decision (Sep 2025) isn't linked from the project note, which still says Postgres. I think DynamoDB supersedes the Postgres choice, since it says it revisits it, but nothing in the vault records that. Want me to propose the edits?"
