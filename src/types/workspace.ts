import type { Alert, TransactionRecord } from './database';
export interface AlertDetail {
  alert: Alert;
  transactions: TransactionRecord[];
  notes: { id: string; author: string; body: string; created_at: string }[];
  history: { id: string; actor: string; action: string; details: Record<string, unknown>; created_at: string }[];
}
export interface SystemStatus {
  demo: boolean;
  database: { connected: boolean };
  graph: { connected: boolean };
  sync: { pending: number; failed: number; dead: number; processed: number; lastSyncedAt: string | null };
  runs: { id: string; status: string; started_at: string; summary: { findingCount?: number; created?: number; durationMs?: number } }[];
}
