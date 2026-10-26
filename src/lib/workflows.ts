import 'server-only';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { getClient, query } from './db';
import type { Alert, DetectionRule, TransactionRecord } from '../types/database';
import { ruleCode, validateRule } from './graph/rules';
import { GraphRequestError } from './graph/api';
import { databaseId } from './validation';

export class WorkflowError extends Error { constructor(message: string, public status = 400) { super(message); } }
export const alertStatuses = ['NEW', 'INVESTIGATING', 'ESCALATED', 'CLOSED_RESOLVED', 'CLOSED_FALSE_POSITIVE'] as const;
export const alertFilters = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(15),
  search: z.string().trim().max(200).default(''),
  status: z.enum([...alertStatuses, 'ALL']).default('ALL'),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'ALL']).default('ALL'),
}).strict();
export async function listAlerts(filters: z.infer<typeof alertFilters>) {
  const params = [filters.search, filters.status, filters.severity];
  const where = `WHERE ($1 = '' OR title ILIKE '%' || $1 || '%' OR alert_type ILIKE '%' || $1 || '%') AND ($2 = 'ALL' OR status = $2) AND ($3 = 'ALL' OR severity = $3)`;
  const data = await query<Alert>(`SELECT * FROM alerts ${where} ORDER BY risk_score DESC, created_at DESC, id LIMIT $4 OFFSET $5`, [...params, filters.pageSize, (filters.page - 1) * filters.pageSize]);
  const total = await query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM alerts ${where}`, params);
  return { data: data.rows, pagination: { page: filters.page, pageSize: filters.pageSize, totalCount: total.rows[0].count, totalPages: Math.ceil(total.rows[0].count / filters.pageSize) } };
}
export async function alertDetails(id: string) {
  const found = await query<Alert>('SELECT * FROM alerts WHERE id = $1', [id]);
  const alert = found.rows[0]; if (!alert) throw new WorkflowError('Alert not found.', 404);
  const evidenceIds = Array.isArray(alert.evidence.transactionIds) ? alert.evidence.transactionIds.filter((v): v is string => typeof v === 'string' && databaseId.safeParse(v).success) : [];
  const ids = [...new Set([...evidenceIds, ...(alert.transaction_id ? [alert.transaction_id] : [])])];
  const transactions = await query<TransactionRecord>(`SELECT t.*, sa.account_number AS source_account_number, sc.full_name AS source_customer_name, da.account_number AS destination_account_number, dc.full_name AS destination_customer_name FROM transactions t JOIN accounts sa ON sa.id = t.source_account_id JOIN customers sc ON sc.id = sa.customer_id JOIN accounts da ON da.id = t.destination_account_id JOIN customers dc ON dc.id = da.customer_id WHERE t.id = ANY($1::uuid[]) ORDER BY occurred_at, t.id`, [ids]);
  const notes = await query<{ id: string; author: string; body: string; created_at: string }>('SELECT * FROM investigation_notes WHERE alert_id = $1 ORDER BY created_at, id', [id]);
  const history = await query<{ id: string; actor: string; action: string; details: Record<string, unknown>; created_at: string }>('SELECT * FROM audit_logs WHERE target_id = $1 ORDER BY created_at DESC LIMIT 100', [id]);
  return { alert, transactions: transactions.rows, notes: notes.rows, history: history.rows };
}
export const reviewSchema = z.object({
  status: z.enum(alertStatuses).optional(), note: z.string().trim().max(4000).optional(),
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
}).strict().refine(v => !!v.status || !!v.note, { message: 'Choose a status or add a note.' });
const transitions: Record<string, readonly string[]> = {
  NEW: ['INVESTIGATING', 'ESCALATED', 'CLOSED_RESOLVED', 'CLOSED_FALSE_POSITIVE'],
  INVESTIGATING: ['ESCALATED', 'CLOSED_RESOLVED', 'CLOSED_FALSE_POSITIVE'],
  ESCALATED: ['INVESTIGATING', 'CLOSED_RESOLVED', 'CLOSED_FALSE_POSITIVE'],
  CLOSED_RESOLVED: ['INVESTIGATING'], CLOSED_FALSE_POSITIVE: ['INVESTIGATING'],
};
export async function reviewAlert(id: string, body: z.infer<typeof reviewSchema>, actor: string) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await client.query<Alert>('SELECT * FROM alerts WHERE id = $1 FOR UPDATE', [id]);
    const current = result.rows[0]; if (!current) throw new WorkflowError('Alert not found.', 404);
    if (new Date(current.updated_at).getTime() !== Date.parse(body.expectedUpdatedAt)) throw new WorkflowError('This alert changed. Refresh it before saving.', 409);
    if (body.status && body.status !== current.status && !transitions[current.status]?.includes(body.status)) throw new WorkflowError('This review status transition is not allowed.');
    if (body.note) await client.query('INSERT INTO investigation_notes(alert_id, author, body) VALUES ($1, $2, $3)', [id, actor, body.note]);
    await client.query('UPDATE alerts SET status = $2 WHERE id = $1', [id, body.status ?? current.status]);
    await client.query(`INSERT INTO audit_logs(actor, action, target_id, details) VALUES ($1, 'ALERT_REVIEW', $2, $3::jsonb)`, [actor, id, JSON.stringify({ from: current.status, to: body.status ?? current.status, noteAdded: !!body.note })]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
  return alertDetails(id);
}
export const updateRuleSchema = z.object({ enabled: z.boolean(), thresholds: z.record(z.string().max(64), z.number().finite()), expectedUpdatedAt: z.iso.datetime({ offset: true }) }).strict();
export async function updateRule(id: string, body: z.infer<typeof updateRuleSchema>, actor: string) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await client.query<DetectionRule>('SELECT * FROM detection_rules WHERE id = $1 FOR UPDATE', [id]);
    const existing = result.rows[0]; if (!existing || !ruleCode(existing)) throw new WorkflowError('Supported rule not found.', 404);
    if (new Date(existing.updated_at).getTime() !== Date.parse(body.expectedUpdatedAt)) throw new WorkflowError('This rule changed. Refresh it before saving.', 409);
    let effective: Record<string, number>;
    try { effective = validateRule({ ...existing, thresholds: body.thresholds }).thresholds; }
    catch { throw new WorkflowError('Rule values are outside the supported bounds. Check amounts, counts, time windows and hop limits.'); }
    const updated = await client.query<DetectionRule>('UPDATE detection_rules SET enabled = $2, thresholds = $3::jsonb WHERE id = $1 RETURNING *', [id, body.enabled, JSON.stringify(effective)]);
    await client.query(`INSERT INTO audit_logs(actor, action, target_id, details) VALUES ($1, 'RULE_UPDATED', $2, $3::jsonb)`, [actor, id, JSON.stringify({ before: { enabled: existing.enabled, thresholds: existing.thresholds }, after: { enabled: body.enabled, thresholds: effective } })]);
    await client.query('COMMIT'); return updated.rows[0];
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export const transferSchema = z.object({
  idempotencyKey: z.uuid(), sourceAccountId: databaseId, destinationAccountId: databaseId,
  amount: z.string().regex(/^\d{1,14}(\.\d{1,2})?$/).refine(v => BigInt(v.replace('.', '').replace(/^0+/, '') || '0') > BigInt(0)),
  currency: z.enum(['INR', 'USD', 'EUR', 'GBP']).default('INR'),
  transactionType: z.enum(['WIRE_TRANSFER', 'NEFT', 'RTGS', 'IMPS', 'UPI', 'INTERNAL_TRANSFER']),
  occurredAt: z.iso.datetime({ offset: true }), description: z.string().trim().max(1000).default(''),
}).strict().refine(v => v.sourceAccountId !== v.destinationAccountId, { message: 'Choose two different accounts.' });
export async function createTransfer(body: z.infer<typeof transferSchema>, actor: string) {
  const hash = createHash('sha256').update(JSON.stringify(body)).digest('hex');
  const client = await getClient();
  try {
    await client.query('BEGIN');
    // Serialize identical idempotency keys; different requests stay independent.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [body.idempotencyKey]);
    const old = await client.query<{ transaction_id: string; request_hash: string }>('SELECT * FROM transfer_requests WHERE idempotency_key = $1', [body.idempotencyKey]);
    if (old.rows[0]) {
      if (old.rows[0].request_hash !== hash) throw new WorkflowError('This request key was already used for a different transfer.', 409);
      const transaction = await client.query('SELECT * FROM transactions WHERE id = $1', [old.rows[0].transaction_id]);
      await client.query('COMMIT'); return { transaction: transaction.rows[0], replayed: true };
    }
    const accounts = await client.query<{ id: string; currency: string; status: string; created_at: Date | string }>('SELECT id, currency, status, created_at FROM accounts WHERE id = ANY($1::uuid[]) FOR SHARE', [[body.sourceAccountId, body.destinationAccountId]]);
    if (accounts.rows.length !== 2 || accounts.rows.some(a => a.currency !== body.currency || !['ACTIVE', 'UNDER_REVIEW'].includes(a.status))) throw new WorkflowError('Both accounts must be available and use the selected currency.');
    const occurredAt = Date.parse(body.occurredAt);
    if (occurredAt > Date.now() + 60000 || accounts.rows.some(a => occurredAt < new Date(a.created_at).getTime())) throw new WorkflowError('Transfer time must follow account creation and cannot be in the future.');
    const transaction = await client.query(`INSERT INTO transactions(source_account_id, destination_account_id, amount, currency, transaction_type, status, description, occurred_at) VALUES ($1, $2, $3, $4, $5, 'COMPLETED', $6, $7) RETURNING *`, [body.sourceAccountId, body.destinationAccountId, body.amount, body.currency, body.transactionType, body.description, body.occurredAt]);
    await client.query('INSERT INTO transfer_requests(idempotency_key, transaction_id, request_hash) VALUES ($1, $2, $3)', [body.idempotencyKey, transaction.rows[0].id, hash]);
    await client.query(`INSERT INTO audit_logs(actor, action, target_id) VALUES ($1, 'TRANSFER_CREATED', $2)`, [actor, transaction.rows[0].id]);
    await client.query('COMMIT'); return { transaction: transaction.rows[0], replayed: false };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export function workflowFailure(error: unknown) {
  if (error instanceof WorkflowError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError || error instanceof GraphRequestError || error instanceof SyntaxError) return Response.json({ error: 'Invalid request. Check the values and try again.' }, { status: 400 });
  return Response.json({ error: 'Unable to load or save data. Check database setup and try again.' }, { status: 503 });
}
