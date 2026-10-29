# Context model

How to represent what you know about the person. Read this when you are about to record, update, correct, or weigh a piece of human context.

## Contents

- Dimensions worth understanding
- What deserves recording
- Entry format
- Provenance in practice
- Staleness, conflicts, supersession
- A minimal example
- What never to record

## Dimensions worth understanding

Fill only what you have real evidence for. Most people will have a handful of reliable entries, not a full profile.

| Dimension | Useful to know | Signals worth trusting | Caution |
|---|---|---|---|
| Communication | Tone, formality, directness; length and depth; language; formatting (headings, bullets, tables, code blocks); examples and analogies; answer-first vs context-first; when they welcome clarifying questions | Their own wording, edits to your drafts, what they trim or ask for more of | Preferences differ by task. Record the scope. |
| Expertise | Tools, languages, frameworks, workflows; what they are learning; where basics are unwelcome and where they are welcome | What they demonstrate in the conversation (precise vocabulary, the questions they ask), not job title | A title is weak evidence. Expertise varies by sub-topic. |
| Thinking and learning | Whether step-by-step, conceptual models, worked examples, alternatives, rationale, experiments, or small next actions help them act | Which of your formats they build on, and which they skip | Never force a type or label. These are tendencies by situation. |
| Collaboration | How they break down work, plan, explore before building, review changes and give feedback, handle uncertainty, move from brainstorm to execution, track follow-ups | Repeated process requests ("show me the diff first") | One session is not a pattern. |
| Goals and priorities | Current projects, short- and long-term objectives, recurring responsibilities, constraints, deadlines, dependencies | What they state about their work | Mark time-bound items with an expected end or review point. |
| Writing and documentation | Voice, sentence structure, formality, message length, formatting, Markdown and frontmatter conventions, naming and file organization, tone by audience | Their existing notes and sent writing, which are better evidence than their description of their style | Don't flatten their voice into yours. |
| Decision-making | Stated criteria: simplicity, maintainability, speed, cost, flexibility, risk, long-term value | Criteria they name or apply consistently | Don't claim to know risk tolerance or infer sensitive traits. |

## What deserves recording

Record an entry only if it passes all of these:

1. **Durable** - likely to hold beyond this conversation.
2. **Useful** - it would change how you respond or what you do.
3. **Appropriate** - not sensitive, or the person clearly wants it kept.
4. **Authorized** - a mechanism exists, and consent or an explicit request covers it (see Persistence in SKILL.md).

If an item fails any test, keep it as working context or drop it.

## Entry format

Use this shape in whatever store the host provides. It is a guide; adapt to the store's own format.

```yaml
- claim: "Wants the conclusion first, then reasoning"
  status: explicit          # explicit | observed | inferred
  scope: global             # global | project:<name> | task-type:<name>
  source: "user message: 'lead with the answer'"
  recorded: unknown         # a real date if the platform provides one; else unknown
  last_confirmed: unknown
  expires: null             # or a review point for time-bound items
  supersedes: null
  notes: ""
```

Rules for the fields:

- `source` says where it came from in plain words. Never invent one. If you can't say, write `unknown`.
- `recorded` and `last_confirmed` hold real dates only. Do not guess a date.
- Do not add numeric confidence scores. The three statuses are the whole scale.
- `scope` prevents leakage. A preference for terse chat replies must not become a rule for client emails.

## Provenance in practice

- **Explicit:** "I'm a backend engineer; skip HTTP basics." Record it as stated. It is still scoped: skip HTTP basics, not all explanations.
- **Observed:** They asked you to shorten three of your last four answers. Record "tends to prefer concise replies (observed)". Do not record "wants concise replies" as explicit. When it is cheap and natural, confirm: "I'll keep these tight unless you say otherwise."
- **Inferred:** They use a lot of Rust vocabulary, so they may know systems programming. Do not store this. Use it only as a hint for the current answer, and check against what they then say.

Promotion: an observed pattern becomes explicit only when the person confirms it. An inference becomes observed only after repeated, independent evidence.

## Staleness, conflicts, supersession

- Time-bound facts (a deadline, a sprint, "this week") get an expiry or review point, or aren't stored.
- Stale entries (old project status, an outdated stack) should be verified before they shape an answer. If you can't verify and it matters, say so.
- On conflict, the current explicit instruction wins for the current task. For persistent facts, compare dates and sources. If the order is unclear and the difference matters, ask once.
- When a preference changes, add the new entry and mark the old one `superseded` (keep it, with its reason). Do not silently edit history. If the person asks for removal, see [privacy-and-confidence.md](privacy-and-confidence.md).

## A minimal example

A reliable context model might be only this:

```yaml
- claim: "Senior Python engineer; skip language basics, explain unfamiliar infra concepts"
  status: explicit
  scope: global
  source: "user message"
- claim: "Prefers a recommendation with trade-offs over a neutral survey"
  status: observed
  scope: task-type:decision
  source: "followed up on recommendations twice, ignored neutral lists"
- claim: "Finishing the Atlas migration; deadline pressure until the review"
  status: explicit
  scope: project:atlas
  expires: "review after the migration milestone"
```

Three entries, each earned. That is better than twenty guesses.

## What never to record

- Sensitive attributes inferred from behavior or topics (health, religion, politics, sexuality, finances, immigration, and similar).
- Secrets: credentials, API keys, tokens, private identifiers.
- Details about third parties beyond what the task needs.
- Emotional states as traits.
- Anything the person asked you not to use.
