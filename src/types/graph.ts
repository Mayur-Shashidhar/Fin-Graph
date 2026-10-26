import type { AlertSeverity } from './database';

export interface GraphAccount {
  id: string;
  accountNumber: string;
  customerId: string;
  customerName: string;
  currency: string;
  status: string;
  createdAt: string;
}

export interface GraphTransfer {
  id: string;
  source: string;
  target: string;
  // Decimal strings are retained at the API boundary. Detection uses exact minor units.
  amount: string;
  currency: string;
  status: string;
  occurredAt: string;
}

export interface GraphSnapshot {
  nodes: GraphAccount[];
  edges: GraphTransfer[];
}

export const RULE_CODES = [
  'CIRCULAR_FUND_ROUTING', 'STRUCTURING_SMURFING', 'RAPID_VELOCITY_FLOW_THROUGH',
  'DORMANT_ACCOUNT_SPIKE', 'MULTI_HOP_LAYERING', 'SHARED_INTERMEDIARY_MULE',
  'HIGH_FREQUENCY_SPLIT_DISPERSAL',
] as const;
export type RuleCode = typeof RULE_CODES[number];

export interface GraphFinding {
  fingerprint: string;
  ruleCode: RuleCode;
  ruleId: string;
  ruleVersion: string;
  riskScore: number;
  severity: AlertSeverity;
  title: string;
  evidence: {
    accountIds: string[];
    transactionIds: string[];
    accountPath: string[];
    currency: string;
    amounts: string[];
    timestamps: string[];
    hopCount: number;
    thresholds: Record<string, unknown>;
    metrics: Record<string, string | number>;
  };
}
