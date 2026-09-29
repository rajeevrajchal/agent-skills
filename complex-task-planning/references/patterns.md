# Workflow Patterns

Pick the **simplest shape that reliably solves the task**. Add structure only when a simpler shape has failed or clearly can't work. A single well-informed step (with good context and retrieval) beats a multi-agent system for most tasks.

## Contents
- Selection table
- Single step
- Prompt chain (sequential with gates)
- Routing
- Parallelization: sectioning and voting
- Orchestrator-workers
- Evaluator-optimizer
- Open-ended agent loop
- Delegation: agents as tools vs handoffs
- Guardrails and human-in-the-loop
- Combining patterns

## Selection table

| Task shape | Pattern |
|---|---|
| Answerable in one step with the right context | **Single step** |
| Known sequence of stages, each transforming the previous output | **Prompt chain** with gates between stages |
| Inputs fall into distinct categories that need different handling | **Routing** |
| Independent subtasks known up front | **Parallel sectioning** |
| Confidence matters and diverse attempts help (review, classification, risky judgment) | **Parallel voting** |
| Subtasks can't be known until the problem is inspected (multi-file change, open research) | **Orchestrator-workers** |
| Clear quality criteria and iteration measurably improves the output | **Evaluator-optimizer** |
| Open-ended, the number of steps is unpredictable, the environment gives feedback | **Agent loop** with stopping conditions |
| Irreversible or sensitive actions | Any of the above + **human-in-the-loop checkpoint** |

## Single step

Gather the context (files, search results, examples), then produce the result. Use this whenever it works; it's the fastest and easiest to debug.

## Prompt chain (sequential with gates)

```
Stage A → [gate] → Stage B → [gate] → Stage C
```
Each stage does one thing well. A **gate** is a check between stages (does the outline cover every requirement? does the code compile? does the extracted table have the expected columns?). If a gate fails, fix that stage. Don't pass bad output downstream.

Example: outline → check coverage → draft sections → check tone and facts → final format.

Trade-off: more latency, higher accuracy per stage.

## Routing

Classify the input first, then handle it with the path specialized for that class.

Example: "is this a bug report, a feature request, or a billing question?" → a different procedure, tool set, or skill for each.

Use it when the categories are genuinely distinct and one generic handling would underperform on some of them. Get the classification step right; misrouting is the main failure. Add a fallback route for "unclear".

## Parallelization: sectioning and voting

- **Sectioning**: split independent parts and run them concurrently, then merge. Examples: researching three competitors, reviewing five files, checking security and performance separately.
- **Voting**: run the same task several times, or from several perspectives, and aggregate. Examples: several independent reviews of a risky change, classification with a majority vote.

Requirements: the parts must be truly independent. The merge step is a real task with its own check (conflicts, duplicates, gaps).

## Orchestrator-workers

The orchestrator inspects the problem, decides the subtasks dynamically, delegates them, and synthesizes the results. Unlike sectioning, the subtasks aren't known in advance.

Example: "update every call site of this deprecated API". The orchestrator searches for call sites, groups them, assigns groups, then integrates and runs the tests.

Orchestrator duties: give each worker a self-contained brief (objective, inputs, constraints, expected output format, how to verify), check what comes back, and resolve conflicts between workers. The orchestrator owns final validation.

## Evaluator-optimizer

```
Generate → Evaluate against rubric → (feedback) → Revise → … until pass or budget spent
```
Use it when there are clear criteria (tests, a rubric, a style guide, requirements) and when a reviewer could articulate concrete improvements. Set an iteration cap (2–3 rounds is usually enough). Stop when the evaluator's feedback turns cosmetic.

An evaluator is most useful when it's **independent**: different instructions, no stake in the draft, and ideally ground truth such as tests or sources.

## Open-ended agent loop

```
Plan → act with tool → observe environment → update plan → … → stop condition
```
For problems where the path can't be predicted. It needs:
- **Ground truth each step**: tool results, test output, and page state, not self-assessment.
- **Stopping conditions**: a success check, an iteration or budget cap, and "blocked, needs human".
- **Checkpoints** at meaningful milestones or blockers.

It's more autonomous and more error-prone. Compounding mistakes are the main risk, so validate often.

## Delegation: agents as tools vs handoffs

- **Agent as tool (subagent)**: the main agent delegates a bounded task and gets a result back. It keeps ownership of the conversation and the final answer. Use it for parallel research, context isolation (a large search whose details the main thread doesn't need), and specialized procedures.
- **Handoff**: control transfers to a specialist that continues with the user. Use it when the rest of the interaction belongs to that specialty.

Delegate only when isolation or parallel breadth outweighs the cost: every subagent starts cold, needs a complete brief, and returns a summary that the main agent must verify. Don't delegate a task that's faster to do directly.

**Brief template for a subagent or worker:**
```
Objective: <one sentence>
Context: <facts it needs; paths, ids, constraints>
Do: <scope>. Don't: <out-of-scope, forbidden actions>
Output: <exact format, e.g. table with columns …>
Done when: <check>
```

## Guardrails and human-in-the-loop

- **Input guardrails**: validate cheaply before expensive work (is the file the expected type? is the request in scope? are the required inputs present?). Fail fast with a clear message.
- **Output guardrails**: check the result before it leaves (no secrets or PII, format valid, claims sourced).
- **Human checkpoints** before actions that are irreversible, externally visible, or costly: sending messages, payments, deleting data, deploying, force-pushing, bulk edits. Present exactly what will happen, then wait. Skip the checkpoint only when the user has explicitly authorized that specific action.

## Combining patterns

Real tasks combine patterns. Example, a research report:
routing (what kind of question?) → parallel sectioning (search sub-questions) → chain (synthesize → draft) → evaluator (check claims against sources) → human checkpoint (only if it'll be published).

Keep every layer justified. If you can't say what a layer adds, remove it.
