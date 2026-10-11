# Monetization, Survival Requirements, and Failure Modes

## Contents
- Matching the model to the problem
- Pricing starting points
- Survival requirements (moats a small product can build)
- Biggest failure modes
- Risk register template

## Matching the model to the problem

Choose the model that fits **how the value is experienced**, not SaaS by default:

| Value pattern | Fitting model | Examples |
|---|---|---|
| Ongoing workflow, recurring value | **Subscription** (monthly or annual) | Scheduling, invoicing, monitoring, team tools |
| One-time transformation or a utility used occasionally | **One-time payment** / lifetime license / pay per project | Converters, templates, desktop tools, small dev tools |
| Value scales with volume | **Usage-based** (credits, per unit), often with a base fee | API products, AI processing, sending, storage |
| Broad top-of-funnel, upgrade for power or team use | **Freemium** (only if the free tier is cheap to serve and drives acquisition) | Developer tools, productivity tools |
| Connecting two sides | **Marketplace commission** | Hard for solo founders (liquidity) |
| B2B pain with a budget owner | **B2B SaaS** (per-seat or tiered by business size) | Vertical SaaS |
| Buyers want outcomes, not tools | **Services + software** (productized service, setup fees, done-for-you) | Non-technical SMBs, agencies |
| Developers integrate it into their products | **API pricing** (tiers by requests or volume) | Data APIs, specialized processing |
| Content or traffic-driven tools | **Affiliate / sponsorship** | Comparison tools, calculators (low and volatile revenue) |
| Open-source core | **Open core / hosted version / support** | Dev infrastructure (needs a large adoption base) |

Combine where natural (a setup fee plus a subscription; a base subscription plus usage).

## Pricing starting points

- Anchor on the **value and the alternative's cost**, not on build cost: the hours saved × the user's hourly cost, the agency fees replaced, the competitor prices for the segment.
- Solo-founder B2B tools often land at €15–100/month per business at entry, with higher tiers for teams or volume. Consumer subscriptions are commonly €3–15/month, with high churn. Verify against the researched competitors.
- Charge from the start (or after a short trial). Free users give weaker feedback about value.
- Offer an annual plan (cash flow, lower churn).
- Run price tests in validation (`validation-experiments.md`). Raising prices later is normal; most founders start too low.
- Check the payment and tax implications (VAT, merchant of record vs your own entity) for the founder's location.

## Survival requirements (moats a small product can build)

For the chosen idea, state which of these it must develop, and how:

| Moat | How small products build it | Time to build |
|---|---|---|
| **Distribution** | Owned audience, SEO footprint, community role, marketplace ranking, partnerships | The most important for solo founders; start early |
| **Niche depth** | Workflows, terminology, compliance, and integrations specific to one segment | Months |
| **Workflow lock-in / switching costs** | Becoming the system of record; historical data; team adoption | Grows with usage |
| **Integrations** | Deep connections to the segment's tools | Months; maintenance cost |
| **Community** | Users helping users; templates and content contributed by users | Long-term |
| **Brand / trust** | Founder-led credibility in the niche; reliability; support quality | Long-term |
| **Proprietary data** | Aggregated, cleaned data that improves with users (respecting privacy and law) | Long-term |
| **Network effects** | Value increases with users (rare for solo products) | Hard |
| **Cost advantage** | Leaner ops let you profitably serve segments incumbents can't | Structural |
| **Unique UX** | Radical simplicity for a segment | Copyable, so combine it with other moats |
| **Technical advantage** | Hard technical problem solved | Narrow and erodes; rarely enough alone |

## Biggest failure modes

Assess each for the idea, and name the top 3:

1. **No real demand**: the problem isn't painful or frequent enough (built before validating).
2. **No distribution**: a good product nobody discovers; no channel works at an acceptable effort.
3. **Wrong buyer**: the user likes it, but the payer doesn't see value.
4. **Price too low**: the unit economics never support the founder's goal.
5. **Platform risk**: a dependency on an API, marketplace, or model provider that changes terms, prices, or ships the feature.
6. **Incumbent response**: a competitor copies the differentiator or drops its price.
7. **Churn**: one-off value in a subscription model, or no habit.
8. **Founder constraints**: time, motivation, sales aversion, burnout, scope creep.
9. **Execution complexity**: the MVP is bigger than estimated; integrations, edge cases, compliance.
10. **Legal / compliance**: privacy, sector regulation, intellectual property, scraping and terms-of-service issues.

## Risk register template

| Risk | Likelihood (L/M/H) | Impact (L/M/H) | Early warning signal | Mitigation / test |
|---|---|---|---|---|
| | | | | |

Every High/High risk needs a validation experiment or an explicit decision to accept it.
