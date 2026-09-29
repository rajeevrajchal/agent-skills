# Plan Template

Use this for Full-level tasks. Keep it short. The plan serves execution; it isn't a deliverable, unless the user asked for a plan.

## Markdown form

```md
## Objective
<one sentence: the outcome the user wants>

## Success criteria
1. <checkable statement>
2. …

## Constraints & preferences
- <constraint>

## Assumptions (to confirm or disclose)
- <assumption> — <how/when it will be checked>

## Open questions
- <question for the user> — default if unanswered: <default>

## Tasks
| ID | Task (one verb) | Needs | Produces | Tool | Depends on | Check |
|----|-----------------|-------|----------|------|------------|-------|
| T1 | … | … | … | … | — | … |

## Order
Wave 1: T1, T2 (parallel)
Wave 2: T3
…

## Checkpoints
- After T_: <what decision>
- Before T_ (irreversible): <user approval>

## Risks & fallbacks
- <risk> → <fallback>

## Budget / stop conditions
- Retries per operation: 2. Evaluator rounds: 2. Stop and escalate if: <condition>.
```

## JSON form (for `scripts/check_plan.py`)

This is an excerpt: a full plan would add the remaining tasks and a final `check` task. Run as-is, the checker correctly warns that SC2–SC4 aren't covered and that there's no validation task.

```json
{
  "objective": "Working React dashboard for a user's public GitHub repos with stats and filters",
  "success_criteria": [
    "SC1: loads repos for a username, including >100 repos",
    "SC2: shows stars, forks, open issues, language, last push, and totals",
    "SC3: filter by language and name; sort by stars or last push",
    "SC4: loading, empty, error and rate-limit states"
  ],
  "tasks": [
    { "id": "T1", "task": "Inspect workspace for existing project", "kind": "discover", "tool": "file-read",
      "depends_on": [], "produces": "project facts", "check": "stack + package manager identified" },
    { "id": "T2", "task": "Confirm GitHub REST repo endpoint, fields, pagination, limits", "kind": "discover", "tool": "web-fetch",
      "depends_on": [], "produces": "API notes", "check": "fields and per-page max confirmed from docs" },
    { "id": "T5", "task": "Thin slice: fetch page 1 and render names", "kind": "act", "tool": "editor",
      "depends_on": ["T1", "T2"], "produces": "running slice", "check": "names render for a known user", "checkpoint": true,
      "criteria": ["SC1"] }
  ]
}
```

Fields: `id`, `task`, and `depends_on` are required. `kind` is `discover`, `act`, or `check`. `irreversible: true` marks a task that needs approval. `checkpoint: true` marks a pause point. `criteria` lists which success criteria the task serves; the checker warns about criteria that no task covers.
