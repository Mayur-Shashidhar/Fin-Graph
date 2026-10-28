import 'server-only';
import { getClient, query } from '../db';
import { getDetectionRules } from '../queries/rules';
import { detectPatterns } from './engine';
import { loadGraphSnapshot } from './repository';
import { getSyncStatus } from './sync';
import type { GraphFinding } from '../../types/graph';

export class ProjectionLagError extends Error {}

/** Unique evidence fingerprints preserve investigator dispositions on reruns. */
export async function saveFindings(findings: GraphFinding[], runId: string) {
  const client = await getClient();
  let created = 0;
  try {
    await client.query('BEGIN');
    for (const finding of findings) {
      const result = await client.query(`INSERT INTO alerts
        (transaction_id, alert_type, risk_score, severity, status, title, description, evidence, detection_fingerprint)
        VALUES ($1, $2, $3, $4, 'NEW', $5, $6, $7::jsonb, $8)
        ON CONFLICT (detection_fingerprint) DO NOTHING RETURNING id`, [
        finding.evidence.transactionIds[0], finding.ruleCode, finding.riskScore, finding.severity,
        finding.title, 'Graph pattern matched configured thresholds. Review the linked evidence.',
        JSON.stringify({ ...finding.evidence, engine: 'fingraph-graph-v1', ruleId: finding.ruleId,
          ruleCode: finding.ruleCode, ruleVersion: finding.ruleVersion, runId, detectedAt: new Date().toISOString() }), finding.fingerprint,
      ]);
      created += result.rowCount ?? 0;
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
  return { created, duplicates: findings.length - created };
}

export async function runDetection(persist = true) {
  const sync = await getSyncStatus();
  if (sync.pending || sync.failed || sync.dead) throw new ProjectionLagError('Synchronize the graph before running detection');
  const run = await query<{ id: string }>(`INSERT INTO graph_detection_runs(status) VALUES ('RUNNING') RETURNING id`);
  const runId = run.rows[0].id;
  const started = Date.now();
  try {
    const snapshot = await loadGraphSnapshot();
    const rules = await getDetectionRules();
    const result = detectPatterns(snapshot, rules);
    const afterSnapshot = await getSyncStatus();
    if (afterSnapshot.pending || afterSnapshot.failed || afterSnapshot.dead || afterSnapshot.revision !== sync.revision) throw new ProjectionLagError('Graph changed during detection; synchronize and retry');
    const stored = persist ? await saveFindings(result.findings, runId) : { created: 0, duplicates: 0 };
    const summary = { ...stored, findingCount: result.findings.length, nodes: snapshot.nodes.length,
      edges: snapshot.edges.length, durationMs: Date.now() - started, operations: result.operations,
      skippedRules: result.skippedRules, persisted: persist, projectionSyncedAt: sync.lastSyncedAt, projectionRevision: sync.revision };
    await query(`UPDATE graph_detection_runs SET status = 'COMPLETED', completed_at = NOW(), summary = $2::jsonb WHERE id = $1`, [runId, JSON.stringify(summary)]);
    return { runId, ...summary, findings: result.findings };
  } catch (error) {
    await query(`UPDATE graph_detection_runs SET status = 'FAILED', completed_at = NOW(), summary = '{"error":"Detection failed; inspect connectivity, rule configuration or capacity"}'::jsonb WHERE id = $1`, [runId]);
    throw error;
  }
}
