# FinGraph audit — 26 October 2026

The audit found and fixed issues beyond the original happy-path tests. The
verified application paths pass; the remaining limits are listed below.

## Fixed

| Area | Finding and correction |
| --- | --- |
| Session validation | A malformed multibyte signature could throw instead of returning an unauthorized response. Compare byte lengths before the constant-time comparison. |
| Sign-in redirects | Normalize return URLs before accepting them, preventing newline/backslash URL tricks from navigating outside the app. |
| Demo startup | Force the demo's own browser origin even when live settings exist, pin port 3000, and check it before opening the demo database. |
| Pagination | An out-of-range transaction page reported the last page but returned first-page rows. Clamp the actual offset to the last page. |
| Date filtering | Date-only end filters stopped at midnight. End dates now include the whole selected UTC day; impossible dates and reversed ranges are rejected. |
| Currency reporting | Foreign-currency amounts could inflate INR summaries and display with a rupee symbol. INR aggregates now exclude other currencies and ledger rows show their actual currency. |
| Detection consistency | A ledger change could be processed completely during analysis and evade the pending-event checks. Record/check a monotonic outbox revision before accepting the result. |
| Concurrent graph updates | A delayed transfer projection could overwrite newer account metadata. Read the account's outbox version with its data and reject older versions in Neo4j. Reproduced with a failing real-database test, then verified fixed. |
| Intermediary detection | A later unrelated receipt could hide a completed fan-in/fan-out burst. Evaluate windows at outgoing events and retain maximal burst evidence; a dedicated regression also checks that growing bursts do not create duplicate prefixes. |
| Review conflicts | TIMESTAMPTZ changes within one millisecond could share the same client-visible update token. The update trigger now advances timestamps monotonically by at least one millisecond. |
| Input validation | Unknown threshold names were silently discarded. Rule schemas now reject unsupported keys. New completed transfers cannot precede account creation or be future-dated. |
| UI | Closed mobile navigation no longer exposes off-screen controls; navigation/dialogs have accessible names; reporting and UTC date labels are explicit. |

## Verification

- **58 tests passed** in the combined real-database run: 47 default
  tests, six real-Neo4j/embedded-PostgreSQL tests and five tests using actual
  PostgreSQL **18** plus Neo4j Community **2026.10.1**.
- After the final pure-detector edge-case fix, the default suite passed **48
  tests** (59 total tests, with the eleven opt-in database tests skipped in that
  final offline run). The end-to-end smoke test was also rerun successfully.
- Real services used separate loopback test ports, temporary storage and
  disposable credentials. The team's database was not modified.
- Real-database checks included parallel synchronization workers, transaction
  rollback/outbox atomicity, concurrent idempotent transfer retries, persisted
  findings, duplicate prevention and delayed metadata updates.
- Expanded HTTP smoke test passed on the restarted local demo, including
  malformed cookies, inclusive dates, pagination, rule validation, reviews,
  transaction creation, synchronization and detection.
- Production build and TypeScript passed; dependency audit found **zero known
  vulnerabilities**. Lint has no errors and one existing non-blocking TanStack
  Table/React Compiler warning.
- The production standalone package excludes `.data` and `.env.local`.
- Browser checks covered mobile navigation and horizontal layout on Graph,
  Transactions, Detection Rules and Alerts at a 390-pixel viewport.

## Remaining limits

1. Docker is not installed here. Compose configuration was parsed and the
   initializer/services tested independently, but Docker container startup and
   the exact PostgreSQL 16 / Neo4j 5.26 image combination were not run.
2. The original seed contains **two** transfers (43 and 44) dated before accounts
   55/56 were created. Their descriptions therefore cannot demonstrate a 90-day
   dormant-account gap. The engine does not invent that history; dedicated
   synthetic tests verify valid dormancy cases. The supplied seed was preserved.
3. This remains a shared-key academic prototype with bounded graph analysis and
   heuristic attribution, not a production banking/AML platform. Synthetic tests
   do not establish real-world detection accuracy.

## Applying the fixes to an existing live installation

After updating the source, apply the additive migration and reconcile old graph
metadata:

```sh
npm run graph:setup
npm run graph:reconcile
npm run graph:sync
```

Restart the application and worker. Fresh initialization now performs this
reconciliation automatically. `npm run demo` applies the migration automatically.

To opt into the complete integration run, use disposable PostgreSQL and Neo4j
servers as defined by `tests/live-databases.integration.test.ts` and
`tests/neo4j.integration.test.ts`, then set both `FINGRAPH_TEST_DATABASE_URL` and
`FINGRAPH_TEST_NEO4J_URI`. Those suites intentionally reject arbitrary database
addresses. Keep these test services separate from the team's database.
