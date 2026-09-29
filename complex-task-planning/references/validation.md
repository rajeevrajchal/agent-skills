# Validation

"The steps ran" isn't validation. Validation is evidence that the **success criteria from the Understand stage** are met.

## Contents
- Validation depth by stakes
- Strategies by output type
- Evaluator rubric
- Final checklist
- Reporting limitations

## Validation depth by stakes

| Stakes | Examples | Depth |
|---|---|---|
| Low | Quick answer, a draft for the user to edit | Self-check against the request |
| Medium | Code change, analysis the user will act on, a document to share | Run it, recompute it, re-read against the requirements |
| High | Production changes, financial or legal content, published claims, irreversible actions | Independent check: tests or ground truth, a second evaluator pass with a rubric, human review before the action |

## Strategies by output type

**Code**
- Build, type-check, and lint. Run the existing tests and add tests for new behavior.
- Exercise the edge cases found during Understand (empty, error, limits).
- Check the diff: only intended files changed, no debug output, no secrets, no stray TODOs.
- For UI: render it and look (screenshot, browser), including empty, loading, and error states.

**Facts and research**
- Every important claim traces to a source. Primary sources over secondary.
- Check dates: is the information current enough for the question?
- Resolve or report conflicts between sources. Don't silently pick one.
- Separate what the sources say from what you infer.

**Numbers and data analysis**
- Recompute key figures with code from the raw data.
- Reconcile totals (parts sum to the whole; row counts before and after filters are explained).
- Sanity-check magnitudes and units. Check for filters that are too broad or too narrow (date ranges, time zones, duplicates).
- Make sure any chart matches the table it came from.

**Documents and writing**
- Every requirement in the request is covered (walk the list).
- Audience, tone, length, and format as asked.
- Names, numbers, and dates match the sources.
- Open the final file in its target format to confirm it renders.

**Actions with side effects** (sent, created, deployed, changed)
- Confirm the action took effect (read back the created record, check the deployment status, verify the message was sent).
- Confirm nothing unintended happened (no duplicates, the right recipients, the right environment).

**Plans and designs**
- Every requirement maps to a component or task. Dependencies are resolvable. Risks have mitigations.

## Evaluator rubric

For an evaluator-optimizer pass, or a self-review of high-stakes output, score each criterion **pass/fail with evidence**:

```
Criterion                          | Pass? | Evidence
-----------------------------------|-------|-------------------------------
Meets success criterion 1          |       |
Meets success criterion 2          |       |
Respects constraints (list)        |       |
Correctness (tests/sources/recalc) |       |
Completeness (no skipped tasks)    |       |
Format & destination as requested  |       |
Assumptions listed or confirmed    |       |
```
Revise until everything passes or the iteration cap is reached. Report what's still failing.

## Final checklist

- [ ] Original objective addressed, not a narrower or different one.
- [ ] Every success criterion met, with evidence.
- [ ] Requirements and constraints respected; nothing out of scope changed.
- [ ] Assumptions confirmed or disclosed.
- [ ] Tool results interpreted correctly (re-read the key ones).
- [ ] No skipped tasks, placeholders, or leftover scaffolding.
- [ ] Output in the requested format, at the requested destination.

## Reporting limitations

State briefly and specifically:
- what wasn't done or couldn't be verified, and why,
- assumptions the user should confirm,
- known risks or edge cases left open.

One honest line about a limitation is worth more than a confident summary that hides it.
