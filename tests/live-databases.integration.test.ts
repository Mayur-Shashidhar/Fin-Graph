import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { getClient, getDbPool, query } from '../src/lib/db';
import { initializeGraph, closeGraphDriver, graphTransaction } from '../src/lib/neo4j';
import { ACCOUNT_SQL, getSyncStatus, projectEntity, syncGraph, reconcileGraph } from '../src/lib/graph/sync';
import { loadGraphSnapshot } from '../src/lib/graph/repository';
import { createTransfer, transferSchema } from '../src/lib/workflows';
import { runDetection } from '../src/lib/graph/detection';
import type { GraphAccount } from '../src/types/graph';

const databaseUrl='postgresql://fingraph_test:fingraph-audit-only-2026@127.0.0.1:15432/fingraph_audit';
const enabled=process.env.FINGRAPH_TEST_DATABASE_URL===databaseUrl&&process.env.FINGRAPH_TEST_NEO4J_URI==='bolt://127.0.0.1:17687';
// Requires freshly initialized, disposable services at these exact test addresses.
describe.skipIf(!enabled)('actual PostgreSQL and Neo4j integration',()=>{
  beforeAll(async()=>{
    vi.stubEnv('DATABASE_URL',databaseUrl);vi.stubEnv('FINGRAPH_DEMO','false');
    vi.stubEnv('NEO4J_URI','bolt://127.0.0.1:17687');vi.stubEnv('NEO4J_USERNAME','neo4j');
    vi.stubEnv('NEO4J_PASSWORD','fingraph-test-only-2026');vi.stubEnv('NEO4J_DATABASE','neo4j');
    for(const file of ['schema.sql','seed.sql','graph.sql','app.sql'])await getDbPool().query(await readFile(`database/${file}`,'utf8'));
    await initializeGraph();
    // Reset only this suite's synthetic fixtures on the explicit disposable server.
    await graphTransaction('write',async tx=>{await tx.run("MATCH (a:Account) WHERE a.accountId STARTS WITH 'a0000000-0000-0000-0000-' DETACH DELETE a");});
    await reconcileGraph();
  });
  afterAll(async()=>{await closeGraphDriver();await globalThis.__finGraphPgPool?.end();globalThis.__finGraphPgPool=undefined;vi.unstubAllEnvs();});
  it('imports the seed with concurrent workers without duplicate edges',async()=>{
    await Promise.all([syncGraph(300),syncGraph(300)]);
    while((await getSyncStatus()).pending)await syncGraph(500);
    const state=await getSyncStatus();expect(state.failed+state.dead+state.pending).toBe(0);
    const snapshot=await loadGraphSnapshot();
    const count=await query<{count:number}>(`SELECT COUNT(*)::int AS count FROM transactions WHERE status IN ('COMPLETED','FLAGGED')`);
    expect(snapshot.nodes).toHaveLength(60);expect(snapshot.edges).toHaveLength(count.rows[0].count);
    expect(new Set(snapshot.edges.map(e=>e.id)).size).toBe(snapshot.edges.length);
  },120000);
  it('rolls back ledger changes and their outbox events atomically',async()=>{
    const before=await getSyncStatus();const client=await getClient();
    try{await client.query('BEGIN');await client.query(`UPDATE transactions SET amount=amount+1 WHERE id='b0000000-0000-0000-0000-000000000001'`);await client.query('ROLLBACK');}finally{client.release();}
    expect((await getSyncStatus()).revision).toBe(before.revision);
  });
  it('serializes concurrent transfer retries through PostgreSQL advisory locking',async()=>{
    const body=transferSchema.parse({idempotencyKey:randomUUID(),sourceAccountId:'a0000000-0000-0000-0000-000000000001',destinationAccountId:'a0000000-0000-0000-0000-000000000002',amount:'1234.50',currency:'INR',transactionType:'NEFT',occurredAt:new Date().toISOString(),description:'Disposable real-database audit'});
    const results=await Promise.all([createTransfer(body,'Audit'),createTransfer(body,'Audit')]);
    expect(results.filter(r=>!r.replayed)).toHaveLength(1);
    expect(results[0].transaction.id).toBe(results[1].transaction.id);
    await syncGraph(500);
    const graph=await loadGraphSnapshot();expect(graph.edges.filter(e=>e.id===results[0].transaction.id)).toHaveLength(1);
  });
  it('persists actual detection evidence and deduplicates repeat runs',async()=>{
    const first=await runDetection();expect(first.findingCount).toBeGreaterThan(0);
    const second=await runDetection();expect(second.created).toBe(0);expect(second.duplicates).toBe(first.findingCount);
  });
  it('does not overwrite newer account metadata with a delayed transfer projection',async()=>{
    const account='a0000000-0000-0000-0000-000000000004';
    const old=await query<GraphAccount>(`${ACCOUNT_SQL} WHERE a.id=ANY($1::uuid[])`,[[account,'a0000000-0000-0000-0000-000000000005']]);
    const newerName='Newer synthetic account metadata '+randomUUID();
    await query(`UPDATE customers SET full_name=$2 WHERE id=(SELECT customer_id FROM accounts WHERE id=$1)`,[account,newerName]);
    await syncGraph(500);
    const delayed={query:async(sql:string,params?:unknown[])=>sql.includes('FROM accounts a JOIN customers')?old:query(sql,params)} as unknown as PoolClient;
    await projectEntity(delayed,'TRANSACTION','b0000000-0000-0000-0000-000000000001');
    const graph=await loadGraphSnapshot();expect(graph.nodes.find(n=>n.id===account)?.customerName).toBe(newerName);
  });
});
