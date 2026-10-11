# Roadmap and Go-To-Market

## Contents
- Phased roadmap
- First 10 users
- Channel evaluation
- Channel playbooks
- Launch
- Metrics that decide what's next

## Phased roadmap

Each phase has an **exit criterion**. Don't advance on calendar time; advance on evidence.

### Phase 1: Validation (no or minimal code)
- Customer conversations; a landing page or waitlist; a pricing test; concierge delivery.
- **Exit:** the riskiest assumptions pass their thresholds (`validation-experiments.md`). Typically: the problem is confirmed by 5+ target users, a channel shows response, and there's some commitment (waitlist with qualified sign-ups, pilots, pre-sales).

### Phase 2: Prototype
- The smallest working version of the core flow, possibly hacky, used by 3–10 design partners.
- **Exit:** users complete the core action without hand-holding, and at least some come back unprompted.

### Phase 3: MVP
- The Must-haves done properly: auth, payments, onboarding, error handling, basic analytics.
- **Exit:** the first paying customers (or a clear conversion from the free tier), and activation measured.

### Phase 4: Launch
- Execute the chosen channels (below), with a public launch where it fits (Product Hunt, Show HN, community launches, marketplace listing).
- **Exit:** a repeatable channel producing sign-ups at an acceptable cost or effort.

### Phase 5: Iteration
- Build from usage data and customer conversations. Prioritize by (impact on activation, retention, or revenue) ÷ effort.
- **Exit and loop:** retention stabilizes and revenue grows month over month. Otherwise, revisit the segment, problem, or channel.

Estimate each phase in **weeks of the founder's available hours**, not in calendar optimism.

## First 10 users

Answer concretely:
1. **Who** exactly are they? (Titles, company types, communities, a recognizable profile.)
2. **Where** do they gather? (Specific subreddits, Slack and Discord groups, forums, LinkedIn groups, associations, meetups, marketplaces, newsletters.)
3. **What do they search for** when the trigger happens? (Keywords in their language, including local languages.)
4. **What's the first message?** (Problem-focused, not feature-focused.)
5. **Who do you already know** who fits or can introduce you?

The first users usually come from **direct, unscalable effort**: personal network, conversations from validation, hand-picked outreach, and community participation. Plan for that; it's normal.

## Channel evaluation

Score each candidate channel for this idea and this founder:

| Channel | Works when | Doesn't work when | Solo-founder effort |
|---|---|---|---|
| **SEO / content** | People search for the problem or for alternatives; long-tail keywords exist; you can publish consistently | No search intent (a new category); a highly competitive SERP | Slow (3–12 months), compounding |
| **Programmatic SEO** | Many structured, useful page variants (integrations, templates, locations) | Thin or duplicate pages | Medium setup, then low |
| **Community (Reddit, Discord, forums)** | You participate genuinely; the problem is discussed openly | Self-promotion is banned; the community is hostile to vendors | Ongoing, personal |
| **Cold outreach (email, LinkedIn)** | B2B with identifiable buyers and a clear pain; higher price points | Low-price B2C; unclear buyer | Medium; needs good targeting |
| **Marketplaces / app stores** | Buyers browse a platform's directory (Shopify, Chrome, WordPress, Slack, Figma, Atlassian) | Saturated category; platform rules restrict you | Low–medium; platform risk |
| **Partnerships / integrations** | Complementary tools or consultants serve the same users | No partner gains from it | Relationship-heavy, high leverage |
| **Paid ads** | Proven conversion funnel; LTV supports CAC; clear search intent | Pre-product-market fit; low price point | Money plus optimization skill |
| **Audience / build in public** | The founder has or builds an audience in the segment | The audience isn't the buyer (developers following a B2C tool) | Long-term |
| **Launch platforms (Product Hunt, Show HN)** | Tech-savvy early adopters are the buyers | The target is a non-technical niche | One-off spike |
| **Free tools / lead magnets** | A small free utility attracts the exact segment | The tool attracts the wrong audience | Medium; compounding with SEO |

Pick **1–2 primary channels** to execute well. Spreading across six channels is a common way to fail.

## Channel playbooks

**Reddit and community**: become a helpful member first. Answer questions about the problem; share learnings, not links. Read the rules on self-promotion. Ask the problem questions openly. Mention the product only when it's directly relevant and allowed.

**Cold outreach**: a list of 50–100 precisely matching prospects; a personal first line referencing their specific situation; a problem-focused message; a soft ask (a 15-minute chat or feedback on a prototype); 2–3 follow-ups max. Track the reply rates. Respect anti-spam and GDPR rules for B2B outreach in the target region.

**SEO**: target bottom-of-funnel keywords first: "<competitor> alternative", "<job> for <segment>", "how to <job> in <tool>", templates, and calculators. One genuinely useful page per keyword cluster.

**Marketplace**: optimize the listing (problem-first title, screenshots, keywords), ask early users for reviews, and ship fast iterations based on feedback. Diversify off-platform over time.

## Launch

- Line up 10–30 people from validation who agreed to try it. Seed reviews and testimonials.
- Use a launch post centered on the problem and the story, not the feature list.
- Reply to every comment in the first 48 hours. Book conversations with every interested user.
- Expect a spike and then a drop. The repeatable channel matters more than the launch day.

## Metrics that decide what's next

| Stage | Metric |
|---|---|
| Validation | Problem-confirmation rate, waitlist conversion, pre-sales |
| Activation | % of sign-ups completing the core action within N days |
| Retention | Weekly or monthly active by the core action; cohort retention curves flattening |
| Revenue | Conversion to paid, MRR, ARPU, churn |
| Channel | Sign-ups and paid users per channel; cost or effort per acquired user |
| Qualitative | "How disappointed would you be if you could no longer use this?" (Sean Ellis test); reasons for churn |

Build what improves the weakest stage in this funnel, and ignore feature requests that don't.
