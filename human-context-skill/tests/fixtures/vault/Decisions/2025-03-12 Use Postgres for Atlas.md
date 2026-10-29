---
type: decision
status: accepted
tags: [decision, atlas]
created: 2025-03-12
project: "[[Atlas Migration]]"
---
# 2025-03-12 Use Postgres for Atlas

## Context
Team knows Postgres well. Needs transactional guarantees.

## Decision
Use Postgres as the primary datastore.

## Consequences
Retries must be safe, see [[Idempotency Keys]].
