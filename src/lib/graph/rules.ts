import { z } from 'zod';
import type { DetectionRule } from '../../types/database';
import type { RuleCode } from '../../types/graph';

const hours = z.number().positive().max(24 * 365);
const money = z.number().positive().max(99999999999999);
const count = z.number().int().min(2).max(1000);
const hops = z.number().int().min(2).max(6);
const percent = z.number().positive().max(100);

export const ruleSchemas = {
  CIRCULAR_FUND_ROUTING: z.strictObject({ min_hops: hops.default(3), max_hops: hops.default(6), retention_time_hours: hours.default(72), amount_retention_pct: percent.default(85) }).refine(v => v.min_hops <= v.max_hops),
  STRUCTURING_SMURFING: z.strictObject({ reporting_threshold: money.default(1000000), lower_bound: money.default(900000), upper_bound: money.default(995000), window_hours: hours.default(48), min_count: count.default(3) }).refine(v => v.lower_bound <= v.upper_bound && v.upper_bound < v.reporting_threshold),
  RAPID_VELOCITY_FLOW_THROUGH: z.strictObject({ velocity_hours: hours.default(2), disbursement_pct: percent.default(90), min_amount: money.default(500000) }),
  DORMANT_ACCOUNT_SPIKE: z.strictObject({ dormancy_days: z.number().int().min(1).max(3650).default(90), spike_amount: money.default(1000000) }),
  MULTI_HOP_LAYERING: z.strictObject({ min_chain_hops: hops.default(4), max_hops: hops.default(6), max_hop_delay_hours: hours.default(24), minimum_chain_amount: money.default(2000000), amount_retention_pct: percent.default(85) }).refine(v => v.min_chain_hops <= v.max_hops),
  SHARED_INTERMEDIARY_MULE: z.strictObject({ fan_in_sources_min: count.default(4), fan_out_dest_min: count.default(3), window_hours: hours.default(36) }),
  HIGH_FREQUENCY_SPLIT_DISPERSAL: z.strictObject({ split_count_min: count.default(4), burst_window_minutes: z.number().positive().max(10080).default(60), min_aggregate_amount: money.default(3000000) }),
};

const names: Record<string, RuleCode> = {
  'Circular Fund Routing (Ring Pattern)': 'CIRCULAR_FUND_ROUTING',
  'Structuring & Smurfing (Threshold Evasion)': 'STRUCTURING_SMURFING',
  'Rapid Velocity Flow-Through': 'RAPID_VELOCITY_FLOW_THROUGH',
  'Dormant Account Reactivation Spike': 'DORMANT_ACCOUNT_SPIKE',
  'Multi-Hop Layering Chain': 'MULTI_HOP_LAYERING',
  'Shared Intermediary (Fan-In Fan-Out Mule)': 'SHARED_INTERMEDIARY_MULE',
  'High-Frequency Split Transfers': 'HIGH_FREQUENCY_SPLIT_DISPERSAL',
};

export function ruleCode(rule: DetectionRule): RuleCode | undefined {
  return names[rule.name];
}

export function validateRule(rule: DetectionRule) {
  const code = ruleCode(rule);
  if (!code) throw new Error(`Unsupported detection rule: ${rule.id}`);
  const result = ruleSchemas[code].safeParse(rule.thresholds);
  if (!result.success) throw new Error(`Invalid thresholds for rule ${rule.id}`);
  return { code, thresholds: result.data as Record<string, number> };
}
