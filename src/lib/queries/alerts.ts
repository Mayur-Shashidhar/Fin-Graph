import 'server-only';
import { query } from '@/lib/db';
import { Alert } from '@/types';

/**
 * Fetches recent alerts with optional status filtering.
 * Parameterized to prevent SQL injection.
 */
export async function getRecentAlerts(limit = 10, statusFilter?: string): Promise<Alert[]> {
  const safeLimit = Math.max(1, Math.min(limit, 100));

  if (statusFilter) {
    const result = await query<Alert>(
      `
      SELECT
        id,
        transaction_id,
        alert_type,
        risk_score,
        severity,
        status,
        title,
        description,
        evidence,
        created_at,
        updated_at
      FROM alerts
      WHERE status = $1
      ORDER BY risk_score DESC, created_at DESC
      LIMIT $2;
      `,
      [statusFilter, safeLimit]
    );
    return result.rows;
  }

  const result = await query<Alert>(
    `
    SELECT
      id,
      transaction_id,
      alert_type,
      risk_score,
      severity,
      status,
      title,
      description,
      evidence,
      created_at,
      updated_at
    FROM alerts
    ORDER BY risk_score DESC, created_at DESC
    LIMIT $1;
    `,
    [safeLimit]
  );

  return result.rows;
}
