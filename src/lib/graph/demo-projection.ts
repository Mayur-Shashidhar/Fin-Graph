import 'server-only';
import { getClient, query } from '../db';
import type { GraphSnapshot, GraphAccount, GraphTransfer } from '../../types/graph';

export async function syncDemoProjection() {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const nodes = await client.query<GraphAccount>(`SELECT a.id, a.account_number AS "accountNumber", a.customer_id AS "customerId", c.full_name AS "customerName", a.currency, a.status, a.created_at AS "createdAt" FROM accounts a JOIN customers c ON c.id = a.customer_id`);
    const edges = await client.query<GraphTransfer>(`SELECT id, source_account_id AS source, destination_account_id AS target, amount::text, currency, status, occurred_at AS "occurredAt" FROM transactions WHERE status IN ('COMPLETED', 'FLAGGED')`);
    const snapshot: GraphSnapshot = {
      nodes: nodes.rows.map(n => ({ ...n, createdAt: new Date(n.createdAt).toISOString() })),
      edges: edges.rows.map(e => ({ ...e, occurredAt: new Date(e.occurredAt).toISOString() })),
    };
    await client.query(`INSERT INTO demo_graph_projection(id, snapshot) VALUES (1, $1::jsonb) ON CONFLICT (id) DO UPDATE SET snapshot = EXCLUDED.snapshot, synced_at = NOW()`, [JSON.stringify(snapshot)]);
    const result = await client.query(`UPDATE graph_outbox SET status = 'PROCESSED', processed_at = NOW(), last_error = NULL WHERE status <> 'PROCESSED'`);
    await client.query('COMMIT');
    return { batchProcessed: result.rowCount ?? 0, batchFailed: 0 };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export async function loadDemoProjection(): Promise<GraphSnapshot> {
  const result = await query<{ snapshot: GraphSnapshot }>('SELECT snapshot FROM demo_graph_projection WHERE id = 1');
  return result.rows[0]?.snapshot ?? { nodes: [], edges: [] };
}
