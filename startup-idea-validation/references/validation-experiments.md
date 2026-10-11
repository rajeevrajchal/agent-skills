# Validation Experiments

Validate the **riskiest assumption first**, with the **cheapest test that could prove it wrong**. Set the pass/fail threshold **before** running the test.

## Contents
- Choosing what to test
- Experiment catalog
- Experiment card
- Thresholds: starting points
- Interpreting results
- Ethics and honesty

## Choosing what to test

List the idea's assumptions labelled [A] and rate each one on:
- **Impact if wrong** (kills the idea / changes the plan / minor)
- **Uncertainty** (no evidence / some / strong)

Test the high-impact, high-uncertainty ones first. The order is usually: problem exists and hurts → the segment can be reached → they'll pay → the solution works → they keep using it.

## Experiment catalog

Roughly from cheapest and weakest signal to most expensive and strongest:

| Experiment | Tests | Cost | Signal strength |
|---|---|---|---|
| Review and forum mining | Problem exists, themes | Hours | Low–medium |
| Customer conversations (5–10) | Severity, current behavior, buyer, trigger | 1–2 weeks | Medium |
| Community post (asking about the problem, not pitching) | Pain resonance, reachability | Days | Low–medium |
| Landing page + waitlist (one clear promise, one CTA) | Interest, messaging, channel | Days + small traffic cost | Medium |
| Pricing page test ("Buy" → "coming soon, join early access") | Price sensitivity, intent | Days | Medium–high |
| Pre-sale / paid pilot / deposit | Willingness to pay | 1–3 weeks | **High** |
| Concierge MVP (deliver the outcome manually) | Value of the outcome, workflow details | 2–4 weeks | High |
| Wizard-of-Oz (product UI, human behind it) | Usage, value, retention signals | 2–6 weeks | High |
| Clickable prototype usability sessions | Solution comprehension, UX | 1–2 weeks | Medium (for the solution, not demand) |
| Single-feature MVP to a small cohort | Retention, real usage | 4–8 weeks | **High** |
| Cold outreach (50–100 targeted messages) | Reachability, response rate, B2B interest | 1–2 weeks | Medium |
| Marketplace listing (simple plugin or extension) | Organic discovery demand | 2–4 weeks | Medium–high |

Prefer tests that produce **behavior** (sign-ups, payments, repeat use) over opinions.

## Experiment card

```md
### Experiment: <name>
**Assumption tested:** <[A] statement>
**Why it matters:** <what changes if it's false>
**Method:** <what exactly will be done, where, for how long>
**Audience & channel:** <who, where they're reached>
**Metric:** <what is counted>
**Pass threshold (set before running):** <number>
**Kill threshold:** <number below which the idea is rejected or reframed>
**Cost / time box:** <hours, €, end date>
**Result:** <filled after>
**Decision:** <continue / pivot framing / reject>
```

## Thresholds: starting points

Context-dependent and directional. Adjust them to the channel and price point, and state them in advance:

- Conversations: at least 5 of 10 describe the problem unprompted as a top-3 pain, **and** at least 3 currently spend money or significant time on it.
- Landing page (targeted traffic): email sign-up ≥ 10–20% from community traffic, or ≥ 2–5% from colder paid traffic.
- Cold B2B outreach: ≥ 5–10% positive replies (interested in a call or pilot) from a well-targeted list.
- Pre-sale: at least 3–5 paying or deposited customers from a small, targeted audience, before building the full MVP.
- Early MVP retention: a meaningful share of activated users still active after 4 weeks (define "active" by the core action, not logins).

A result in the zone between the pass and kill thresholds means you should reframe (segment, message, price) and rerun once. Don't run the same test repeatedly until it passes.

## Interpreting results

- **Pass**: raise the evidence level of the related criteria in the ledger, re-score, and move to the next riskiest assumption.
- **Fail on the problem**: reject, or reframe to a different segment or problem found during the test.
- **Fail on the channel only**: the problem may be real but unreachable for this founder. Look for another channel before rejecting.
- **Fail on price**: test a lower price, a different buyer (B2B instead of B2C), or a different model.
- Watch for **false positives**: friends and family, a small sample, novelty spikes from a launch post.

## Ethics and honesty

- Smoke tests must not take money for something that won't be delivered. Use "early access / reserve" wording, refund promptly, or deliver manually (concierge).
- Comply with privacy rules when collecting emails (consent, privacy notice; GDPR in the EU).
- Follow the community rules: many subreddits and forums ban self-promotion. Ask about problems; don't spam links.
