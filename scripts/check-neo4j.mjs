import nextEnv from '@next/env';
import neo4j from 'neo4j-driver';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
nextEnv.loadEnvConfig(root);
let driver;

try {
  for (const name of ['NEO4J_URI', 'NEO4J_USERNAME', 'NEO4J_PASSWORD']) {
    if (!process.env[name]) throw new Error(`Set ${name} in .env.local first.`);
  }
  const uri = new URL(process.env.NEO4J_URI);
  if (uri.username || uri.password) throw new Error('Keep Neo4j credentials in their separate environment variables.');
  if (!['neo4j:', 'neo4j+s:', 'neo4j+ssc:', 'bolt:', 'bolt+s:', 'bolt+ssc:'].includes(uri.protocol)) throw new Error('Use a Neo4j/Bolt connection URI, rather than the web console URL.');
  driver = neo4j.driver(process.env.NEO4J_URI, neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD), {
    connectionTimeout: 15000, connectionAcquisitionTimeout: 15000, maxTransactionRetryTime: 5000,
  });
  await driver.verifyConnectivity();
  const session = driver.session({ database: process.env.NEO4J_DATABASE || 'neo4j', defaultAccessMode: neo4j.session.READ });
  try {
    const counts = await session.executeRead(async tx => {
      const nodes = await tx.run('MATCH (n) RETURN count(n) AS total');
      const accounts = await tx.run('MATCH (a:Account) RETURN count(a) AS total');
      const transfers = await tx.run('MATCH ()-[t:TRANSFER]->() RETURN count(t) AS total');
      return { totalNodes: nodes.records[0].get('total').toString(), accounts: accounts.records[0].get('total').toString(), transfers: transfers.records[0].get('total').toString() };
    });
    console.log(JSON.stringify({ connected: true, host: uri.hostname, database: process.env.NEO4J_DATABASE || 'neo4j', ...counts, readOnlyCheck: true }, null, 2));
  } finally { await session.close(); }
} catch (error) {
  // Driver error messages may contain connection details. Never print credentials.
  const known = error instanceof Error && /^(Set NEO4J_|Keep Neo4j credentials|Use a Neo4j\/Bolt)/.test(error.message);
  if (error.code === 'Neo.ClientError.Security.Unauthorized') {
    console.error('Neo4j rejected the database username/password. Check the instance credentials in .env.local; the database password can differ from your Neo4j website login.');
  } else {
    console.error(known ? error.message : `Neo4j connection check failed${error.code ? ` (${error.code})` : ''}. Check instance status, URI, credentials and network access.`);
  }
  process.exitCode = 1;
} finally { await driver?.close(); }
