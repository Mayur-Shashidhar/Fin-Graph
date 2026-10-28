import { spawn, spawnSync } from 'node:child_process';
import { open, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import nextEnv from '@next/env';
import pg from 'pg';

// The native installation is machine-local. Its paths, credentials and database
// files live in ignored .data/live and .env.local, never in this script.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const action = process.argv[2] ?? 'start';
const children = [];
let shuttingDown = false;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const literal = text => `'${text.replaceAll("'", "''")}'`;

function powershell(executable, script, options = {}) {
  return spawnSync(executable, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, encoding: 'utf8', ...options });
}

function portOpen(port) {
  return new Promise(resolve => {
    const socket = net.connect({ host: '127.0.0.1', port });
    const finish = value => { socket.destroy(); resolve(value); };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(1000, () => finish(false));
  });
}

async function waitForPort(port) {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    if (await portOpen(port)) return;
    await pause(1000);
  }
  throw new Error(`Local database did not start on port ${port}. Check .data/live logs.`);
}

async function startDatabases(runtime, managedNeo4j) {
  const pgCtl = path.join(runtime.postgresBin, 'pg_ctl.exe');
  if (spawnSync(pgCtl, ['-D', runtime.postgresData, 'status'], { windowsHide: true, stdio: 'ignore' }).status !== 0) {
    console.log(`Starting the dedicated PostgreSQL database on port ${runtime.postgresPort}...`);
    const result = spawnSync(pgCtl, ['-D', runtime.postgresData, '-l', path.join(root, '.data/live/postgres.log'), '-o', `-h 127.0.0.1 -p ${runtime.postgresPort}`, '-w', 'start'], { windowsHide: true, stdio: 'inherit' });
    if (result.status !== 0) throw new Error('PostgreSQL startup failed.');
  }
  if (!managedNeo4j) {
    console.log('Using the configured external Neo4j instance; local Neo4j startup skipped.');
    return;
  }
  if (!(await portOpen(7687))) {
    console.log('Starting Neo4j on bolt://127.0.0.1:7687...');
    const log = await open(path.join(root, '.data/live/neo4j-console.log'), 'a');
    try {
      const server = spawn(path.join(runtime.javaHome, 'bin/java.exe'), [
        '-cp', path.join(runtime.neo4jHome, 'lib/*'), `-Dbasedir=${runtime.neo4jHome}`,
        'org.neo4j.server.startup.Neo4jCommand', 'console',
      ], { env: { ...process.env, JAVA_HOME: runtime.javaHome, NEO4J_HOME: runtime.neo4jHome, NEO4J_CONF: path.join(runtime.neo4jHome, 'conf') }, detached: true, windowsHide: true, stdio: ['ignore', log.fd, log.fd] });
      await new Promise((resolve, reject) => { server.once('spawn', resolve); server.once('error', reject); });
      server.unref();
    } finally { await log.close(); }
  }
  await waitForPort(7687);
  console.log('Local PostgreSQL and Neo4j services are available.');
}

async function stopDatabases(runtime) {
  // Match the Java process to this installation; other Neo4j/Java services stay running.
  const result = powershell(runtime.powerShell ?? 'powershell.exe', `$installation=${literal(runtime.neo4jHome.replaceAll('/', '\\'))}; Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'java.exe' -and $_.CommandLine -and $_.CommandLine.Replace('/', '\\').Contains($installation) } | ForEach-Object { Stop-Process -Id $_.ProcessId -ErrorAction SilentlyContinue }`);
  if (result.status !== 0) throw new Error('Could not stop the local Neo4j process.');
  const pgCtl = path.join(runtime.postgresBin, 'pg_ctl.exe');
  if (spawnSync(pgCtl, ['-D', runtime.postgresData, 'status'], { windowsHide: true, stdio: 'ignore' }).status === 0) {
    const stopped = spawnSync(pgCtl, ['-D', runtime.postgresData, '-m', 'fast', '-w', 'stop'], { windowsHide: true, stdio: 'inherit' });
    if (stopped.status !== 0) throw new Error('Could not stop local PostgreSQL.');
  }
  console.log('Local database services stopped. Saved data is retained.');
}

