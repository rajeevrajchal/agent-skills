---
name: complex-task-planning
description: Turn a complex, multi-step, or ambiguous request into a solved problem through structured understanding, task decomposition, approach and tool selection, a dependency-aware plan, observed execution, adaptive replanning, and validation. Use when a request has several deliverables or stages, depends on information that must be gathered first, spans multiple tools or files, can't be fully specified up front, involves irreversible or expensive actions, or when an earlier attempt failed or went off track. Examples include building an app or feature end to end, research with synthesis, multi-file refactors, data analysis pipelines, migrations, and multi-part documents. Don't use it for single-step questions or edits that can be answered or done directly.
license: MIT
metadata:
  version: "1.0"
  inspired-by: "Anthropic 'Building Effective Agents' and 'Writing Effective Tools for Agents'; LangChain plan-and-execute / ReWOO / LLMCompiler; OpenAI Agents SDK agent patterns"
---

# Complex Task Planning

The goal is the user's outcome, not an elaborate process. Plan exactly as much as the task needs: a simple task stays simple, and a complex one gets structure before action.

```
REQUEST → TRIAGE → UNDERSTAND → DECOMPOSE → ANALYZE → SELECT TOOLS → PLAN
        → EXECUTE ⇄ OBSERVE ─ok→ VALIDATE → COMPLETE
                       └─off-track→ REPLAN ─┘
```

## 0. Triage first: how much process does this need?

Decide in seconds, before anything else:

| Level | Signals | What to do |
|---|---|---|
| **Direct** | One clear step; the answer is known or needs one lookup; cheap to redo | Do it. No written plan. Still check the result |
| **Light** | 2–5 steps in an obvious order; low risk | A mental or one-line plan ("read X → change Y → run tests"). Execute, observe each step, validate |
| **Full** | Several deliverables; unknowns that must be resolved first; parallelizable parts; multiple tools; irreversible or expensive actions; long-running; a previous attempt failed | Run the whole workflow below and write the plan down (`assets/plan-template.md`) |

Move up a level as soon as execution reveals hidden complexity. Most requests are Direct or Light. Running the full workflow on a simple task is a failure mode, not diligence.

## 1. Understand

Establish what the user is **actually trying to achieve**, not just the literal words.

- **Objective**: the outcome in one sentence ("a dashboard the user can use to spot inactive repos", not "React code").
- **Success criteria**: 2–5 concrete, checkable statements of done. Validation (§8) checks exactly these.
- **Deliverable and format**: file type, location, length, audience.
- **Requirements vs preferences vs assumptions**: keep them in separate lists. Assumptions are candidates for validation.
- **Constraints**: time, budget, stack, permissions, data access, style rules, things that must not change.
- **Available context**: attached files, repo, connected tools, prior conversation, memory.
- **Unknowns and ambiguities**: for each, decide whether to *ask* or *assume*:
  - **Ask** when a wrong guess is expensive to undo and the options genuinely diverge (scope, target platform, destructive actions, or anything the user owns the decision on). Ask once, batch the questions, and offer options with a recommended default.
  - **Assume** when a wrong guess is cheap to fix or there's a conventional default. State the assumption in one line and move on.
  - **Look it up** when the answer exists in the files, the codebase, or the environment. Don't ask the user for facts you can find.
- **Edge cases** that would change the design (empty data, failures, limits, permissions, scale).

If the objective still isn't clear after this, don't decompose yet. Clarify first.

## 2. Decompose

Break the objective into tasks until every **leaf** passes the leaf test:

> A leaf has **one clear action**, needs **at most one kind of tool**, produces a **concrete output**, has a **way to check** that output, and is **cheap to redo** if it's wrong.

For each task, record: *what*, *why it's needed*, *inputs it needs*, *the output it produces*, *which tasks it depends on*, and *whether it can run in parallel*.

