import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFile } from 'node:fs/promises';
import neo4j from 'neo4j-driver';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';

const store = vi.hoisted(() => ({ db: null as PGlite | null }));
vi.mock('../src/lib/db', () => {
  const query = async (sql: string, params?: unknown[]) => {
    const result = await store.db!.query(sql, params);
    return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
  };
  return { query, getClient: async () => ({ query, release() {} }) };
});

import { initializeGraph, closeGraphDriver, graphTransaction } from '../src/lib/neo4j';
import { syncGraph, getSyncStatus, reconcileGraph, retryFailedEvents } from '../src/lib/graph/sync';
import { loadGraphSnapshot } from '../src/lib/graph/repository';
import { runDetection, ProjectionLagError } from '../src/lib/graph/detection';

// Explicit opt-in: this suite requires the disposable test server described in
// docs/NEO4J_BACKEND.md. Never point it at a shared development/Aura database.
describe.skipIf(process.env.FINGRAPH_TEST_NEO4J_URI !== 'bolt://127.0.0.1:17687')('real Neo4j + embedded PostgreSQL integration', () => {
  beforeAll(async () => {
    vi.stubEnv('NEO4J_URI', process.env.FINGRAPH_TEST_NEO4J_URI!);
    vi.stubEnv('NEO4J_USERNAME', 'neo4j');
    vi.stubEnv('NEO4J_PASSWORD', 'fingraph-test-only-2026');
    vi.stubEnv('NEO4J_DATABASE', 'neo4j');
    store.db = new PGlite({ extensions: { pgcrypto } });
    await store.db.exec(await readFile('database/schema.sql', 'utf8'));
    await store.db.exec(await readFile('database/seed.sql', 'utf8'));
    await store.db.exec(await readFile('database/graph.sql', 'utf8'));
    await initializeGraph();
    // Keep fresh PostgreSQL fixtures aligned with a fresh graph on repeat runs.
    await graphTransaction('write',async tx=>{await tx.run("MATCH (a:Account) WHERE a.accountId STARTS WITH 'a0000000-0000-0000-0000-' DETACH DELETE a");});
  });
  afterAll(async () => { await closeGraphDriver(); await store.db?.close(); vi.unstubAllEnvs(); });

  it('rejects detection before synchronization and imports the full seed projection', async () => {
    await expect(runDetection()).rejects.toBeInstanceOf(ProjectionLagError);
    await syncGraph(500); await syncGraph(500);
    expect((await getSyncStatus()).pending).toBe(0);
    const graph = await loadGraphSnapshot();
    expect(graph.nodes).toHaveLength(60);
    const count = (await store.db!.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM transactions WHERE status IN ('COMPLETED', 'FLAGGED')`)).rows[0].count;
    expect(graph.edges).toHaveLength(count);
    expect(new Set(graph.edges.map(e => e.id)).size).toBe(count);
  }, 120000);
  it('reconciliation is idempotent and does not duplicate relationships', async () => {
    const before = await loadGraphSnapshot();
    await reconcileGraph();
    await syncGraph(500); await syncGraph(500);
    const after = await loadGraphSnapshot();
    expect(after.edges.map(e => e.id).sort()).toEqual(before.edges.map(e => e.id).sort());
  }, 120000);
  it('executes the native Cypher examples against the imported graph', async () => {
    const source = await readFile('database/detection.cypher', 'utf8');
    const statements = source.replace(/^\/\/.*$/gm, '').split(';').map(s => s.trim()).filter(Boolean);
    expect(statements).toHaveLength(3);
    for (const statement of statements) {
      const count = await graphTransaction('read', async tx => {
        const result = await tx.run(statement, { currency: 'INR', windowHours: 72, retention: 0.85, minAmount: 2000000, hopHours: 24, velocityHours: 2, limit: neo4j.int(100) });
        return result.records.length;
      });
      expect(count).toBeGreaterThan(0);
    }
  });
  it('persists explainable alerts once and preserves investigation status on reruns', async () => {
    const first = await runDetection();
    expect(first.created).toBeGreaterThan(0);
    expect(first.findings.some(f => f.ruleCode === 'CIRCULAR_FUND_ROUTING')).toBe(true);
    await store.db!.query(`UPDATE alerts SET status = 'CLOSED_FALSE_POSITIVE' WHERE detection_fingerprint = $1`, [first.findings[0].fingerprint]);
    const second = await runDetection();
    expect(second.created).toBe(0); expect(second.duplicates).toBe(first.findingCount);
    const status = await store.db!.query<{ status: string }>('SELECT status FROM alerts WHERE detection_fingerprint = $1', [first.findings[0].fingerprint]);
    expect(status.rows[0].status).toBe('CLOSED_FALSE_POSITIVE');
  });
  it('removes cancelled transfers, reprojects completed transfers, and propagates endpoint changes/deletion', async () => {
    const id = 'b0000000-0000-0000-0000-000000000001';
    await store.db!.query(`UPDATE transactions SET status = 'CANCELLED' WHERE id = $1`, [id]);
    await syncGraph(); expect((await loadGraphSnapshot()).edges.some(e => e.id === id)).toBe(false);
    await store.db!.query(`UPDATE transactions SET status = 'COMPLETED', destination_account_id = 'a0000000-0000-0000-0000-000000000008' WHERE id = $1`, [id]);
    await syncGraph();
    const changed = (await loadGraphSnapshot()).edges.filter(e => e.id === id);
    expect(changed).toHaveLength(1); expect(changed[0].target).toBe('a0000000-0000-0000-0000-000000000008');
    await store.db!.query('DELETE FROM transactions WHERE id = $1', [id]);
    await syncGraph(); expect((await loadGraphSnapshot()).edges.some(e => e.id === id)).toBe(false);
  });
  it('records failures durably, retries dead letters, and recovers after a graph error', async () => {
    // A closed test port simulates a database outage without stopping the server.
    await closeGraphDriver(); vi.stubEnv('NEO4J_URI', 'bolt://127.0.0.1:17688');
    await store.db!.query(`UPDATE accounts SET status = 'UNDER_REVIEW' WHERE id = 'a0000000-0000-0000-0000-000000000001'`);
    const result = await syncGraph(1); expect(result.batchFailed).toBe(1);
    expect((await getSyncStatus()).failed).toBe(1);
    await store.db!.query(`UPDATE graph_outbox SET status = 'DEAD' WHERE status = 'FAILED'`);
    await retryFailedEvents();
    await closeGraphDriver(); vi.stubEnv('NEO4J_URI', 'bolt://127.0.0.1:17687');
    await syncGraph(); expect((await getSyncStatus()).dead).toBe(0); expect((await getSyncStatus()).pending).toBe(0);
  });
});
