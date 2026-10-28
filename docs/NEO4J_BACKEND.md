# FinGraph Neo4j backend and UI handoff

## Scope

PostgreSQL remains authoritative. Neo4j stores `Account` nodes and directed
`TRANSFER` relationships identified by the same PostgreSQL UUIDs. This backend
adds synchronization, seven configurable detection rules, explainable alert
persistence, and authenticated APIs. Graph Analysis, Alerts and Detection Rules
are now connected to these services. See the main README for complete app setup,
browser sign-in, local demo mode and Docker Compose.

## Setup

1. Use Node.js 22.16+ (24 LTS also works), npm, the existing PostgreSQL database,
   and Neo4j Community 5.26+ or Aura. No APOC or Graph Data Science plugin is needed.
2. Run `npm ci` in this project.
3. Copy `.env.example` to `.env.local` and fill in the existing `DATABASE_URL`,
   plus `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`, and `NEO4J_DATABASE`.
   Generate `GRAPH_API_TOKEN` using
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
   Keep the token and database credentials server-side.
4. Ensure `database/schema.sql` and `database/seed.sql` have already been applied.
   Do not recreate your friend's database.
5. Run:

```sh
npm run graph:setup
npm run graph:sync
npm run graph:status
npm run graph:detect -- --dry-run
npm run graph:detect
```

`graph:setup` applies the additive, repeatable `database/graph.sql` migration and
Neo4j constraints. Existing customers, transactions, rules, and alerts remain
intact. It bootstraps 560 queue entries for the 60 accounts and 500 transactions.
Run `npm run graph:worker` in another terminal for continuous synchronization.
Run `npm run dev` for the existing application.

If Neo4j runs in Docker, an optional local example is:

```sh
docker run --name fingraph-neo4j -p 127.0.0.1:7474:7474 -p 127.0.0.1:7687:7687 -e NEO4J_AUTH=neo4j/replace-with-a-local-password neo4j:5.26
```

Alternatively, create a local database in Neo4j Desktop or use an existing Aura
instance and its `neo4j+s://` URI. The backend validates configuration lazily,
so missing Neo4j credentials do not break PostgreSQL-only pages or builds.

## Architecture and reliability

```mermaid
flowchart LR
  P[(PostgreSQL ledger)] -->|SQL triggers in same commit| O[graph_outbox]
  O -->|retryable worker| N[(Neo4j graph)]
  N -->|bounded consistent snapshot| D[Temporal graph engine]
  R[PostgreSQL detection_rules] --> D
  D -->|unique evidence fingerprint| A[PostgreSQL alerts]
  N --> G[Authenticated graph API]
  A --> UI[Existing UI integration]
  G --> UI
```

- SQL triggers capture account/transaction inserts, updates and deletes, including
  status or endpoint changes. Customer edits enqueue the owned accounts.
- One durable queue row represents the latest version of each entity. The worker
  reads the current canonical SQL record, not stale event payloads.
- `FOR UPDATE SKIP LOCKED` prevents workers processing the same queue row.
  The row lock remains held through graph commit and queue acknowledgement.
- Neo4j account/relationship uniqueness constraints and a projection lock make
  retried graph writes idempotent. A crash after graph commit leaves an event
  available for harmless replay. Concurrent workers serialize graph mutations.
- Account metadata carries its SQL outbox version. Older transfer projections
  cannot overwrite a newer account update. Detection checks the outbox revision
  as well as pending counts, including changes synchronized during analysis.
- Relationships store exact decimal **strings**. Detection uses bigint minor
  units instead of floating point. Times are UTC ISO timestamps in the API and
  Neo4j datetime properties on relationships.
- `COMPLETED` and `FLAGGED` are eligible in this repository: the seed represents
  some settled suspicious transfers as `FLAGGED`. Pending, failed, rejected and
  cancelled transfers are removed from the active projection. This assumption
  should be revisited if the meaning of FLAGGED changes.
- Failures back off exponentially, reaching a dead-letter state after five
  attempts. Errors saved to SQL are sanitized.
- `npm run graph:retry` queues failed/dead events again. `npm run graph:reconcile`
  queues all current SQL and graph IDs, including graph-only stale records;
  follow it with `npm run graph:sync`.
- Run reconciliation after restoring either database or changing eligibility.
  The Neo4j database must be dedicated to this FinGraph project.
- `TRUNCATE`, disabled SQL triggers, and manual Neo4j edits bypass ordinary
  synchronization; reconciliation is required afterwards.

## Detection behavior