Rules:
- 3–7 top-level tasks is usually right. Decompose further only where a task fails the leaf test.
- Remove any task you can't justify with "the objective needs this because…".
- Keep separate the tasks that **discover** information (read, search, measure) and the tasks that **act** on it (write, change, send). Discovery comes first and often reshapes the rest of the plan.
- Prefer **vertical slices** for build tasks: get a thin end-to-end version working first, then widen it. Don't finish layer A completely before layer B exists.
- Don't decompose further than you can see. Leave "implement remaining features based on findings" as one node until the discovery tasks have run.

Details and worked granularity examples: `references/decomposition.md`.

## 3. Analyze

For each non-trivial task:
- **Complexity and risk**: what could go wrong, and how bad would it be? Is it reversible?
- **Approaches**: when more than one is plausible, compare them briefly on reliability, simplicity, cost/latency, and fit with the user's constraints. Pick one and note the runner-up as the fallback.
- **Validation**: how will you know this task succeeded? (Tests pass, the number reconciles, the source confirms, the page renders.)
- **Workflow shape**: which pattern fits? Fixed chain, routing, parallel sections, orchestrator-workers, evaluator loop, or an open-ended agent loop. See `references/patterns.md`. Use the simplest shape that works.

## 4. Select tools

For each task, ask: **what's the least expensive tool that produces a trustworthy result?**

| Need | Default |
|---|---|
| Stable knowledge (concepts, syntax, well-known facts) | No tool. Answer directly |
| Current or changing facts (prices, versions, officeholders, docs) | Web search, then fetch the primary source |
| The user's own data (email, docs, tickets, CRM) | The connected app or connector for that data |
| Files and code in the workspace | File search and read. Read only the parts you need |
| Computation, data transformation, counting, checking | Code execution. Never do arithmetic on large data "in your head" |
| A website that needs clicks, forms, or login | Browser automation (after trying fetch/API) |
| Verifying a change | The project's own tests, build, or linters, or a rendered check |
| A domain procedure someone has packaged | The matching skill. Load it before starting that task |
| Wide, independent research, or context isolation | Subagents or parallel workers, only when the breadth justifies the overhead |
| Irreversible or external side effects (send, pay, delete, deploy) | The tool, **after** a human checkpoint unless the user already authorized it |

Tool hygiene: use narrow queries and filters before broad dumps, and save large results to files to process with code rather than paging through them in context. Read error messages; they usually say what to change. Don't call a tool to confirm what you already know with certainty, and don't skip a tool for facts that may have changed. Full guide: `references/tool-selection.md`.

## 5. Plan

Turn the tasks into an execution order:

```
T1 Understand data source ──┐
T2 Scaffold app ────────────┼─→ T4 Thin slice end-to-end ─→ T5 Stats ─┐
T3 Confirm API auth/limits ─┘                               T6 Filters ┴→ T7 Validate
```

The plan identifies:
- **Order and parallelism**: tasks with no unmet dependencies can run together (wave 1, wave 2…).
- **Inputs and outputs** per task, so each task's output is a named thing the next task consumes.
- **Checkpoints**: after discovery (does this change the plan?), before irreversible actions (does the user approve?), and after the first working slice.
- **Fallbacks** for the riskiest tasks.
- **Budget and stopping conditions**: maximum retries per task (default 2), and when to stop and report instead of pushing on.

For Full-level tasks, write the plan using `assets/plan-template.md`. Validate its structure with `node scripts/check_plan.mjs plan.json`, which catches missing dependencies and cycles, shows the parallel waves, and flags tasks with no checks. When the user is present and the plan is expensive or irreversible, share a short version before executing. Otherwise start, and state the plan in one or two lines.

## 6. Execute and observe

Execute in plan order, running independent tasks in parallel. After every **meaningful** operation:

1. **Observe**: read the actual result (output, error, diff, rendered page), not what you expected it to say.
2. **Compare** it to the task's expected output and check.
3. **Decide**:
   - **Continue**: the result matches.
   - **Retry**: a transient failure (timeout, rate limit, flaky test). Change something (wait, narrow the query, fix the input). Never repeat an identical failing call more than once.
   - **Repair locally**: the task failed but the plan still holds. Fix it within the task.
   - **Replan** (§7): the result invalidates an assumption, a dependency, or the approach.
   - **Escalate**: blocked on something only the user can resolve (access, a decision, contradictory requirements). Report what you tried, what you found, and the options.

