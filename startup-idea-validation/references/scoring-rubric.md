# Scoring Rubric

The score structures judgment. It doesn't predict success. Every score carries an **evidence level**, and the verdict rules stop strong-sounding but unvalidated ideas from ranking as opportunities.

## Contents
- How to score
- Criteria, weights, and anchors
- Evidence levels
- Gates
- Verdict rules
- Confidence
- Common scoring errors

## How to score

1. Check the gates first (`problem-analysis.md`). A failed gate means ❌, with no scoring needed.
2. Score each criterion 1–10 against its anchors. **Higher is always better** (so competition and complexity are scored as openness and feasibility).
3. Record the evidence level per criterion, plus a one-line justification citing the evidence.
4. Compute the weighted score (0–100). `scripts/score-ideas.mjs` does this and applies the verdict rules.
5. Write down the 2–3 biggest risks next to the number.

## Criteria, weights, and anchors

| # | Criterion (higher = better) | Weight | 1–2 | 4–5 | 7–8 | 10 |
|---|---|---|---|---|---|---|
| 1 | **Problem severity** | 12 | Mild annoyance | Real friction, workaround tolerable | Costs meaningful time or money; people complain unprompted | Critical: lost revenue, legal risk, or job on the line |
| 2 | **Frequency** | 8 | Once or rarely | Quarterly or monthly | Weekly | Daily or continuous |
| 3 | **Willingness to pay** | 12 | Nobody pays for anything similar | People pay for adjacent tools or spend significant time | Paid competitors with satisfied paying users; a budget exists | Users offered to pay, pre-ordered, or are paying for a worse solution today |
| 4 | **Market sufficiency** (for the founder's goal) | 8 | Required customers > 10% of the reachable segment | 3–10% | 1–3% | < 1%, with room to expand to adjacent segments |
| 5 | **Competitive openness** | 6 | Dominant, well-loved incumbents, or no demand evidence at all | Crowded but with complaints | Few focused competitors and clear dissatisfaction | Proven demand, weak or neglected solutions |
| 6 | **Differentiation potential** | 8 | No meaningful difference | A nice-to-have difference | A real advantage for a definable segment | A real advantage that's hard to copy |
| 7 | **Reachability** (ease of reaching customers) | 12 | No identifiable channel | Paid ads or cold outreach only, unproven | Clear community, search intent, or marketplace where buyers gather | Founder already has access (audience, network, community role) |
| 8 | **Build feasibility** (for this founder) | 8 | Needs skills or capital the founder lacks | Significant new learning or hard technical risk | Within the founder's stack, with moderate unknowns | Straightforward with the founder's existing skills |
| 9 | **Time to MVP** | 6 | > 6 months part-time | 3–6 months | 4–12 weeks | < 4 weeks |
| 10 | **Retention potential** | 8 | One-off use | Occasional use; easy to churn | Recurring workflow; data accumulates | Embedded in a daily workflow, team usage, or system of record |
| 11 | **Monetization potential** | 6 | Can't charge, or only cents | Low price, high volume needed | Healthy price relative to the customers needed | High value per customer, with expansion revenue |
| 12 | **Long-term defensibility** | 6 | Trivially cloned; platform owner will ship it | Head start only | Niche depth, integrations, switching costs, or brand in a community | Proprietary data, network effects, or strong distribution moat |

Weights total 100. Weighted score = Σ (weight × score / 10).

The weights favor what kills solo-founder products most often: weak pain, no willingness to pay, and no distribution. Adjust the weights only when the founder's goal clearly differs (for example, a pure learning project could weight feasibility higher). State any change you make.

## Evidence levels

Record per criterion:

| Level | Code | Meaning |
|---|---|---|
| 0 | `assumption` | Reasoning only, no external evidence |
| 1 | `research` | Desk research: competitor sites, reviews, forums, data |
| 2 | `conversations` | Interviews or direct conversations with target users (5+ recommended) |
| 3 | `behavioral` | Sign-ups, waitlist conversion, pre-orders, payments, usage data |

Key criteria for verdicts: **severity (1)**, **willingness to pay (3)**, **reachability (7)**.

## Gates

G1 Real specific problem · G2 Reachable buyers · G3 Someone pays · G4 Feasible for founder · G5 Acceptable legal and platform risk. Each is `pass`, `fail`, or `unknown`.

## Verdict rules

Applied in order (implemented in `scripts/score-ideas.mjs`):

1. Any gate `fail` → ❌ **Reject**.
2. A duplicate of a stronger idea (marked `merged_into`) → ❌ **Reject** (merged).
3. Score < 45 → ❌ **Reject**.
4. Any gate `unknown`, **or** any key criterion at `assumption` level → ⚠️ **Needs validation** (unless the score is < 45).
5. Score 45–64 → 🟡 **Interesting but risky**.
6. Reachability ≤ 4, **or** competitive openness ≥ 9 with no competitors listed → 🟡 **Interesting but risky** (no distribution path, or unproven demand), whatever the score.
7. Score ≥ 75 **and** willingness to pay at `behavioral` **and** reachability at least `conversations` → 🔥 **Strong business opportunity**.
8. Score ≥ 65 → 🟢 **Strong prototype candidate**.
9. Otherwise → 🟡 **Interesting but risky**.

Additional flags (warnings; the first and third also cap the verdict via rule 6):
- Competitive openness ≥ 9 with no competitors listed → "No competitors found: verify demand exists."
- Severity ≤ 4 with a high total score → "Weak pain inflated by other criteria."
- Reachability ≤ 4 → "No clear distribution path."
- Defensibility ≤ 3 with differentiation ≥ 7 → "Advantage is likely copyable."
- Ideas with highly similar problem statements → "Possible duplicates: consider merging."

## Confidence

Overall confidence is the weighted average evidence level, reported as **Low** (< 0.75), **Medium** (0.75–1.5), or **High** (> 1.5). Always present it next to the score, for example "68/100 (confidence: Low)". A low-confidence score is a hypothesis, not a finding.

## Common scoring errors

- Scoring the **solution** (it would be cool) instead of the **problem**.
- Giving high willingness to pay because "it saves time" without evidence that anyone pays to save that time.
- Treating "no competitors" as a high openness score.
- Scoring feasibility for an imaginary team instead of this founder.
- Anchoring on the first idea discussed. Score ideas side by side.
- Adjusting scores to reach a desired verdict. If the verdict feels wrong, find the missing evidence or the wrong anchor instead.
