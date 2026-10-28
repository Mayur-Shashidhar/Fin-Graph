import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { beforeAll, afterAll, it, expect, vi } from 'vitest';
import type { DetectionRule } from '../src/types/database';

const store = vi.hoisted(() => ({ db: null as PGlite | null }));
vi.mock('../src/lib/db', () => {
  const query = async (sql: string, values?: unknown[]) => { const r = await store.db!.query(sql, values); return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length }; };
  return { query, getClient: async () => ({ query, release() {} }) };
});
import { alertDetails, alertFilters, createTransfer, listAlerts, reviewAlert, reviewSchema, transferSchema, updateRule, updateRuleSchema } from '../src/lib/workflows';
import { authorizeRequest, createSession, readSession, SESSION_COOKIE, sameOrigin } from '../src/lib/auth';
import { getPaginatedTransactions } from '../src/lib/queries/transactions';
import { getActivityTimeline, getDashboardSummaryMetrics } from '../src/lib/queries/stats';
import { formatMoney } from '../src/lib/formatters';
import { transactionDateBoundary } from '../src/lib/validation';
import { validateRule } from '../src/lib/graph/rules';
import { safeReturnPath } from '../src/lib/navigation';
import { POST as signIn } from '../src/app/api/auth/session/route';

const key = 'workflow-test-key-32-characters-or-more';
beforeAll(async () => {
  vi.stubEnv('GRAPH_API_TOKEN', key);
  store.db = new PGlite({ extensions: { pgcrypto } });
  for (const file of ['schema.sql', 'seed.sql', 'graph.sql', 'app.sql']) await store.db.exec(await readFile(`database/${file}`, 'utf8'));
});
afterAll(async () => { await store.db?.close(); vi.unstubAllEnvs(); });