Never keep executing a plan whose assumptions the latest result has contradicted. Details: `references/execution-and-replanning.md`.

## 7. Replan when necessary

Triggers: unexpected results, a tool failure with no workaround, missing information, new requirements from the user, discovery tasks that change the picture, or a budget overrun.

```
Result → What changed? → Which assumptions and tasks does it invalidate?
       → Update the task list (add / drop / reorder) → Re-check dependencies → Continue
```

- **Scope the replan.** Repair only the affected subtree. Completed, still-valid work is kept.
- **Never silently change the goal.** If the objective, deliverable, or success criteria must change, tell the user and get agreement when they're present. When unattended, state the change prominently in the result.
- **Watch for thrashing.** If you've replanned the same area twice without progress, stop and escalate with the evidence instead of trying a third variation.

## 8. Validate

Validate against the success criteria from §1, not against "the steps ran":

- [ ] Every success criterion is met, with evidence (test output, a source, a recomputed number, a rendered view).
- [ ] Every requirement and constraint is respected. Nothing out of scope was changed.
- [ ] Assumptions made along the way are either confirmed or explicitly listed in the output.
- [ ] Tool results were interpreted correctly (re-read the key ones, check units, dates, and filters).
- [ ] No planned task was skipped. No leftover placeholders, TODOs, or debug artifacts.
- [ ] The output matches the requested format and destination.

Match the depth of validation to the stakes. For high-stakes output, check it independently: run it, recompute it, or have a separate evaluator pass review it against a rubric. Strategies by output type: `references/validation.md`.

## 9. Complete

- Deliver the result in the requested format.
- Summarize briefly: what was produced, key findings or decisions, assumptions, and limitations or anything left undone. Don't narrate every step or expose raw internal reasoning. Give a concise account of the approach only when it helps the user trust or use the result.
- Offer at most one natural next step.

## Decision rules (quick reference)

1. **Understand before acting.** A wrong start costs more than a minute of analysis.
2. **Don't over-decompose.** Stop at the leaf test. A plan longer than the work is waste.
3. **Tools serve tasks.** No tool without a reason, and no guessing when a tool would tell you.
4. **Discover, then commit.** Resolve unknowns before acting on them. Dependencies go first.
5. **Parallelize independent work**, but only when the coordination overhead is smaller than the time saved.
6. **The plan is a hypothesis.** Update it when evidence contradicts it.
7. **Success means the result is verified,** not that execution finished.
8. **Pause before irreversible actions** unless they're clearly authorized.
9. **Escalate instead of thrashing.** Two failed attempts in the same area is a signal to stop.
10. **Optimize for the user's goal,** not for the appearance of a thorough process.

## Worked examples

`references/examples.md` has five examples: a React GitHub dashboard (full plan, showing which tasks need tools), a simple request that should *not* be decomposed, a research question with parallel search and conflicting sources, a data analysis where discovery forces a replan, and a bug fix where the first hypothesis turns out wrong.

## Reference map

| Read | When |
|---|---|
| `references/decomposition.md` | Breaking down a Full-level task; unsure about granularity or dependencies |
| `references/patterns.md` | Choosing a workflow shape: chain, routing, parallel, orchestrator-workers, evaluator loop, agent loop, human-in-the-loop |
| `references/tool-selection.md` | Unsure which tool fits; large outputs; tool failures; delegating to subagents |
| `references/execution-and-replanning.md` | During execution: retry rules, replanning scope, budgets, escalation format |
| `references/validation.md` | Before completing: checks by output type, evaluator rubrics |
| `references/examples.md` | Calibrating how much to plan; end-to-end examples |
| `assets/plan-template.md` | Writing a Full-level plan (Markdown and JSON forms) |
| `scripts/check_plan.mjs` | Checking a JSON plan for cycles, missing dependencies, parallel waves, and missing checks |
