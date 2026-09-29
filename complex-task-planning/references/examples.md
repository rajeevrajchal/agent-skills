# Worked Examples

Each example shows the triage decision, how the task was broken down, which tasks need tools and which don't, and where replanning or validation changed the outcome.

## Contents
1. React GitHub dashboard (Full)
2. A request that should NOT be decomposed (Direct)
3. Research question with conflicting sources (Full, parallel)
4. Data analysis where discovery forces a replan (Full)
5. Bug fix where the first hypothesis is wrong (Light → Full)

---

## 1. React GitHub dashboard (Full)

> "Build me a React dashboard that fetches GitHub repository data, displays repository statistics, and lets me filter repositories."

**Triage: Full.** It has several deliverables (fetching, stats, filtering), external API constraints, and design decisions that depend on facts not yet known.

**Understand**
- Objective: a working dashboard in which the user can see their repositories' key stats and narrow the list down.
- Success criteria:
  1. Loads the repositories for a given user or org.
  2. Shows per-repo stats (stars, forks, open issues, language, last push) plus totals.
  3. Filters by language and name, and sorts by stars or last push.
  4. Handles the loading, empty, error, and rate-limit states.
- Ambiguities and decisions:
  - *Whose repos, public or private?* → **Ask.** It changes the architecture: private repos need a token, and a token must never ship inside a client bundle (it would need a small backend proxy or a token the user supplies). Offer a default: "public repos for a username, no backend".
  - *Stack details* (Vite vs Next, styling) → **Assume** Vite + React + TypeScript unless the repo already has a setup. **Look up** the existing project config first if there is one.
- Edge cases: a user with more than 100 repos (pagination), the unauthenticated rate limit (60 requests/hour), archived repos, and repos with no language.

**Decompose** (checked against the leaf test; discovery before action)
```
Goal: React GitHub repository dashboard
├── T1 Check workspace: existing project? package manager? conventions?     [discover | tool: file search/read]
├── T2 Confirm GitHub REST details: endpoint, fields, pagination, limits   [discover | tool: web fetch of GitHub docs]
├── T3 Decide data layer (fetch + pagination + cache; token strategy)       [analyze | no tool; depends T2 + user answer]
├── T4 Scaffold app (if T1 found none)                                      [act | tool: shell]
├── T5 Thin slice: fetch page 1 for a username → render names in a list    [act | tools: editor + dev server]  ← first checkpoint
├── T6 API layer: pagination, error + rate-limit handling, typed model      [act | editor; test with fixtures]
├── T7 Statistics: per-repo columns + totals summary                        [act | editor]
├── T8 Filters & sort: language, name search, sort key; derived state       [act | editor]
├── T9 States: loading, empty, error, rate-limited                          [act | editor]
├── T10 Tests: API errors, empty list, filtering logic                      [act | tool: test runner]
└── T11 Validate against success criteria in the browser                    [check | tools: dev server + browser/screenshot]
```

**Which parts need tools**
- No tool: requirement analysis (T3 reasoning), component and state design, writing the filter logic.
- Tools needed: T1 (the workspace facts only exist on disk), T2 (API limits and fields change, so check the current docs instead of relying on memory), T4–T10 (writing and running code), T11 (rendering is the only reliable way to validate UI).

**Plan**
```
T1 ─┐
T2 ─┼→ T3 → (T4) → T5 ─→ T6 ─┬→ T7 ─┐
    │                        └→ T8 ─┼→ T9 → T10 → T11
 user answer ┘                                  
```
- Wave 1: T1 and T2 in parallel (both are read-only discovery), while waiting for the user's answer on public vs private.
- Checkpoint after T5: the end-to-end path works (fetch → render) before any breadth is added.
- T7 and T8 can run in parallel: both consume the typed repo model from T6, and neither changes it.
- Fallback: if the rate limit makes development painful, use a fixture JSON file for UI work and hit the API only in the integration check.

**Execution notes**
- T2 observation: per-page maximum is 100 and results are paginated → T6 adds a pagination loop. The plan anticipated this, so it's a local detail, not a replan.
- If the user answers "private repos too": **replan** T3 and T6. Add a tiny backend proxy (or a user-supplied token kept only in memory), update the success criteria, and tell the user about the added scope.

**Validate**: run the tests; in the browser, load a username with more than 100 repos and one with 0; simulate a 403 rate-limit response; check each success criterion against what's on screen.

**Complete**: deliver the code, how to run it, the decisions made (public-only, no token), and the known limits (60 requests/hour unauthenticated).

---

## 2. A request that should NOT be decomposed (Direct)

> "Rename the `getUser` function to `fetchUser` in `api.ts`."

