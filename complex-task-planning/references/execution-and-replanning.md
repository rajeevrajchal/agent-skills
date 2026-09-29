# Execution and Replanning

## Contents
- The observe loop
- Expected-output contracts
- Retry policy
- Local repair vs replan
- Replanning procedure
- Budgets and stopping conditions
- Checkpoints
- Escalation format
- Keeping the user informed

## The observe loop

After each meaningful operation (not after every trivial read):

```
Act → Observe actual result → Compare with expected → Decide
                                                     ├─ continue
                                                     ├─ retry (transient)
                                                     ├─ repair locally
                                                     ├─ replan
                                                     └─ escalate
```

"Meaningful" means any operation whose result feeds a decision, changes state, or is expensive to redo.

## Expected-output contracts

Before executing a task, state (at least mentally) what success looks like:
- "`npm test` exits 0; the new test `filters by language` passes."
- "The API returns `stargazers_count`, `language`, and `pushed_at` for each repo; there are more than 0 repos."
- "The CSV has one row per ticket, with a `category` column that's non-null for more than 90% of rows."

A result can succeed technically (no error) and still fail the contract. Treat that as a failure.

## Retry policy

- Retry only failures that are plausibly **transient**: network, rate limit, lock contention, a flaky test.
- **Change something** on every retry: wait or back off, narrow the request, fix the input, use an alternative endpoint.
- **Maximum two retries** of the same operation by default. After that, repair, replan, or escalate.
- Never retry an operation with side effects (send, pay, create) without first checking whether the first attempt partly succeeded. Look before repeating.

## Local repair vs replan

| Situation | Action |
|---|---|
| The task failed but its approach and the rest of the plan still hold (typo, wrong path, missing import) | **Local repair** |
| An assumption turned out false (the API needs auth; the data lacks a field; the file structure differs) | **Replan** the affected subtree |
| A dependency's output differs from what downstream tasks expect | **Replan** the dependents |
| The user adds, removes, or changes a requirement | **Replan**, and confirm the scope change if it affects the deliverable |
| The approach can't meet a success criterion | **Replan** with the fallback approach, or escalate |
| Blocked on access, a decision, or contradictory requirements | **Escalate** |

## Replanning procedure

1. **State what changed** in one line ("the repo list endpoint returns max 100 per page; the user has 340 repos").
2. **List invalidated items**: assumptions, tasks, and outputs that no longer hold.
3. **Keep valid work.** Don't restart from scratch unless most of the plan is invalid.
4. **Update the task list**: add, drop, reorder, and redo only the affected subtree.
5. **Re-check dependencies and parallelism** (run `scripts/check_plan.py` again for written plans).
6. **Check the goal is unchanged.** If the objective or success criteria change, that's a scope change: inform the user, and get agreement if they're present.
7. Continue.

**Thrashing guard:** if the same area has been replanned twice without measurable progress, stop. Escalate with the evidence rather than trying a third variation.

## Budgets and stopping conditions

Set these for Full-level tasks:
- **Retry cap** per operation (2).
- **Iteration cap** for evaluator loops (2–3 rounds).
- **Scope cap**: the maximum files, records, or pages to process before checking in (for example, confirm the approach on 10 items before running 10,000).
- **Stop conditions**: success criteria met; budget exhausted; blocked on the user; evidence that the objective is infeasible as stated.

When stopping short of success, deliver what's done and verified, plus what's left and why.

## Checkpoints

Place a checkpoint:
- **After discovery**: do the findings change the plan?
- **After the first vertical slice**: does the end-to-end path work?
- **Before irreversible or external actions**: user approval, unless it has already been given explicitly.
- **Before large batch operations**: validate on a small sample first.

A checkpoint with a present user is a short message with a decision to make. Without a user, it's a self-check with the result stated in the final report.

## Escalation format

```
Blocked on: <the specific thing>
Tried: <1–3 attempts and what each showed>
Options:
  A) <option> — <consequence>
  B) <option> — <consequence>
Recommendation: <A/B and why>
Meanwhile: <what's done and preserved>
```

## Keeping the user informed

- Share progress at meaningful moments: the plan (for large tasks), the first working slice, direction changes, and blockers. Don't narrate every tool call.
- When a result changes what the user will get (a limitation, a scope change), say so promptly. Don't save it for the end.
- Keep a running task list for long tasks so a returning user can see what's done and what's left.
