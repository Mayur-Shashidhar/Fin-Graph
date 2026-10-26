import { createHash } from 'node:crypto';
import type { DetectionRule } from '../../types/database';
import type { GraphFinding, GraphSnapshot, GraphTransfer, RuleCode } from '../../types/graph';
import { ELIGIBLE_STATUSES, MAX_GRAPH_EDGES, MAX_GRAPH_NODES } from './config';
import { atLeastPercent, decimalAmount, minorUnits } from './money';
import { ruleCode, validateRule } from './rules';

export class GraphCapacityError extends Error {}
const HOUR = 3600000;
const VERSION = '1';
const scores: Record<RuleCode, number> = {
  CIRCULAR_FUND_ROUTING: 90, STRUCTURING_SMURFING: 70, RAPID_VELOCITY_FLOW_THROUGH: 65,
  DORMANT_ACCOUNT_SPIKE: 60, MULTI_HOP_LAYERING: 75, SHARED_INTERMEDIARY_MULE: 80,
  HIGH_FREQUENCY_SPLIT_DISPERSAL: 70,
};
const time = (t: GraphTransfer) => Date.parse(t.occurredAt);
const cents = (value: number) => minorUnits(value.toFixed(2));
const sum = (edges: GraphTransfer[]) => edges.reduce((total, edge) => total + minorUnits(edge.amount), BigInt(0));
function group(edges: GraphTransfer[], key: (edge: GraphTransfer) => string) {
  const map = new Map<string, GraphTransfer[]>();
  for (const edge of edges) {
    const k = key(edge);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(edge);
  }
  return map;
}

/** Bounded temporal graph traversal over an exact Neo4j projection snapshot.
 * Throws on capacity exhaustion; a partial search is never labelled complete.
 */
