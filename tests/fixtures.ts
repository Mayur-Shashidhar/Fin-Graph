import type { DetectionRule } from '../src/types/database';
import type { GraphAccount, GraphSnapshot, GraphTransfer } from '../src/types/graph';

export const ruleNames = [
  'Circular Fund Routing (Ring Pattern)', 'Structuring & Smurfing (Threshold Evasion)',
  'Rapid Velocity Flow-Through', 'Dormant Account Reactivation Spike',
  'Multi-Hop Layering Chain', 'Shared Intermediary (Fan-In Fan-Out Mule)', 'High-Frequency Split Transfers',
];
export function rule(index: number, thresholds: Record<string, unknown> = {}): DetectionRule {
  return { id: `rule-${index}`, name: ruleNames[index], enabled: true, thresholds, description: null, created_at: '', updated_at: '' };
}
export function edge(id: string, source: string, target: string, amount = '1000000.00', minute = 0, extra: Partial<GraphTransfer> = {}): GraphTransfer {
  return { id, source, target, amount, currency: 'INR', status: 'COMPLETED', occurredAt: new Date(Date.UTC(2026, 2, 1, 0, minute)).toISOString(), ...extra };
}
export function snapshot(edges: GraphTransfer[]): GraphSnapshot {
  const nodes: GraphAccount[] = [...new Set(edges.flatMap(e => [e.source, e.target]))].map(id => ({
    id, accountNumber: id, customerId: `owner-${id}`, customerName: id, currency: 'INR', status: 'ACTIVE', createdAt: '2025-01-01T00:00:00.000Z',
  }));
  return { nodes, edges };
}
export function ring() { return [edge('1', 'a', 'b', '1000000.00', 0), edge('2', 'b', 'c', '950000.00', 10), edge('3', 'c', 'a', '900000.00', 20)]; }