function run(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { env, stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error('Database initialization or synchronization failed.')));
  });
}

function stopChildren() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.pid && child.exitCode === null) spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  }
}

async function main() {
  if (process.platform !== 'win32') throw new Error('Use the Docker setup on other operating systems.');
  if (!['start', 'databases', 'stop'].includes(action)) throw new Error('Use start, databases or stop.');
  nextEnv.loadEnvConfig(root);
  let runtime;
  try { runtime = JSON.parse(await readFile('.data/live/runtime.json', 'utf8')); }
  catch { throw new Error('This machine has no native FinGraph installation. Follow README.md to configure live databases or use Docker.'); }
  if (action === 'stop') {
    if (await portOpen(3000)) throw new Error('Stop the app with Ctrl+C before stopping its databases.');
    await stopDatabases(runtime);
    return;
  }
  if (action === 'start' && await portOpen(3000)) throw new Error('Port 3000 is in use. Stop the running app before starting live mode.');
  const graphUri = new URL(process.env.NEO4J_URI ?? 'bolt://127.0.0.1:7687');
  const managedNeo4j = ['localhost', '127.0.0.1', '[::1]'].includes(graphUri.hostname) && (!graphUri.port || graphUri.port === '7687');
  await mkdir('.data/live', { recursive: true });
  await startDatabases(runtime, managedNeo4j);
  if (action === 'databases') return;
  const env = { ...process.env, FINGRAPH_DEMO: 'false' };
  const flags = ['--conditions=react-server', '--import', 'tsx'];
  await run(['scripts/check-neo4j.mjs'], env);
  await run([...flags, 'scripts/graph.ts', 'setup'], env);
  const sqlUri = new URL(env.DATABASE_URL);
  const target = { uri: env.NEO4J_URI, database: env.NEO4J_DATABASE || 'neo4j', sqlHost: sqlUri.hostname,
    sqlPort: sqlUri.port || '5432', sqlDatabase: sqlUri.pathname, sqlUser: sqlUri.username };
  let previous;
  try { previous = JSON.parse(await readFile('.data/live/graph-target.json', 'utf8')); } catch { /* First start for this destination. */ }
  if (JSON.stringify(previous) !== JSON.stringify(target)) {
    console.log('New graph destination: reconciling the complete ledger once.');
    await run([...flags, 'scripts/graph.ts', 'reconcile'], env);
  } else console.log('Graph destination unchanged: synchronizing queued changes only.');
  await run([...flags, 'scripts/graph.ts', 'sync'], env);
  const sql = new pg.Client({ connectionString: env.DATABASE_URL });
  await sql.connect();
  try {
    const pending = await sql.query("SELECT count(*)::int AS count FROM graph_outbox WHERE status <> 'PROCESSED'");
    if (pending.rows[0].count) throw new Error('Graph updates remain pending or failed. Check graph:status and retry before starting.');
  } finally { await sql.end(); }
  await writeFile('.data/live/graph-target.json', JSON.stringify(target, null, 2));
  process.once('SIGINT', stopChildren);
  process.once('SIGTERM', stopChildren);
  process.once('exit', stopChildren);
  const worker = spawn(process.execPath, [...flags, 'scripts/graph.ts', 'worker'], { env, stdio: 'inherit', windowsHide: true });
  const app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', '3000'], { env, stdio: 'inherit', windowsHide: true });
  children.push(worker, app);
  for (const child of children) {
    child.once('error', error => { console.error(error.message); stopChildren(); process.exitCode = 1; });
    child.once('exit', code => { if (!shuttingDown) { process.exitCode = code ?? 1; stopChildren(); } });
  }
  console.log(`\nLive FinGraph: http://127.0.0.1:3000\n${managedNeo4j ? 'Neo4j Browser: http://127.0.0.1:7474' : 'Neo4j: configured external instance'}\nAccess key: GRAPH_API_TOKEN in .env.local\nCtrl+C stops the app and worker. Databases retain their data.\n`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