export function detectPatterns(snapshot: GraphSnapshot, rules: DetectionRule[]) {
  if (snapshot.edges.length > MAX_GRAPH_EDGES || snapshot.nodes.length > MAX_GRAPH_NODES) throw new GraphCapacityError('Graph exceeds prototype capacity');
  const ids = new Set(snapshot.nodes.map(n => n.id));
  const seenTransactions = new Set<string>();
  for (const edge of snapshot.edges) {
    if (seenTransactions.has(edge.id) || !ids.has(edge.source) || !ids.has(edge.target) || !Number.isFinite(time(edge)) || minorUnits(edge.amount) <= BigInt(0)) throw new Error('Invalid graph snapshot');
    seenTransactions.add(edge.id);
  }
  const edges = snapshot.edges.filter(e => ELIGIBLE_STATUSES.includes(e.status)).sort((a, b) => time(a) - time(b) || a.id.localeCompare(b.id));
  const outgoing = group(edges, e => e.source);
  const findings = new Map<string, GraphFinding>();
  const skippedRules: string[] = [];
  let operations = 0;
  const budget = () => { if (++operations > 250000) throw new GraphCapacityError('Detection traversal budget exceeded for the prototype dataset'); };

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (!ruleCode(rule)) { skippedRules.push(rule.id); continue; }
    const { code, thresholds: p } = validateRule(rule);
    const version = `${VERSION}:${createHash('sha256').update(JSON.stringify(Object.entries(p).sort())).digest('hex').slice(0, 12)}`;
    function emit(path: GraphTransfer[], accountPath: string[], metrics: Record<string, string | number> = {}) {
      const transactionIds = path.map(e => e.id);
      // Sorting makes rotated cycles and repeated windows have the same identity.
      const fingerprint = createHash('sha256').update(JSON.stringify([rule.id, code, version, path[0].currency, [...transactionIds].sort()])).digest('hex');
      const riskScore = scores[code];
      findings.set(fingerprint, {
        fingerprint, ruleId: rule.id, ruleCode: code, ruleVersion: version, riskScore,
        severity: riskScore >= 75 ? 'CRITICAL' : riskScore >= 50 ? 'HIGH' : riskScore >= 25 ? 'MEDIUM' : 'LOW',
        title: rule.name,
        evidence: {
          accountIds: [...new Set(path.flatMap(e => [e.source, e.target]))], transactionIds,
          accountPath, currency: path[0].currency, amounts: path.map(e => e.amount),
          timestamps: path.map(e => e.occurredAt), hopCount: path.length, thresholds: p, metrics,
        },
      });
      if (findings.size > 1000) throw new GraphCapacityError('Finding count exceeds the prototype capacity');
      return fingerprint;
    }

    if (code === 'CIRCULAR_FUND_ROUTING' || code === 'MULTI_HOP_LAYERING') {
      const cycle = code === 'CIRCULAR_FUND_ROUTING';
      for (const first of edges) {
        if (!cycle && (first.currency !== 'INR' || minorUnits(first.amount) < cents(p.minimum_chain_amount))) continue;
        const visit = (path: GraphTransfer[], nodes: string[]) => {
          const last = path[path.length - 1];
          if (path.length >= p.max_hops) return;
          for (const next of outgoing.get(last.target) ?? []) {
            budget();
            if (next.currency !== first.currency || time(next) < time(last) || minorUnits(next.amount) > minorUnits(last.amount)) continue;
            if (!atLeastPercent(minorUnits(next.amount), minorUnits(first.amount), p.amount_retention_pct)) continue;
            if (cycle ? time(next) - time(first) > p.retention_time_hours * HOUR : time(next) - time(last) > p.max_hop_delay_hours * HOUR) continue;
            const nextPath = [...path, next], nextNodes = [...nodes, next.target];
            if (cycle && next.target === first.source) {
              if (nextPath.length >= p.min_hops) emit(nextPath, nextNodes, { elapsedHours: (time(next) - time(first)) / HOUR });
              continue;
            }
            if (nodes.includes(next.target)) continue;
            if (!cycle && nextPath.length >= p.min_chain_hops) emit(nextPath, nextNodes, { elapsedHours: (time(next) - time(first)) / HOUR });
            visit(nextPath, nextNodes);
          }
        };
        visit([first], [first.source, first.target]);
      }
    }

    if (code === 'STRUCTURING_SMURFING' || code === 'HIGH_FREQUENCY_SPLIT_DISPERSAL') {
      const structuring = code === 'STRUCTURING_SMURFING';
      // Seed thresholds are INR amounts; never apply them to another currency.
      const candidates = edges.filter(e => e.currency === 'INR' && (!structuring || (minorUnits(e.amount) >= cents(p.lower_bound) && minorUnits(e.amount) <= cents(p.upper_bound))));
      for (const transfers of group(candidates, e => structuring ? e.target : e.source).values()) {
        let previous = new Set<string>();
        for (let start = 0; start < transfers.length; start++) {
          const window = transfers.slice(start).filter(e => { budget(); return time(e) - time(transfers[start]) <= (structuring ? p.window_hours * HOUR : p.burst_window_minutes * 60000); });
          const distinct = new Set(window.map(e => structuring ? e.source : e.target)).size;
          if (window.length < (structuring ? p.min_count : p.split_count_min) || (!structuring && (distinct < p.split_count_min || sum(window) < cents(p.min_aggregate_amount)))) continue;
          if (window.every(e => previous.has(e.id))) continue;
          emit(window, [], { totalAmount: decimalAmount(sum(window)), counterpartyCount: distinct });
          previous = new Set(window.map(e => e.id));
        }
      }
    }

    if (code === 'RAPID_VELOCITY_FLOW_THROUGH') {
      // FIFO allocation limits each outgoing minor unit to one incoming transfer.
      // This is an explainable heuristic, not proof of actual fund provenance.
      for (const incoming of group(edges, e => `${e.target}|${e.currency}`).values()) {
        const remaining = new Map<string, bigint>();
        for (const receipt of incoming) {
          let allocated = BigInt(0);
          const used: GraphTransfer[] = [];
          for (const payment of outgoing.get(receipt.target) ?? []) {
            budget();
            if (payment.currency !== receipt.currency || time(payment) < time(receipt) || time(payment) - time(receipt) > p.velocity_hours * HOUR) continue;
            const available = remaining.get(payment.id) ?? minorUnits(payment.amount);
            const needed = minorUnits(receipt.amount) - allocated;
            const take = available < needed ? available : needed;
            if (take <= BigInt(0)) continue;
            allocated += take; remaining.set(payment.id, available - take); used.push(payment);
            if (allocated === minorUnits(receipt.amount)) break;
          }
          if (receipt.currency === 'INR' && minorUnits(receipt.amount) >= cents(p.min_amount) && atLeastPercent(allocated, minorUnits(receipt.amount), p.disbursement_pct)) emit([receipt, ...used], [], { intermediary: receipt.target, allocatedAmount: decimalAmount(allocated), attribution: 'FIFO heuristic' });
        }
      }
    }

    if (code === 'SHARED_INTERMEDIARY_MULE') {
      for (const account of snapshot.nodes) {
        const touching = edges.filter(e => { budget(); return e.source === account.id || e.target === account.id; });
        for (const currencyEdges of group(touching, e => e.currency).values()) {
          let previous = new Set<string>();
          let previousFingerprint: string | undefined;
          // Close candidate windows at each outgoing event. A later unrelated
          // receipt must not erase a consolidation/dispersal already completed.
          for (let end = 0; end < currencyEdges.length; end++) {
            if (currencyEdges[end].source !== account.id) continue;
            const window = currencyEdges.slice(0, end + 1).filter(e => { budget(); return time(currencyEdges[end]) - time(e) <= p.window_hours * HOUR; });
            const ins = window.filter(e => e.target === account.id);
            if (!ins.length) continue;
            // Require the consolidation to precede the dispersal.
            const outs = window.filter(e => e.source === account.id && time(e) >= time(ins[ins.length - 1]));
            const sources = new Set(ins.map(e => e.source)).size, targets = new Set(outs.map(e => e.target)).size;
            if (sources < p.fan_in_sources_min || targets < p.fan_out_dest_min) continue;
            const path = [...ins, ...outs];
            if (path.every(e => previous.has(e.id))) continue;
            const current = new Set(path.map(e => e.id));
            // Keep maximal evidence when one burst grows from three to more
            // recipients, rather than emitting every prefix of the same burst.
            if (previousFingerprint && [...previous].every(id => current.has(id))) findings.delete(previousFingerprint);
            previousFingerprint = emit(path, [], { intermediary: account.id, fanIn: sources, fanOut: targets, inflow: decimalAmount(sum(ins)), outflow: decimalAmount(sum(outs)) });
            previous = new Set(path.map(e => e.id));
          }
        }
      }
    }

    if (code === 'DORMANT_ACCOUNT_SPIKE') {
      for (const account of snapshot.nodes) {
        let lastActivity = Date.parse(account.createdAt);
        for (const transfer of edges) {
          budget();
          if (transfer.source !== account.id && transfer.target !== account.id) continue;
          const days = (time(transfer) - lastActivity) / (24 * HOUR);
          if (transfer.source === account.id && transfer.currency === 'INR' && days >= p.dormancy_days && minorUnits(transfer.amount) >= cents(p.spike_amount)) emit([transfer], [transfer.source, transfer.target], { dormantDays: days });
          lastActivity = time(transfer);
        }
      }
    }
  }
  return { findings: [...findings.values()].sort((a, b) => b.riskScore - a.riskScore || a.fingerprint.localeCompare(b.fingerprint)), skippedRules, operations };
}