Rule settings are read from the existing `detection_rules` table on every run.
The seven existing rule names map to stable codes in `src/lib/graph/rules.ts`.
Unknown rules are reported as skipped; invalid thresholds stop the run.

| Code | Conditions | Score |
| --- | --- | --- |
| CIRCULAR_FUND_ROUTING | Simple directed cycle, 3–6 hops by default, chronological transfers, <=72 hours, >=85% retained | 90 |
| MULTI_HOP_LAYERING | Simple open path, 4–6 hops, <=24 hours per hop, >=2M INR origin amount, >=85% retained | 75 |
| RAPID_VELOCITY_FLOW_THROUGH | >=90% of >=500K INR incoming transfer allocated to outflows within two hours | 65 |
| STRUCTURING_SMURFING | >=3 transfers of 900K–995K INR into one account within 48 hours | 70 |
| SHARED_INTERMEDIARY_MULE | >=4 distinct senders followed by >=3 distinct recipients within 36 hours | 80 |
| HIGH_FREQUENCY_SPLIT_DISPERSAL | >=4 distinct recipients, >=3M INR aggregate, within 60 minutes | 70 |
| DORMANT_ACCOUNT_SPIKE | >=1M INR outgoing after >=90 days without incoming/outgoing activity | 60 |

The split-transfer rule is **disabled in the supplied seed**. Enable it in the
existing rule configuration to activate it. Money thresholds are INR-specific;
currency amounts are never combined or converted. Cycles and shared
intermediaries can be detected in other currencies with matching edge currency.
Layering's configured minimum amount applies to INR only.

Every path is chronological, uses distinct accounts (apart from a cycle's closing
account), and retains at least the configured fraction of its first amount.
Layering/cycle amounts must not increase between hops. Pass-through uses a FIFO
allocation heuristic so an outgoing minor unit cannot support two incoming
receipts in the same account/currency evaluation. This does not establish actual
fund provenance. Shared intermediary findings require consolidation before
dispersal; high volume alone does not match that rule.

The engine traverses a consistent Neo4j snapshot in TypeScript. Cypher provides
projection reads, writes, locking and constraints; `database/detection.cypher`
provides bounded native traversal examples for the Neo4j Browser/report. The
TypeScript engine additionally handles exact monetary arithmetic, all seven
rules, canonical fingerprints and a shared traversal budget. This approach is
appropriate for the 500-transfer classroom dataset.

Limits: 5,000 accounts, 10,000 projected edges, 6 path hops, 250,000 examination
steps, and 1,000 findings. Capacity exhaustion fails explicitly with no findings
persisted. Graph exploration can return at most 500 edges and reports truncation.
There is no silent truncation of the detection input. Scale beyond these limits
requires scoped, indexed database-side candidate generation.

Scores are transparent, illustrative per-pattern weights, capped in the 0–100
range. Severity uses LOW <25, MEDIUM <50, HIGH <75, CRITICAL >=75. Overlapping
findings are **not added** into an account-level risk score. Rule version and
effective thresholds are included in the evidence. A fingerprint of the rule,
threshold version, currency and sorted transaction IDs deduplicates reruns and
cycle rotations. Existing manually seeded alerts have no fingerprint and are
retained separately. Changing thresholds creates a new evidence version.
Repeated runs preserve closed/investigating alert dispositions.

## APIs for frontend integration

All graph data and operation endpoints accept the signed investigator session
or `Authorization: Bearer <GRAPH_API_TOKEN>`. Missing configuration returns 503;
missing/wrong credentials return 401. Never embed the operator token in client
React code or a `NEXT_PUBLIC_` variable. The UI signs in through an HttpOnly,
SameSite cookie. Browser writes check Origin; API clients can use the bearer key.
This shared-key prototype does not provide per-user enterprise roles.

| Method | Path | Request/result |
| --- | --- | --- |
| GET | `/api/graph?accountId=<uuid>&depth=2&limit=100` | `{nodes, edges, meta, sync}` |
| GET | `/api/graph/sync` | Queue counts and latest synchronization time |
| POST | `/api/graph/sync` | `{ "batchSize": 100 }` (1–500); returns batch and total queue counts |
| GET | `/api/detection/rules` | Existing rule configuration, code, effective thresholds |
| POST | `/api/detection/run` | `{ "persist": true }`; run ID, findings, created/duplicate counts |
| GET | `/api/graph/health` | Sanitized Neo4j connectivity, no credentials or graph data; no token required |

