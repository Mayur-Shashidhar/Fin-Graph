import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
async function initialize() {
  const { getDbPool } = await import('../src/lib/db');
  const { initializeGraph, closeGraphDriver } = await import('../src/lib/neo4j');
  const { syncGraph, reconcileGraph } = await import('../src/lib/graph/sync');
  const { runDetection } = await import('../src/lib/graph/detection');
  const { readFile } = await import('node:fs/promises');
  const pool = getDbPool();
  try {
    for (const file of ['schema.sql','seed.sql','graph.sql','app.sql']) await pool.query(await readFile(`database/${file}`,'utf8'));
    await initializeGraph();
    await reconcileGraph();
    let batch;
    do { batch = await syncGraph(500); if (batch.failed || batch.dead) throw new Error('Graph synchronization failed'); } while (batch.pending);
    const result=await runDetection();
    console.log(`Databases ready. ${result.findingCount} findings, ${result.created} new alerts.`);
  } finally { await closeGraphDriver(); await pool.end(); }
}
initialize().catch(()=>{console.error('Initialization failed. Check database connections and credentials.');process.exitCode=1;});