it('authenticates signed browser sessions and rejects tampering and cross-site mutations', () => {
  const session = createSession('Test investigator');
  expect(readSession(session)?.name).toBe('Test investigator');
  expect(readSession(session.slice(0,-1)+'x')).toBeNull();
  const headers = { cookie: `${SESSION_COOKIE}=${session}` };
  expect(authorizeRequest(new Request('http://localhost/api/alerts', { headers }))).toBeNull();
  expect(authorizeRequest(new Request('http://localhost/api/alerts', { method:'POST', headers }))).toHaveProperty('status',403);
  expect(authorizeRequest(new Request('http://localhost/api/alerts', { method:'POST', headers:{...headers,origin:'http://localhost'} }))).toBeNull();
});
it('returns HttpOnly session cookies on sign-in and rejects wrong keys', async () => {
  const request = (accessKey: string) => new Request('http://localhost/api/auth/session', { method:'POST', headers:{origin:'http://localhost'}, body:JSON.stringify({name:'Test investigator',key:accessKey}) });
  expect((await signIn(request('wrong'))).status).toBe(401);
  const response=await signIn(request(key)); expect(response.status).toBe(200);
  expect(response.headers.get('set-cookie')).toContain('HttpOnly');
  expect(response.headers.get('set-cookie')).toContain('SameSite=Strict');
});
it('paginates and filters the real alert queue', async () => {
  const result = await listAlerts(alertFilters.parse({pageSize:5}));
  expect(result.data).toHaveLength(5);expect(result.pagination.totalCount).toBe(25);
  const critical=await listAlerts(alertFilters.parse({severity:'CRITICAL'}));
  expect(critical.data.every(a=>a.severity==='CRITICAL')).toBe(true);
});
it('saves review notes and audit history atomically, with stale-review protection', async () => {
  const id='f0000000-0000-0000-0000-000000000001';
  const original=await alertDetails(id);
  const body=reviewSchema.parse({status:'INVESTIGATING',note:'Reviewed the three-hop evidence.',expectedUpdatedAt:new Date(original.alert.updated_at).toISOString()});
  const updated=await reviewAlert(id,body,'Test investigator');
  expect(updated.alert.status).toBe('INVESTIGATING');expect(updated.notes[0].author).toBe('Test investigator');expect(updated.history[0].details.from).toBe('NEW');
  await expect(reviewAlert(id,body,'Another investigator')).rejects.toHaveProperty('status',409);
});
it('validates rule thresholds, persists toggles and records configuration changes', async () => {
  const existing=(await store.db!.query<DetectionRule>('SELECT * FROM detection_rules ORDER BY id LIMIT 1')).rows[0];
  const update=updateRuleSchema.parse({enabled:false,thresholds:existing.thresholds,expectedUpdatedAt:new Date(existing.updated_at).toISOString()});
  const changed=await updateRule(existing.id,update,'Test investigator');expect(changed.enabled).toBe(false);
  await expect(updateRule(existing.id,{...update,expectedUpdatedAt:new Date(changed.updated_at).toISOString(),thresholds:{max_hops:100}},'Test investigator')).rejects.toThrow('outside the supported bounds');
});
it('creates one transaction and one queued update across idempotent retries', async () => {
  const body=transferSchema.parse({idempotencyKey:'11111111-1111-4111-8111-111111111111',sourceAccountId:'a0000000-0000-0000-0000-000000000001',destinationAccountId:'a0000000-0000-0000-0000-000000000002',amount:'1234.50',currency:'INR',transactionType:'NEFT',occurredAt:new Date().toISOString(),description:'Synthetic integration test'});
  const first=await createTransfer(body,'Test investigator'); const second=await createTransfer(body,'Test investigator');
  expect(first.replayed).toBe(false);expect(second.replayed).toBe(true);
  expect(second.transaction.id).toBe(first.transaction.id);
  const count=(await store.db!.query<{count:number}>('SELECT COUNT(*)::int AS count FROM transactions')).rows[0].count;expect(count).toBe(501);
  await expect(createTransfer({...body,amount:'1250.00'},'Test investigator')).rejects.toHaveProperty('status',409);
  const queue=(await store.db!.query<{status:string}>('SELECT status FROM graph_outbox WHERE entity_id=$1',[first.transaction.id])).rows[0];expect(queue.status).toBe('PENDING');
});
it('does not create transfers with invalid accounts, currencies or zero amounts', async () => {
  expect(transferSchema.safeParse({amount:'0'}).success).toBe(false);
  const body=transferSchema.parse({idempotencyKey:'22222222-2222-4222-8222-222222222222',sourceAccountId:'a0000000-0000-0000-0000-000000000001',destinationAccountId:'a0000000-0000-0000-0000-000000000002',amount:'100.00',currency:'USD',transactionType:'NEFT',occurredAt:new Date().toISOString()});
  await expect(createTransfer(body,'Test investigator')).rejects.toThrow('Both accounts');
});
it('returns a 404 for missing alert details', async () => {
  await expect(alertDetails('00000000-0000-4000-8000-000000000000')).rejects.toHaveProperty('status',404);
});

