import 'server-only';
import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

export const isDemo = () => process.env.FINGRAPH_DEMO === 'true';
declare global {
  var __finGraphDemoDb: Promise<PGlite> | undefined;
  var __finGraphDemoMutex: Promise<void> | undefined;
}
async function getDemoDb() {
  if (!globalThis.__finGraphDemoDb) globalThis.__finGraphDemoDb = (async () => {
    const folder = path.join(process.cwd(), '.data', 'demo');
    await mkdir(folder, { recursive: true });
    const db = new PGlite(folder, { extensions: { pgcrypto } });
    for (const file of ['schema.sql', 'seed.sql', 'graph.sql', 'app.sql']) await db.exec(await readFile(path.join(process.cwd(), 'database', file), 'utf8'));
    return db;
  })();
  return globalThis.__finGraphDemoDb;
}
async function lock() {
  const previous = globalThis.__finGraphDemoMutex ?? Promise.resolve();
  let unlock!: () => void;
  globalThis.__finGraphDemoMutex = new Promise(resolve => { unlock = resolve; });
  await previous;
  return unlock;
}
async function rawQuery<T extends QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
  const result = await (await getDemoDb()).query<T>(text, params);
  return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length, command: text.trim().split(/\s/)[0], oid: 0, fields: [] };
}
export async function demoQuery<T extends QueryResultRow>(text: string, params?: unknown[]) {
  const unlock = await lock();
  try { return await rawQuery<T>(text, params); } finally { unlock(); }
}
export async function demoClient(): Promise<PoolClient> {
  const unlock = await lock();
  return { query: rawQuery, release: unlock } as unknown as PoolClient;
}
export function demoPool(): Pool {
  return { query: demoQuery, connect: demoClient, end: async () => { if (globalThis.__finGraphDemoDb) await (await globalThis.__finGraphDemoDb).close(); globalThis.__finGraphDemoDb = undefined; } } as unknown as Pool;
}
