# Waypoint data model

```mermaid
erDiagram
  USERS ||--o{ AUDIT_EVENTS : performs
  OUTLETS ||--o{ ORDERS : places
  VEHICLES ||--o{ TRIPS : operates
  TRIPS ||--o{ ORDERS : contains
  TRIPS ||--o{ LOADING_CHECKS : verifies
  TRIPS ||--o{ LOADING_ISSUES : reports
  ORDERS ||--o{ LOADING_CHECKS : checked
  ORDERS ||--o{ LOADING_ISSUES : affects
  ORDERS ||--o{ DELIVERY_PROOFS : evidence
  ORDERS ||--o| RECEIPTS : confirmed_by
  ORDERS ||--o{ AUDIT_EVENTS : history
  TRIPS ||--o{ AUDIT_EVENTS : history
  SYNC_OPERATIONS ||--|| DELIVERY_PROOFS : deduplicates
```

## State ownership

| Data | Source of truth |
| --- | --- |
| Accounts and operational scope | PostgreSQL users table and signed server session |
| Orders, vehicles, trips and manifest version | PostgreSQL |
| Loading checks and discrepancies | PostgreSQL |
| Synchronized driver evidence | PostgreSQL delivery proofs |
| Store confirmation | Independent PostgreSQL receipt record |
| Downloaded route and unsynchronized proof | IndexedDB until synchronization |
| Important transitions | Append-only audit events |

## Integrity rules

- An order references one outlet and, when allocated, one trip.
- A vehicle/date/trip-number combination is unique.
- A loading check is unique per trip, order and manifest version.
- Resolving a shortfall increments the manifest version and removes the affected old check.
- One receipt exists per order, but it never replaces the delivery proof.
- Idempotency keys are unique across delivery proof and sync operation records.
- A revision mismatch creates a conflict record rather than applying an overwrite.
