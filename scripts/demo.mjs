import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:net';

// Fail before opening the demo database if another process owns the app port.
await new Promise((resolve,reject)=>{
  const probe=createServer();
  probe.once('error',()=>reject(new Error('Port 3000 is already in use. Stop the running app before starting another demo.')));
  probe.listen(3000,'127.0.0.1',()=>probe.close(resolve));
});

await mkdir('.data', { recursive: true });
const keyFile = path.resolve('.data/demo-access-key');
let key;
try { key = (await readFile(keyFile, 'utf8')).trim(); } catch { key = randomBytes(24).toString('hex'); await writeFile(keyFile, key, { mode: 0o600 }); }
const env = { ...process.env, FINGRAPH_DEMO: 'true', GRAPH_API_TOKEN: key, APP_URL: 'http://127.0.0.1:3000' };
console.log('\nPreparing the local synthetic demo...');
const prepared = spawnSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', 'scripts/graph.ts', 'sync'], { env, stdio: 'inherit' });
if (prepared.status !== 0) process.exit(prepared.status ?? 1);
console.log(`\nFinGraph local demo: http://127.0.0.1:3000\nInvestigator access key: ${key}\nData is saved in .data/demo. Neo4j is not enabled in this demo.\n`);
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3000'], { env, stdio: 'inherit' });
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
child.on('exit', code => { process.exitCode = code ?? 0; });
