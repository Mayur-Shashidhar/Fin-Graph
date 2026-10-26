import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { beforeAll, afterAll, it, expect } from 'vitest';
import { detectPatterns } from '../src/lib/graph/engine';
import type { GraphAccount, GraphTransfer } from '../src/types/graph';
import type { DetectionRule } from '../src/types/database';

let db: PGlite;
const id = (n: number) => `b0000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
beforeAll(async () => {
  db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(await readFile('database/schema.sql', 'utf8'));
  await db.exec(await readFile('database/seed.sql', 'utf8'));
  await db.exec(await readFile('database/graph.sql', 'utf8'));
});
afterAll(async () => { await db?.close(); });

it('bootstraps 560 sync events, reruns safely and leaves seeded data intact', async () => {
  await db.exec(await readFile('database/graph.sql', 'utf8'));
  expect((await db.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM graph_outbox')).rows[0].count).toBe(560);
  expect((await db.query<{ count: number }>('SELECT COUNT(*)::int AS count FROM transactions')).rows[0].count).toBe(500);
});

it('queues committed changes atomically and rolls back synchronization events with SQL changes', async () => {
  await db.exec('BEGIN');
  await db.query(`UPDATE graph_outbox SET status = 'PROCESSED' WHERE entity_id = $1`, [id(1)]);
  await db.query(`UPDATE transactions SET amount = amount + 1 WHERE id = $1`, [id(1)]);
  expect((await db.query<{ status: string }>('SELECT status FROM graph_outbox WHERE entity_id = $1', [id(1)])).rows[0].status).toBe('PENDING');
  await db.exec('ROLLBACK');
  expect((await db.query<{ version: number }>('SELECT version::int FROM graph_outbox WHERE entity_id = $1', [id(1)])).rows[0].version).toBe(1);
});

it('captures status changes, customer metadata edits, and transaction deletions', async () => {
  await db.exec('BEGIN');
  await db.query(`UPDATE transactions SET status = 'CANCELLED' WHERE id = $1`, [id(2)]);
  expect((await db.query<{ version: number }>('SELECT version::int FROM graph_outbox WHERE entity_id = $1', [id(2)])).rows[0].version).toBe(2);
  await db.query(`UPDATE customers SET full_name = 'Updated synthetic customer' WHERE id = 'c0000000-0000-0000-0000-000000000001'`);
  expect((await db.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM graph_outbox WHERE entity_type = 'ACCOUNT' AND version > 1`)).rows[0].count).toBeGreaterThan(0);
  await db.query('DELETE FROM transactions WHERE id = $1', [id(500)]);
  expect((await db.query<{ version: number }>('SELECT version::int FROM graph_outbox WHERE entity_id = $1', [id(500)])).rows[0].version).toBe(2);
  await db.exec('ROLLBACK');
});

it('detects planted scenarios using actual SQL seed records and enabled rule configuration', async () => {
  const nodes = (await db.query<GraphAccount>(`SELECT a.id, a.account_number AS "accountNumber", a.customer_id AS "customerId", c.full_name AS "customerName", a.currency, a.status, a.created_at AS "createdAt" FROM accounts a JOIN customers c ON c.id = a.customer_id`)).rows;
  const edges = (await db.query<GraphTransfer>(`SELECT id, source_account_id AS source, destination_account_id AS target, amount::text, currency, status, occurred_at AS "occurredAt" FROM transactions`)).rows.map(e => ({ ...e, occurredAt: new Date(e.occurredAt).toISOString() }));
  const rules = (await db.query<DetectionRule>('SELECT * FROM detection_rules')).rows;
  const result = detectPatterns({ nodes, edges }, rules);
  const includes = (code: string, transactions: number[]) => result.findings.some(f => f.ruleCode === code && transactions.every(n => f.evidence.transactionIds.includes(id(n))));
  expect(includes('CIRCULAR_FUND_ROUTING', [1, 2, 3])).toBe(true);
  expect(includes('CIRCULAR_FUND_ROUTING', [14, 15, 16, 17, 18])).toBe(true);
  expect(includes('STRUCTURING_SMURFING', [4, 5, 7, 8])).toBe(true);
  expect(includes('RAPID_VELOCITY_FLOW_THROUGH', [9, 10, 11, 12])).toBe(true);
  expect(includes('MULTI_HOP_LAYERING', [19, 20, 21, 22])).toBe(true);
  expect(includes('SHARED_INTERMEDIARY_MULE', [24, 25, 26, 27, 28, 29, 30])).toBe(true);
  expect(result.findings.some(f => f.ruleCode === 'HIGH_FREQUENCY_SPLIT_DISPERSAL')).toBe(false);
  // Existing seed dormancy descriptions conflict with account creation dates;
  // do not fabricate 90 days of history from a demo alert description.
  expect(includes('DORMANT_ACCOUNT_SPIKE', [43])).toBe(false);
  expect(includes('DORMANT_ACCOUNT_SPIKE', [44])).toBe(false);
  console.log('Seed detection:', JSON.stringify({ findings: result.findings.length, operations: result.operations, rules: [...new Set(result.findings.map(f => f.ruleCode))] }));
});
