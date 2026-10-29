# Working in a second brain

Read this before creating, editing, organizing, or connecting notes and project documents in a person's knowledge system.

## Contents

- Access: what can you actually reach?
- Step 1: inspect the system
- Step 2: learn the conventions
- Step 3: look for existing coverage
- Step 4: decide: update, link, or create
- Step 5: write in the existing style
- Step 6: connect and report
- Permission gates
- Project documentation
- When the system is not accessible

## Access: what can you actually reach?

Before anything, establish what you can use. Candidates: filesystem or terminal access to a vault or repo; an application integration or MCP server; an authorized API; or only what the person pasted. Verify each before depending on it. Don't assume an Obsidian plugin, CLI, or integration is installed, or that every system is on the filesystem. If the relevant system is unreachable, say so and offer a fallback (paste the note, export, give a path).

## Step 1: inspect the system

1. Identify the relevant vault, directory, or knowledge base. If the person's working directory contains `.obsidian/`, it is an Obsidian vault. If several candidates exist and it matters, ask once.
2. List the top-level structure and the folder where the new or changed note would live. Don't read the whole vault; scope to the task.
3. Read a few representative existing notes of the same kind (two or three beats one).
4. Check for an index, MOC, or hub covering the topic, and for template folders.

## Step 2: learn the conventions

Capture, from evidence in the files rather than assumption:

| Aspect | Look at |
|---|---|
| Folder logic | By type, by project, by date, by PARA-like area, or flat |
| Naming | Title Case, kebab-case, date prefixes (`2025-09-02 ...`), ID prefixes, singular or plural |
| Frontmatter | Keys in use (`type`, `status`, `tags`, `created`, `aliases`, project links), value formats, ordering |
| Link style | `[[wikilinks]]`, Markdown links, aliases `[[Note\|text]]`, heading links, embeds |
| Tags | Inline `#tag` vs frontmatter, hierarchy (`#area/topic`), how consistently used |
| Structure | Standard headings, summary at top, "Related" section, decision-record layout |
| Templates | A template for this note type, and whether notes actually follow it |
| Voice | Terse fragments vs full prose, person, level of formality, language |

Conventions are inferred from the files. If they conflict across the vault, prefer the convention in the same folder or note type, and the more recent notes, and say which you followed.

## Step 3: look for existing coverage

Avoid creating a second source of truth.

- Search note titles and aliases for the concept and obvious variants (singular/plural, acronyms, older names).
- Search content for key terms; read the hits, don't judge by filename.
- Check the relevant MOC and the project note's links.
- Look for a superseded or archived version before concluding a topic is missing.

See [knowledge-graph.md](knowledge-graph.md) for search and link recipes.

## Step 4: decide: update, link, or create

| Finding | Action |
|---|---|
| A note already covers it | Update that note (smallest coherent change) or link to it; don't create a duplicate |
| A partial or adjacent note exists | Extend it if the scope fits, otherwise create a new note and link both ways |
| Two notes overlap | Flag the overlap; propose a merge but don't perform it without permission |
| Nothing exists | Create a note in the right place, from the right template, linked into the graph |
| The right home is unclear | Pick the most conventional location, state it, and make it easy to move |

Also decide the note's status: permanent knowledge, a working note, or temporary project material. That determines the folder (an inbox or scratch area for working notes) and how much to connect it.

## Step 5: write in the existing style

- Reuse the template if one fits, and keep its headings and metadata keys.
- Use existing tag names and property keys. Don't introduce parallel ones.
- Preserve the person's voice in edits; match their sentence length and formality.
- Make minimal edits to existing notes. Don't reformat or reorganize a note you were only asked to extend.
- Keep sources, decisions, assumptions, and conclusions distinguishable (separate sections, explicit labels).
- Don't add frameworks, plugins, or new metadata schemes without a clear, stated benefit.

## Step 6: connect and report

- Link the new note to the notes and project it truly relates to, using existing link style and names.
- Update the relevant MOC or index only if that is how this vault works, and with one line in the established format.
- Avoid link spam: a few meaningful links beat a dozen weak ones.
- Tell the person what you created or changed, where, what you linked, and anything you noticed but did not change (contradictions, duplicates, missing links).

## Permission gates

Ask before doing any of these:

- Deleting, renaming, moving, merging, or archiving notes (renames can break links).
- Bulk edits across many notes, or reorganizing folders, tags, or properties.
- Introducing a new template, schema, or plugin dependency.
- A full-vault audit or graph-wide changes. Offer a scoped version first.
- Writing personal context into any file that is shared, synced to others, or committed.
- Anything touching notes that appear sensitive or private.

For substantial changes, show a short plan or a diff-style summary first. Prefer reversibility: additive edits, a proposed-changes note, or a patch the person can review.

## Project documentation

Before changing a project's plan or docs, find the project's goals, specs, decision records, task lists, known issues, and earlier experiments. Distinguish:

- **Intended:** described in a plan or spec.
- **Implemented:** present in the code or system.
- **Verified:** tested or confirmed.

Don't mark work done because a document says it was planned. Update status only to what you can establish. Keep the existing structure and make the smallest coherent change that leaves the project understandable. Link decisions to their rationale and, when a decision replaces an earlier one, record that relationship in the person's existing convention (see supersession in [knowledge-graph.md](knowledge-graph.md)).

## When the system is not accessible

- State what you could not reach and why, in one sentence.
- Don't reconstruct the contents from guesswork or present assumptions as findings.
- Offer a workable fallback: ask them to paste the relevant notes, describe the conventions, or point to an exported folder.
- If they want a deliverable anyway, produce it as a clearly labeled draft with the conventions you assumed.
