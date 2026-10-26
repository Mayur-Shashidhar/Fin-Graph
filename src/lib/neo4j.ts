import 'server-only';
import neo4j, { type Driver, type ManagedTransaction } from 'neo4j-driver';
import { getNeo4jConfig, QUERY_TIMEOUT_MS } from './graph/config';
import { isDemo } from './demo';

declare global {
  var __finGraphNeo4j: Driver | undefined;
}

export function getGraphDriver(): Driver {
  if (!globalThis.__finGraphNeo4j) {
    const env = getNeo4jConfig();
    globalThis.__finGraphNeo4j = neo4j.driver(
      env.NEO4J_URI, neo4j.auth.basic(env.NEO4J_USERNAME, env.NEO4J_PASSWORD),
      { connectionTimeout: 5000, connectionAcquisitionTimeout: 5000, maxTransactionRetryTime: 5000, maxConnectionPoolSize: 10 },
    );
  }
  return globalThis.__finGraphNeo4j;
}

export async function graphTransaction<T>(mode: 'read' | 'write', work: (tx: ManagedTransaction) => Promise<T>): Promise<T> {
  const session = getGraphDriver().session({ database: getNeo4jConfig().NEO4J_DATABASE });
  try {
    return await (mode === 'read' ? session.executeRead(work, { timeout: QUERY_TIMEOUT_MS }) : session.executeWrite(work, { timeout: QUERY_TIMEOUT_MS }));
  } finally {
    await session.close();
  }
}

export async function closeGraphDriver() {
  await globalThis.__finGraphNeo4j?.close();
  globalThis.__finGraphNeo4j = undefined;
}

export async function initializeGraph() {
  for (const statement of [
    'CREATE CONSTRAINT fingraph_account_id IF NOT EXISTS FOR (a:Account) REQUIRE a.accountId IS UNIQUE',
    'CREATE CONSTRAINT fingraph_transfer_id IF NOT EXISTS FOR ()-[t:TRANSFER]-() REQUIRE t.transactionId IS UNIQUE',
    'CREATE CONSTRAINT fingraph_projection_lock IF NOT EXISTS FOR (l:FinGraphLock) REQUIRE l.id IS UNIQUE',
    'CREATE INDEX fingraph_transfer_time IF NOT EXISTS FOR ()-[t:TRANSFER]-() ON (t.occurredAt)',
  ]) await graphTransaction('write', async tx => { await tx.run(statement); });
}

export async function checkGraphHealth() {
  if (isDemo()) return { connected: true, responseTimeMs: 0, engine: 'local-demo', notice: 'Local demo projection; Neo4j is not enabled.' };
  const start = Date.now();
  try {
    await graphTransaction('read', async tx => { await tx.run('RETURN 1 AS ping'); });
    return { connected: true, responseTimeMs: Date.now() - start };
  } catch {
    return { connected: false, responseTimeMs: Date.now() - start, error: 'Neo4j is unavailable or not configured' };
  }
}
