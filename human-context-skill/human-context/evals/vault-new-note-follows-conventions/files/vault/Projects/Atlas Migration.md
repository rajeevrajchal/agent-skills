---
type: project
status: active
tags: [project, infra]
created: 2025-02-20
---
# Atlas Migration

Move the order service off the legacy monolith.

## Goals
- Zero-downtime cutover
- Replayable event history, see [[Event Sourcing]]

## Decisions
- Datastore: Postgres. See [[2025-03-12 Use Postgres for Atlas]]

## Related
- [[Distributed Systems MOC]]
