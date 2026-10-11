# MVP Definition and Architecture

## Contents
- MVP principles
- Feature triage template
- Architecture principles for solo founders
- Default building blocks (verify current options)
- Architecture output template
- Security and compliance minimums

## MVP principles

- The MVP delivers **one core outcome** for **one segment**, end to end. It's the smallest thing that a real user would choose over their current workaround.
- Start from the validated problem and the differentiator. Every Must-have feature must trace back to one of them.
- Prefer **manual behind the scenes** (concierge) over automating rare cases. Automate what users repeat.
- If something can be a spreadsheet, form, or email for the first 10 users, it probably should be.
- The time box sets the scope: if the MVP doesn't fit in about 4–12 weeks of the founder's available hours, cut the scope, not the quality of the core flow.

## Feature triage template

| Feature | Category | Why (trace to problem/differentiator) | Effort (S/M/L) |
|---|---|---|---|
| | Must have | | |
| | Should have | | |
| | Later | | |
| | Do not build | | |

- **Must have**: without it, the core value isn't delivered (the core flow, minimal auth if data is personal, the payment path when charging, basic error handling).
- **Should have**: improves conversion or retention noticeably, but the first users can live without it (an onboarding checklist, email notifications, one key integration).
- **Later**: after there are users and data (analytics dashboards, team features, more integrations, an API, mobile apps, themes).
- **Do not build**: complexity without matching value at this stage (SSO, a granular permissions matrix, custom report builders, a plugin system, multi-tenancy customizations, microservices, a native app when the web works, building your own auth or billing).

## Architecture principles for solo founders

1. **Use the founder's strongest stack.** Familiarity beats theoretical fitness at MVP scale.
2. **One deployable app + one database** (a monolith). Split only when a measured need appears.
3. **Buy commodity, build differentiation.** Use managed auth, payments, email, hosting, and analytics. Spend build time on the differentiator.
4. **Postgres by default** for business data (relational, JSON when needed, mature hosted options).
5. **Background jobs only when needed** (scheduled emails, imports, AI processing): a managed queue or a simple scheduled function.
6. **Keep migration options open.** Avoid deep lock-in to proprietary features in places where you'd be stuck later (auth user IDs, data export).
7. **Cost-aware.** Free tiers and usage-based services keep the burn low until there's revenue. Watch AI API costs per user and set limits.

## Default building blocks (verify current options)

Starting points to evaluate. Check the current pricing, limits, and terms with web research before recommending, because these change often:

| Concern | Typical solo-founder choices | Notes |
|---|---|---|
| Frontend | The founder's framework (SvelteKit, Next.js, Nuxt, Remix/React Router), or server-rendered pages | SSR helps SEO-driven acquisition |
| Backend | Framework API routes / server actions; Node, Python, or Go service if needed | Same repo as the frontend at the MVP stage |
| Database | Managed Postgres (Supabase, Neon, AWS RDS, Fly/Render Postgres) | Row-level security if using a BaaS directly from the client |
| Auth | Managed auth (Supabase Auth, Clerk, Auth.js, Cognito, Firebase Auth) | Magic links or OAuth reduce friction; never roll your own |
| Payments | Stripe (Billing/Checkout), or a merchant of record (Paddle, Lemon Squeezy, Polar…) | A merchant of record handles global VAT and sales tax, which is very useful for EU solo founders selling worldwide; it costs higher fees |
| Email | Transactional (Resend, Postmark, SES); marketing (a newsletter tool) | Set up SPF/DKIM/DMARC |
| Background jobs | Platform cron, managed queues (Inngest, Trigger.dev, QStash, SQS) | Only when needed |
| File storage | S3-compatible object storage (S3, R2, Supabase Storage) | Signed URLs, private by default |
| AI components | A hosted LLM API behind your own server endpoint; retrieval only if needed | Per-user rate limits, cost tracking, prompt/version logging, a fallback when the provider fails |
| Analytics | Product analytics (PostHog, Plausible/Umami for privacy-friendly web analytics) | Track the core action and activation, not vanity metrics |
| Errors / monitoring | Sentry or similar; uptime checks | From day one |
| Hosting | Vercel/Netlify/Cloudflare (frontend-heavy), Fly/Render/Railway (servers), AWS if the founder knows it | Pick the one with the least ops overhead for this founder |
| Notifications | Email first; push or SMS only if the job needs real-time | |

## Architecture output template

```md
### Architecture (MVP)
**Shape:** <monolith app + Postgres + managed services>
**Diagram:** user → app (frontend + API) → Postgres; → auth provider; → payments (webhooks back to app); → email; → AI API (if any); background jobs → app DB

| Component | Choice | Why it fits | Alternatives / exit path |
|---|---|---|---|
| Frontend | | | |
| Backend | | | |
| Database | | | |
| Auth | | | |
| Payments | | | |
| Jobs | | | |
| AI | | | |
| Analytics | | | |
| Hosting | | | |

**Data model (core entities):** <3–8 entities with key relations>
**Integrations / APIs:** <external APIs, rate limits, ToS constraints>
**Cost at 0 / 100 / 1,000 users:** <rough monthly estimate, with sources>
**Biggest technical risk:** <and how the prototype de-risks it>
```

## Security and compliance minimums

- HTTPS everywhere. Secrets in environment variables, never in the client bundle. Least-privilege API keys.
- Authorization checks on every data access (or tested row-level security policies).
- Verify payment webhooks with their signatures. Make them idempotent.
- Back up the database (and check that restore works). Provide data export for users.
- Privacy: a privacy policy, a processing record, and data processing agreements with vendors. Respect GDPR rights (access, deletion) when serving EU users. Collect only necessary data.
- AI: don't send sensitive user data to third-party models without disclosure and a legal basis. Defend against prompt injection when models act on user content or tools.
- Regulated domains (health, finance, children): get domain-specific legal advice before launch.
