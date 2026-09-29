# Decomposition

## Contents
- Procedure
- The leaf test and granularity
- Dependency types
- Finding parallel work
- Discovery vs action tasks
- Vertical slices
- Progressive decomposition
- Anti-patterns
- Good vs bad breakdowns

## Procedure

1. Write the objective as one concrete sentence, plus its success criteria.
2. List 3–7 top-level tasks that together achieve the objective. Ask of each: "if this didn't happen, would the objective fail?" If not, cut it.
3. Apply the leaf test to each task. Split only the ones that fail.
4. For each task, name its **input** and its **output** as nouns ("list of repo fields available from the API", "working `RepoTable` component").
5. Draw the dependencies: task B depends on A if B needs A's output, or needs A's side effect to have happened.
6. Group the tasks into waves. Every task whose dependencies are satisfied belongs to the next wave.
7. Mark checkpoints and irreversible steps.

## The leaf test and granularity

A task is a leaf (ready to execute) when it:
- is **one action** that can be described with one verb ("fetch", "write", "compare", "render", "migrate"),
- uses **at most one kind of tool** (or none),
- produces a **concrete, inspectable output**,
- has a **check** that can tell success from failure,
- is **cheap to redo** if the check fails.

| Granularity | Symptom | Fix |
|---|---|---|
| Too coarse | "Implement the backend": unclear where to start, impossible to check | Split by output (endpoints, schema, auth) or by vertical slice |
| Too fine | "Open file", "read line 3", "close file": coordination costs more than the work | Merge into one leaf ("update config value X in `app.config.ts`") |
| Right | "Add `GET /repos` handler returning `{name, stars, updatedAt}`; test with the fixture" | — |

No fixed depth applies to every task. One task may need three levels of breakdown while its sibling is already a leaf.

## Dependency types

- **Data**: B consumes A's output (the schema before the queries).
- **State/side effect**: B needs the world changed by A (install a package before importing it; create a branch before committing).
- **Decision**: B's design depends on what A reveals (API rate limits decide the caching strategy). These are the dependencies most often missed, and they're why discovery goes first.
- **Resource**: A and B compete for the same thing (the same file, the same rate-limited API, the same user attention). Serialize them even if their data is independent.

Record dependencies explicitly. An assumed order is where out-of-order execution bugs come from.

## Finding parallel work

Candidates for running in parallel:
- Independent lookups (search three sources, read four files).
- Sibling components that share only an interface agreed in advance.
- Multiple perspectives on the same question (sectioning or voting; see `patterns.md`).

Don't parallelize when:
- The tasks write to the same file or state (merge conflicts, races).
- One task's result is likely to change what the other should do.
- Coordinating and merging the results costs more than running them one after another. For two tiny tasks, just do them in sequence.

## Discovery vs action tasks

- **Discovery** tasks read, search, measure, or inspect. They're cheap, safe, and reshape the plan. Run them early and in parallel.
- **Action** tasks write, change, send, or deploy. They depend on discovery and sometimes can't be undone.

A plan that interleaves "decide" and "act" before the relevant facts are known is a plan that will need replanning.

## Vertical slices

For anything that gets built (apps, pipelines, documents):
1. **Thinnest end-to-end slice**: the smallest version that runs from input to output (one API call → one list rendered; one data file → one number; one section drafted in the final format).
2. Verify the slice.
3. Widen it one capability at a time, verifying after each addition.

This finds integration problems (auth, data shape, build config, format) at the start, when fixing them is cheapest. It also makes every intermediate state demonstrable.

## Progressive decomposition

Don't plan in detail past what you can see. It's fine for a plan to contain:

```
T1 Inspect data files (discover)
T2 Decide cleaning steps based on T1  ← decomposed after T1 runs
T3 Compute metrics
```

Decompose a node further when its inputs become known. Writing detailed steps for T2 before T1 has run is guessing.

## Anti-patterns

- **Ceremony**: a nine-task plan for a two-minute job.
- **Hidden dependency**: tasks treated as parallel when one's result changes the other.
- **Frozen plan**: the first breakdown kept after evidence shows it's wrong.
- **Fixed depth**: every branch decomposed to the same depth whether it needs it or not.
- **Horizontal layers**: all the backend, then all the frontend, then the first integration test. Problems surface late.
- **Unowned glue**: no task for integration, merging results, or final validation.
- **Scope creep**: tasks that serve a nice-to-have rather than the objective.

## Good vs bad breakdowns

**Request:** "Summarize our Q3 support tickets and suggest the top three fixes."

Bad (horizontal, no discovery, no checks):
```
1. Analyze tickets
2. Write summary
3. Suggest fixes
```

Good:
```
T1 Locate ticket data: which system, export or connector, date range = Q3        [discover; tool: connector/file]
T2 Pull Q3 tickets into a file (id, created, category, product, text)             [tool: connector → CSV]  dep: T1
T3 Profile the data: counts, missing categories, duplicates                       [tool: code]             dep: T2
   ↳ checkpoint: if categories are unreliable, add T3b: cluster by text           [replan point]
T4 Rank themes by volume and by customer impact                                   [tool: code]             dep: T3
T5 For the top themes, read 5–10 representative tickets each                      [tool: file read]        dep: T4
T6 Draft summary + three fixes, each tied to evidence (counts, example ids)       [no tool]                dep: T4, T5
T7 Validate: numbers recomputed, every fix traceable to a theme                   [tool: code]             dep: T6
```
