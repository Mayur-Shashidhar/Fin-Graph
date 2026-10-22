/**
 * FinGraph Database Entities & TypeScript Definitions
 * Mirrors PostgreSQL schema definitions
 */

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP';

export type AccountType = 'SAVINGS' | 'CURRENT' | 'BUSINESS' | 'ESCROW' | 'NOSTRO';

export type AccountStatus = 'ACTIVE' | 'FROZEN' | 'DORMANT' | 'CLOSED' | 'UNDER_REVIEW';

export type TransactionType = 'WIRE_TRANSFER' | 'NEFT' | 'RTGS' | 'IMPS' | 'UPI' | 'INTERNAL_TRANSFER';

export type TransactionStatus = 'COMPLETED' | 'PENDING' | 'FLAGGED' | 'REJECTED' | 'CANCELLED' | 'FAILED';

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type AlertStatus = 'NEW' | 'INVESTIGATING' | 'ESCALATED' | 'CLOSED_RESOLVED' | 'CLOSED_FALSE_POSITIVE';

export interface Customer {
  id: string;
  full_name: string;
  email: string | null;
  created_at: string | Date;
}

export interface Account {
  id: string;
  customer_id: string;
  account_number: string;
  account_type: AccountType;
  currency: CurrencyCode;
  status: AccountStatus;
  created_at: string | Date;
}

export interface Transaction {
  id: string;
  source_account_id: string;
  destination_account_id: string;
  amount: number | string;
  currency: CurrencyCode;
  transaction_type: TransactionType;
  status: TransactionStatus;
  description: string | null;
  occurred_at: string | Date;
  created_at: string | Date;
}

export interface AlertEvidence {
  pattern?: string;
  hop_count?: number;
  elapsed_hours?: number;
  cycle_nodes?: string[];
  total_volume_inr?: number;
  terminal_volume_inr?: number;
  decay_ratio?: number;
  target_account?: string;
  cluster_count?: number;
  amounts_inr?: number[];
  threshold_evaded_inr?: number;
  source_accounts?: string[];
  [key: string]: unknown;
}

export interface Alert {
  id: string;
  transaction_id: string | null;
  alert_type: string;
  risk_score: number;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  description: string | null;
  evidence: AlertEvidence;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface DetectionRule {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  thresholds: Record<string, unknown>;
  created_at: string | Date;
  updated_at: string | Date;
}

/**
 * Health Check API Types
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthCheckResponse {
  status: HealthStatus;
  timestamp: string;
  service: string;
  version: string;
  database: {
    connected: boolean;
    responseTimeMs?: number;
    error?: string;
  };
}

/**
 * Dashboard & Transaction API Types (Sprint 2)
 */
export interface DashboardSummary {
  totalTransactions: number;
  totalVolumeInr: string;
  completedCount: number;
  completedVolumeInr: string;
  pendingCount: number;
  pendingVolumeInr: string;
  flaggedCount: number;
  flaggedVolumeInr: string;
  rejectedCount: number;
  rejectedVolumeInr: string;
  cancelledCount: number;
  cancelledVolumeInr: string;
  failedCount: number;
  failedVolumeInr: string;
  totalAlerts: number;
  openAlerts: number;
  criticalAlerts: number;
  totalAccounts: number;
  totalCustomers: number;
  activeRules: number;
}

export interface ActivityTimelinePoint {
  date: string;
  transactionCount: number;
  flaggedCount: number;
  completedCount: number;
  volumeInr: string;
}

export interface TransactionRecord extends Transaction {
  source_account_number: string;
  source_customer_name: string;
  destination_account_number: string;
  destination_customer_name: string;
}

export interface PaginatedTransactionsResponse {
  data: TransactionRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
}

export interface DashboardResponse {
  summary: DashboardSummary;
  recentTransactions: TransactionRecord[];
  activityTimeline: ActivityTimelinePoint[];
}

