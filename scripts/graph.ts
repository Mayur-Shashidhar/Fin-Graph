import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

async function main() {
  const { initializeGraph, closeGraphDriver } = await import('../src/lib/neo4j');
  const { getDbPool } = await import('../src/lib/db');
  const { syncGraph, retryFailedEvents, reconcileGraph, getSyncStatus } = await import('../src/lib/graph/sync');
  const { runDetection } = await import('../src/lib/graph/detection');
  const { readFile } = await import('node:fs/promises');
  const { isDemo } = await import('../src/lib/demo');
  const command = process.argv[2];
  let stopping = false;
  process.on('SIGINT', () => { stopping = true; });
  process.on('SIGTERM', () => { stopping = true; });
  try {
    if (command === 'setup') {
      await getDbPool().query(await readFile('database/graph.sql', 'utf8'));
      await getDbPool().query(await readFile('database/app.sql', 'utf8'));
      if (!isDemo()) await initializeGraph();
      console.log('Graph migration and Neo4j constraints installed.');
    } else if (command === 'sync') {
      let batch;
      do {
        batch = await syncGraph(100);
        console.log(JSON.stringify(batch));
      } while (!stopping && batch.batchProcessed > 0 && batch.pending > 0);
    } else if (command === 'worker') {
      console.log('Graph worker started. Press Ctrl+C to stop.');
      while (!stopping) {
        const batch = await syncGraph(100);
        if (batch.batchProcessed || batch.batchFailed) console.log(JSON.stringify(batch));
        if (!batch.batchProcessed) await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } else if (command === 'retry') {
      await retryFailedEvents(); console.log('Failed and dead-letter events queued for retry.');
    } else if (command === 'reconcile') {
      await reconcileGraph(); console.log('Reconciliation queued. Run npm run graph:sync.');
    } else if (command === 'detect') {
      console.log(JSON.stringify(await runDetection(!process.argv.includes('--dry-run')), null, 2));
    } else if (command === 'status') console.log(JSON.stringify(await getSyncStatus(), null, 2));
    else throw new Error('Use setup, sync, worker, retry, reconcile, detect or status');
  } finally {
    await closeGraphDriver();
    if (isDemo()) await getDbPool().end();
    else await globalThis.__finGraphPgPool?.end();
  }
}
main().catch(() => { console.error('Graph command failed. Check environment, database connectivity, migrations and rule configuration.'); process.exitCode = 1; });