Graph query filters also accept `startDate` and `endDate` as ISO timestamps with
timezone offsets. Neighborhood expansion follows incoming and outgoing links up
to `depth`; transfer edges retain their actual direction. Edges include `id`,
`source`, `target`, `amount` (decimal string), `currency`, `status`, `occurredAt`.
Nodes include `id`, `accountNumber`, `customerId`, `customerName`, currency/status,
and creation time. `meta.truncated` indicates the display limit was reached.

Detection returns 409 while events are pending, failed or dead. Run the worker
and retry first. Malformed input returns 400, capacity exhaustion returns 422,
database/setup failures return a sanitized 503. A preview (`persist:false` or
`graph:detect -- --dry-run`) still records a detection-run summary but creates
no alerts. Findings include rule IDs, versions, exact transaction IDs, account
paths, decimal amounts, timestamps, thresholds, metrics, risk score and severity.
The existing PostgreSQL alerts query can display persisted findings.

PowerShell API example (after setting `.env.local` and starting the app):

```powershell
$headers = @{ Authorization = "Bearer YOUR_GRAPH_API_TOKEN" }
Invoke-RestMethod 'http://localhost:3000/api/graph?depth=2&limit=100' -Headers $headers
Invoke-RestMethod 'http://localhost:3000/api/detection/run' -Method Post -Headers $headers -ContentType 'application/json' -Body '{"persist":false}'
```

## Verification and dataset caveats

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

The default suite covers positive and negative patterns, timestamps, eligibility,
currency isolation, exact amounts, disabled/invalid rules, authentication, request
validation, SQL trigger rollback and the actual 500-transaction seed. PGlite runs
the PostgreSQL schema and migration in a disposable embedded PostgreSQL engine;
it does not test the production pg TCP pool or multi-worker row locking.

An opt-in suite uses **real Neo4j** and PGlite for import, reconciliation,
deduplication, alert dispositions, cancellation/endpoint/deletion propagation,
and outage recovery. Start a disposable Neo4j server on `127.0.0.1:17687` with
user `neo4j`, test password `fingraph-test-only-2026`, and database `neo4j`.
Use only a disposable test database. Then, in PowerShell:

```powershell
$env:FINGRAPH_TEST_NEO4J_URI = 'bolt://127.0.0.1:17687'
npm test -- tests/neo4j.integration.test.ts
Remove-Item Env:FINGRAPH_TEST_NEO4J_URI
```

The supplied SQL seed's dormant spike descriptions do not match its account
history: accounts 55 and 56 have creation timestamps later than transfers 43 and
44. Those records cannot support a 90-day inactivity finding. The engine rejects
that interpretation; dedicated synthetic tests verify actual dormant history.
Some demo alerts likewise describe looser windows than the enabled rules. Use
actual transaction timestamps/configuration when explaining engine findings.

These are investigation indicators on synthetic data. No real-world detection
precision/recall claims follow from passing the planted-scenario tests.

### Initial backend verification (26 October 2026)

- Full suite: **34 tests passed**, including six integration tests using a real
  temporary Neo4j Community 2026.10.1 server and embedded PostgreSQL.
- Default offline suite: 28 tests; six real-server tests are opt-in.
- Actual seed evaluation: 10 findings across five enabled pattern types.
  This is a reproducibility observation, not a precision/recall estimate.
- TypeScript and production build passed. ESLint had no errors and one existing
  TanStack Table/React Compiler warning in `src/app/transactions/page.tsx`.
- Dependency audit reported zero vulnerabilities after updating the test runner.
- Replaced the original custom Tailwind Turbopack stylesheet loader with the
  standard `@tailwindcss/postcss` configuration to fix its production build crash.
- Real PostgreSQL TCP connectivity and concurrent worker behavior still need
  verification against the team's configured PostgreSQL server. No `.env.local`
  or user database credentials were available in this checkout.

### Completed application verification

The UI integration now includes graph controls, evidence highlighting, rule
editing, alert reviews/notes/history, transaction entry/details and browser
sessions. The current default suite passes 48 tests; eleven database integration
tests remain opt-in. All eleven integration checks passed during the audit
against real PostgreSQL 18 and Neo4j Community 2026.10.1. See [the audit report](AUDIT.md). A running local-demo smoke test passed sign-in, authorization,
rule editing, audited reviews, idempotent transaction creation, stale-graph
rejection, synchronization, detection, deduplication and detail queries.
Browser checks verified detection results, saved case reviews and transaction
entry. The full application production build and TypeScript checks passed.

Local demo mode explicitly uses PGlite and a saved graph projection. Docker
Compose supplies the actual PostgreSQL + Neo4j services, initializer, app and
worker; container startup could not be executed because Docker is not installed
on this development machine. See README.md for the complete run instructions.