**Triage: Direct**, with one caveat to check: are there call sites in other files? That's a single search, not a plan.

Action: search for `getUser` across the repo, rename the definition and every call site, then run the type-check. Done.

What would be wrong: writing out Understand/Decompose/Analyze sections, a dependency graph, or a subagent. The overhead would exceed the work several times over.

---

## 3. Research question with conflicting sources (Full, parallel)

> "What are the current data-residency options for storing EU customer data with our three shortlisted cloud vendors, and which fits our constraints best?"

**Triage: Full.** It needs current facts (these change often), three independent lookups, a synthesis, and a recommendation the user will act on.

**Understand**: the constraints come from the user ("EU-only storage and processing; managed Postgres needed"). Success criteria: for each vendor, list the EU regions, the residency guarantees for managed Postgres, and whether support or telemetry leaves the EU, each with a primary source; then give a recommendation tied to the constraints.

**Decompose and plan**
```
T1 Vendor A: regions + residency docs for managed Postgres     [web search → fetch primary docs]  ┐
T2 Vendor B: same                                               [web search → fetch]               ├ parallel (sectioning)
T3 Vendor C: same                                               [web search → fetch]               ┘
T4 Normalize into comparison table (same fields for all)        [no tool]           dep: T1–T3
T5 Check conflicts/gaps; resolve with primary source or flag    [fetch]             dep: T4
T6 Recommendation mapped to constraints                         [no tool]           dep: T5
T7 Validate: every cell sourced + dated; constraint mapping ok  [re-read sources]   dep: T6
```

**Replan moment**: at T5, one vendor's marketing page says "data stays in the EU" but its service-specific terms exclude support access. Resolution: prefer the primary legal or service documentation, record both, and flag it. The recommendation now includes a caveat, and the user is told that the legal wording should be confirmed by their counsel.

**Tools**: search and fetch are mandatory here, because answering residency questions from memory is guessing. No tool is needed for the normalization and recommendation reasoning.

---

## 4. Data analysis where discovery forces a replan (Full)

> "From the attached sales export, tell me which product lines are declining and why."

**Initial plan**
```
T1 Load and profile the file (columns, types, date range, nulls)   [code]
T2 Monthly revenue per product line                                  [code]   dep: T1
T3 Identify declining lines (trend over the last 6 months)           [code]   dep: T2
T4 Explain drivers (price vs volume vs region)                       [code]   dep: T3
T5 Write findings with charts                                        [code + writing]
T6 Validate: totals reconcile with the file; charts match tables     [code]
```

**Observation at T1**: product lines were renamed in March (`Pro Series` → `Pro`), and currency is mixed (EUR and DKK) in the same column.

**Replan** (only the affected subtree):
- Add T1b: map old line names to new ones. **Ask** the user to confirm the mapping, because the analysis depends on it. Meanwhile, proceed with the obvious mapping and flag it.
- Add T1c: convert to a single currency using the file's own FX column if present. Otherwise **ask**, or state the rate and its source.
- T2–T6 unchanged in intent, now running on the cleaned data.

Without the replan, the analysis would have reported `Pro Series` as collapsing to zero in March. That's a confident, wrong finding.

**Validate**: revenue totals before and after cleaning reconcile (except for the documented currency conversion); each "declining" claim has the numbers behind it; the "why" is labelled as correlation (price/volume/region split), not proven causation.

---

## 5. Bug fix where the first hypothesis is wrong (Light → Full)

> "Users say the checkout button sometimes does nothing."

**Triage: Light at first.** Reproduce, find the cause, fix, test.

**Execution**
1. Reproduce: the button works locally. Check the error logs → intermittent `409 Conflict` from the payment-intent endpoint.
2. Hypothesis 1: a double-submit race → add a disabled state while pending. **Observe**: the 409s continue in staging under load.
3. That's two attempts in the same area without resolution → **escalate the triage to Full** instead of trying hypothesis 3 blindly:

```
T1 Collect evidence: logs with request ids, timing, affected users       [log search tool]
T2 Read the payment-intent handler + idempotency key generation          [file read]
T3 Form hypotheses ranked by evidence                                     [no tool]
T4 Write a failing test reproducing the top hypothesis                    [test runner]
T5 Fix → T4 passes → full suite passes                                    [editor + tests]
T6 Verify in staging under load                                           [load tool / staging]
```
T2 reveals the idempotency key is generated per render rather than per checkout attempt. Re-renders during the pending state create a new key, so the server sees a conflicting intent. The fix goes to the key's lifecycle. The disabled state from hypothesis 1 stays as a UX improvement, but it's reported as not being the root cause.

**Lesson built into the skill**: the thrashing guard (two failed attempts → step back, gather evidence, replan) turned guessing into diagnosis.
