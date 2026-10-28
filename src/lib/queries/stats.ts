import 'server-only';
import { query } from '@/lib/db';
import { DashboardSummary, ActivityTimelinePoint } from '@/types';

/**
 * Fetches all aggregated dashboard summary metrics in a single efficient query.
 * Strictly uses PostgreSQL server-side aggregation to avoid fetching individual rows.
 */
export async function getDashboardSummaryMetrics(): Promise<DashboardSummary> {
  const result = await query<{
    total_transactions: string;
    total_volume_inr: string;
    completed_count: string;
    completed_volume_inr: string;
    pending_count: string;
    pending_volume_inr: string;
    flagged_count: string;
    flagged_volume_inr: string;
    rejected_count: string;
    rejected_volume_inr: string;
    cancelled_count: string;
    cancelled_volume_inr: string;
    failed_count: string;
    failed_volume_inr: string;
    total_alerts: string;
    open_alerts: string;
    critical_alerts: string;
    total_accounts: string;
    total_customers: string;
    active_rules: string;
  }>(`
    SELECT
      COUNT(*) AS total_transactions,
      COALESCE(SUM(amount) FILTER (WHERE currency = 'INR'), 0)::text AS total_volume_inr,
      COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed_count,
      COALESCE(SUM(amount) FILTER (WHERE status = 'COMPLETED' AND currency = 'INR'), 0)::text AS completed_volume_inr,
      COUNT(*) FILTER (WHERE status = 'PENDING') AS pending_count,
      COALESCE(SUM(amount) FILTER (WHERE status = 'PENDING' AND currency = 'INR'), 0)::text AS pending_volume_inr,
      COUNT(*) FILTER (WHERE status = 'FLAGGED') AS flagged_count,
      COALESCE(SUM(amount) FILTER (WHERE status = 'FLAGGED' AND currency = 'INR'), 0)::text AS flagged_volume_inr,
      COUNT(*) FILTER (WHERE status = 'REJECTED') AS rejected_count,
      COALESCE(SUM(amount) FILTER (WHERE status = 'REJECTED' AND currency = 'INR'), 0)::text AS rejected_volume_inr,
      COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled_count,
      COALESCE(SUM(amount) FILTER (WHERE status = 'CANCELLED' AND currency = 'INR'), 0)::text AS cancelled_volume_inr,
      COUNT(*) FILTER (WHERE status = 'FAILED') AS failed_count,
      COALESCE(SUM(amount) FILTER (WHERE status = 'FAILED' AND currency = 'INR'), 0)::text AS failed_volume_inr,
      (SELECT COUNT(*) FROM alerts) AS total_alerts,
      (SELECT COUNT(*) FROM alerts WHERE status IN ('NEW', 'INVESTIGATING', 'ESCALATED')) AS open_alerts,
      (SELECT COUNT(*) FROM alerts WHERE severity = 'CRITICAL') AS critical_alerts,
      (SELECT COUNT(*) FROM accounts) AS total_accounts,
      (SELECT COUNT(*) FROM customers) AS total_customers,
      (SELECT COUNT(*) FROM detection_rules WHERE enabled = true) AS active_rules
    FROM transactions;
  `);

  const row = result.rows[0];
  if (!row) {
    return {
      totalTransactions: 0,
      totalVolumeInr: '0.00',
      completedCount: 0,
      completedVolumeInr: '0.00',
      pendingCount: 0,
      pendingVolumeInr: '0.00',
      flaggedCount: 0,
      flaggedVolumeInr: '0.00',
      rejectedCount: 0,
      rejectedVolumeInr: '0.00',
      cancelledCount: 0,
      cancelledVolumeInr: '0.00',
      failedCount: 0,
      failedVolumeInr: '0.00',
      totalAlerts: 0,
      openAlerts: 0,
      criticalAlerts: 0,
      totalAccounts: 0,
      totalCustomers: 0,
      activeRules: 0,
    };
  }

  return {
    totalTransactions: parseInt(row.total_transactions, 10) || 0,
    totalVolumeInr: row.total_volume_inr || '0.00',
    completedCount: parseInt(row.completed_count, 10) || 0,
    completedVolumeInr: row.completed_volume_inr || '0.00',
    pendingCount: parseInt(row.pending_count, 10) || 0,
    pendingVolumeInr: row.pending_volume_inr || '0.00',
    flaggedCount: parseInt(row.flagged_count, 10) || 0,
    flaggedVolumeInr: row.flagged_volume_inr || '0.00',
    rejectedCount: parseInt(row.rejected_count, 10) || 0,
    rejectedVolumeInr: row.rejected_volume_inr || '0.00',
    cancelledCount: parseInt(row.cancelled_count, 10) || 0,
    cancelledVolumeInr: row.cancelled_volume_inr || '0.00',
    failedCount: parseInt(row.failed_count, 10) || 0,
    failedVolumeInr: row.failed_volume_inr || '0.00',
    totalAlerts: parseInt(row.total_alerts, 10) || 0,
    openAlerts: parseInt(row.open_alerts, 10) || 0,
    criticalAlerts: parseInt(row.critical_alerts, 10) || 0,
    totalAccounts: parseInt(row.total_accounts, 10) || 0,
    totalCustomers: parseInt(row.total_customers, 10) || 0,
    activeRules: parseInt(row.active_rules, 10) || 0,
  };
}

/**
 * Fetches daily aggregated transaction activity for timeline chart visualization.
 * Groups chronological transaction counts and amounts by day.
 */
export async function getActivityTimeline(): Promise<ActivityTimelinePoint[]> {
  const result = await query<{
    date: string;
    transaction_count: string;
    flagged_count: string;
    completed_count: string;
    volume_inr: string;
  }>(`
    SELECT
      TO_CHAR(DATE_TRUNC('day', occurred_at), 'YYYY-MM-DD') AS date,
      COUNT(*)::text AS transaction_count,
      COUNT(*) FILTER (WHERE status = 'FLAGGED')::text AS flagged_count,
      COUNT(*) FILTER (WHERE status = 'COMPLETED')::text AS completed_count,
      COALESCE(SUM(amount) FILTER (WHERE currency = 'INR'), 0)::text AS volume_inr
    FROM transactions
    GROUP BY DATE_TRUNC('day', occurred_at)
    ORDER BY DATE_TRUNC('day', occurred_at) ASC;
  `);

  return result.rows.map((r) => ({
    date: r.date,
    transactionCount: parseInt(r.transaction_count, 10) || 0,
    flaggedCount: parseInt(r.flagged_count, 10) || 0,
    completedCount: parseInt(r.completed_count, 10) || 0,
    volumeInr: r.volume_inr || '0.00',
  }));
}