it('rejects malformed multibyte session signatures without throwing', () => {
  const payload=createSession('Audit investigator').split('.')[0];
  const malformed=payload+'.'+'é'.repeat(43);
  expect(()=>readSession(malformed)).not.toThrow();expect(readSession(malformed)).toBeNull();
  const response=authorizeRequest(new Request('http://localhost/api/alerts',{headers:{cookie:`${SESSION_COOKIE}=${malformed}`}}));
  expect(response?.status).toBe(401);
});
it('rejects external sign-in redirects after browser URL normalization',()=>{
  for(const input of ['//example.com','/\n/example.com','/\\example.com','https://example.com','javascript:alert(1)'])expect(safeReturnPath(input,'http://localhost:3000')).toBe('/');
  expect(safeReturnPath('/alerts?status=NEW','http://localhost:3000')).toBe('/alerts?status=NEW');
});
it('rejects expired sessions and invalid configured origins', () => {
  const session=createSession('Audit investigator');
  const now=Date.now();const clock=vi.spyOn(Date,'now').mockReturnValue(now+9*60*60*1000);
  expect(readSession(session)).toBeNull();clock.mockRestore();
  const previous=process.env.APP_URL;vi.stubEnv('APP_URL','not-a-url');
  expect(sameOrigin(new Request('http://localhost',{headers:{origin:'http://localhost'}}))).toBe(false);
  vi.stubEnv('APP_URL',previous);
});
it('returns actual last-page records when a transaction page exceeds the result set', async () => {
  const beyond=await getPaginatedTransactions({page:999,pageSize:17,sortBy:'occurred_at',sortOrder:'asc'});
  const last=await getPaginatedTransactions({page:beyond.pagination.totalPages,pageSize:17,sortBy:'occurred_at',sortOrder:'asc'});
  expect(beyond.pagination.page).toBe(last.pagination.page);
  expect(beyond.data.map(t=>t.id)).toEqual(last.data.map(t=>t.id));
  expect(beyond.data.length).toBeGreaterThan(0);
});
it('normalizes inclusive date filters and rejects impossible calendar dates', () => {
  expect(transactionDateBoundary().parse('2026-03-11')).toBe('2026-03-11T00:00:00.000Z');
  expect(transactionDateBoundary(true).parse('2026-03-11')).toBe('2026-03-11T23:59:59.999Z');
  expect(transactionDateBoundary().safeParse('2026-02-30').success).toBe(false);
  expect(transactionDateBoundary().parse('2026-03-11T10:00:00+05:30')).toBe('2026-03-11T10:00:00+05:30');
});
it('excludes foreign currency amounts from INR totals and preserves ledger currency labels', async () => {
  const before=await getDashboardSummaryMetrics();const timeline=await getActivityTimeline();
  await store.db!.query(`INSERT INTO transactions(source_account_id,destination_account_id,amount,currency,transaction_type,status,occurred_at) VALUES ('a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002',1000,'USD','NEFT','COMPLETED','2026-03-01T13:00:00Z')`);
  const after=await getDashboardSummaryMetrics();const updatedTimeline=await getActivityTimeline();
  expect(after.totalTransactions).toBe(before.totalTransactions+1);
  expect(after.totalVolumeInr).toBe(before.totalVolumeInr);
  expect(after.completedVolumeInr).toBe(before.completedVolumeInr);
  expect(updatedTimeline.map(p=>p.volumeInr)).toEqual(timeline.map(p=>p.volumeInr));
  expect(formatMoney('99999999999999.99','USD')).toBe('USD 99999999999999.99');
  expect(formatMoney('1234.50','INR')).toBe('₹1,234.50');
});
it('rejects unknown threshold names instead of silently replacing them with defaults', async () => {
  const existing=(await store.db!.query<DetectionRule>('SELECT * FROM detection_rules ORDER BY id LIMIT 1')).rows[0];
  expect(()=>validateRule({...existing,thresholds:{...existing.thresholds,max_hopz:4}})).toThrow('Invalid thresholds');
});
it('rejects completed transfers before account creation or in the future', async () => {
  const body=transferSchema.parse({idempotencyKey:'33333333-3333-4333-8333-333333333333',sourceAccountId:'a0000000-0000-0000-0000-000000000001',destinationAccountId:'a0000000-0000-0000-0000-000000000002',amount:'100',transactionType:'NEFT',occurredAt:'2020-01-01T00:00:00Z'});
  await expect(createTransfer(body,'Audit investigator')).rejects.toThrow('Transfer time');
  await expect(createTransfer({...body,occurredAt:new Date(Date.now()+86400000).toISOString()},'Audit investigator')).rejects.toThrow('Transfer time');
});
it('keeps review update tokens distinct at millisecond precision', async () => {
  const id='f0000000-0000-0000-0000-000000000001';
  // A future token exercises the monotonic fallback without relying on timing.
  await store.db!.query('ALTER TABLE alerts DISABLE TRIGGER trg_alerts_updated_at');
  await store.db!.query(`UPDATE alerts SET updated_at='2090-01-01T00:00:00Z' WHERE id=$1`,[id]);
  await store.db!.query('ALTER TABLE alerts ENABLE TRIGGER trg_alerts_updated_at');
  const original=await alertDetails(id);
  const next=await reviewAlert(id,{note:'Monotonic timestamp test',expectedUpdatedAt:new Date(original.alert.updated_at).toISOString()},'Audit investigator');
  expect(new Date(next.alert.updated_at).getTime()).toBeGreaterThan(new Date(original.alert.updated_at).getTime());
});
