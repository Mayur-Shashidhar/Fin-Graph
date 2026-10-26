import 'server-only';
import type { PoolClient } from 'pg';
import { getClient, query } from '../db';
import { graphTransaction } from '../neo4j';
import { ELIGIBLE_STATUSES } from './config';
import type { GraphAccount, GraphTransfer } from '../../types/graph';
import { isDemo } from '../demo';
import { syncDemoProjection } from './demo-projection';

export const ACCOUNT_SQL = `SELECT a.id, a.account_number AS "accountNumber", a.customer_id AS "customerId",
  c.full_name AS "customerName", a.currency, a.status, a.created_at AS "createdAt",
  COALESCE(o.version, 1)::text AS "projectionVersion"
  FROM accounts a JOIN customers c ON c.id = a.customer_id
  LEFT JOIN graph_outbox o ON o.entity_type = 'ACCOUNT' AND o.entity_id = a.id`;
const toAccount = (row: GraphAccount): GraphAccount => ({ ...row, createdAt: new Date(row.createdAt).toISOString() });

// A dedicated lock node serializes projection mutations, including independent workers.
// It also gives snapshot reads a consistent projection boundary.
export const PROJECTION_LOCK = `MERGE (l:FinGraphLock {id: 'projection'}) SET l.revision = coalesce(l.revision, 0) + 1`;
const UPSERT_ACCOUNT = `MERGE (a:Account {accountId: $account.id})
  WITH a
  WHERE a.projectionVersion IS NULL OR toInteger(a.projectionVersion) <= toInteger($account.projectionVersion)
  SET a.accountNumber = $account.accountNumber, a.customerId = $account.customerId,
      a.customerName = $account.customerName, a.currency = $account.currency,
      a.status = $account.status, a.createdAt = $account.createdAt,
      a.projectionVersion = $account.projectionVersion`;

export async function projectEntity(client: PoolClient, kind: string, id: string) {
  if (kind === 'ACCOUNT') {
    const result = await client.query<GraphAccount>(`${ACCOUNT_SQL} WHERE a.id = $1`, [id]);
    await graphTransaction('write', async tx => {
      await tx.run(PROJECTION_LOCK);
      if (result.rows[0]) await tx.run(UPSERT_ACCOUNT, { account: toAccount(result.rows[0]) });
      else await tx.run('MATCH (a:Account {accountId: $id}) DETACH DELETE a', { id });
    });
    return;
  }
  const result = await client.query<GraphTransfer>(`SELECT id, source_account_id AS source,
    destination_account_id AS target, amount::text, currency, status, occurred_at AS "occurredAt"
    FROM transactions WHERE id = $1`, [id]);
  const transfer = result.rows[0];
  const accounts = transfer ? await client.query<GraphAccount>(`${ACCOUNT_SQL} WHERE a.id = ANY($1::uuid[])`, [[transfer.source, transfer.target]]) : { rows: [] };
  await graphTransaction('write', async tx => {
    await tx.run(PROJECTION_LOCK);
    // Delete by stable transfer ID first: endpoint changes, deletions and ineligible
    // status updates cannot leave an old edge behind. Delete + create is atomic.
    await tx.run('MATCH ()-[t:TRANSFER {transactionId: $id}]->() DELETE t', { id });
    if (!transfer || !ELIGIBLE_STATUSES.includes(transfer.status)) return;
    for (const account of accounts.rows) await tx.run(UPSERT_ACCOUNT, { account: toAccount(account) });
    await tx.run(`MATCH (a:Account {accountId: $source}), (b:Account {accountId: $target})
      CREATE (a)-[t:TRANSFER {transactionId: $id}]->(b)
      SET t.amount = $amount, t.currency = $currency, t.status = $status,
          t.occurredAt = datetime($occurredAt)`, { ...transfer, occurredAt: new Date(transfer.occurredAt).toISOString() });
  });
}

export async function syncGraph(limit = 100) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('Invalid sync batch size');
  if (isDemo()) return { ...(await syncDemoProjection()), ...(await getSyncStatus()) };
  let processed = 0, failed = 0;
  for (let i = 0; i < limit; i++) {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      // Each entity stays locked until graph commit AND queue acknowledgement.
      const events = await client.query<{ entity_type: string; entity_id: string; attempts: number }>(`
        SELECT entity_type, entity_id, attempts FROM graph_outbox
        WHERE status IN ('PENDING', 'FAILED') AND available_at <= NOW()
        ORDER BY available_at, entity_type, entity_id LIMIT 1 FOR UPDATE SKIP LOCKED`);
      const event = events.rows[0];
      if (!event) { await client.query('COMMIT'); break; }
      try {
        await projectEntity(client, event.entity_type, event.entity_id);
      } catch {
        // Never persist a driver error: it can contain credentials or hostnames.
        await client.query(`UPDATE graph_outbox SET attempts = attempts + 1,
          status = CASE WHEN attempts + 1 >= 5 THEN 'DEAD' ELSE 'FAILED' END,
          available_at = NOW() + (LEAST(300, POWER(2, attempts + 1)) * INTERVAL '1 second'),
          last_error = 'Graph projection failed; check database connectivity', updated_at = NOW()
          WHERE entity_type = $1 AND entity_id = $2`, [event.entity_type, event.entity_id]);
        await client.query('COMMIT'); failed++; continue;
      }
      await client.query(`UPDATE graph_outbox SET status = 'PROCESSED', processed_at = NOW(),
        last_error = NULL, updated_at = NOW() WHERE entity_type = $1 AND entity_id = $2`, [event.entity_type, event.entity_id]);
      await client.query('COMMIT'); processed++;
    } catch (error) {
      await client.query('ROLLBACK'); throw error;
    } finally { client.release(); }
  }
  return { batchProcessed: processed, batchFailed: failed, ...(await getSyncStatus()) };
}

export async function getSyncStatus() {
  const result = await query<{ pending: number; failed: number; dead: number; processed: number; revision: string; lastSyncedAt: Date | null }>(`
    SELECT COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
      COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed,
      COUNT(*) FILTER (WHERE status = 'DEAD')::int AS dead,
      COUNT(*) FILTER (WHERE status = 'PROCESSED')::int AS processed,
      COALESCE(SUM(version), 0)::text AS revision,
      MAX(processed_at) AS "lastSyncedAt" FROM graph_outbox`);
  return result.rows[0];
}

export async function retryFailedEvents() {
  return query(`UPDATE graph_outbox SET status = 'PENDING', attempts = 0,
    available_at = NOW(), last_error = NULL WHERE status IN ('FAILED', 'DEAD')`);
}

/** Re-enqueue canonical records and graph-only IDs to reconcile stale edges/nodes. */
export async function reconcileGraph() {
  if (isDemo()) { await syncDemoProjection(); return; }
  const graphIds = await graphTransaction('read', async tx => {
    const nodes = await tx.run('MATCH (a:Account) RETURN a.accountId AS id');
    const edges = await tx.run('MATCH ()-[t:TRANSFER]->() RETURN t.transactionId AS id');
    return { accounts: nodes.records.map(r => r.get('id') as string), transfers: edges.records.map(r => r.get('id') as string) };
  });
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT enqueue_graph_entity('ACCOUNT', id) FROM (
      SELECT id FROM accounts UNION SELECT unnest($1::uuid[]) AS id) a`, [graphIds.accounts]);
    await client.query(`SELECT enqueue_graph_entity('TRANSACTION', id) FROM (
      SELECT id FROM transactions UNION SELECT unnest($1::uuid[]) AS id) t`, [graphIds.transfers]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
