import { describe, it, expect } from 'vitest';
import { detectPatterns, GraphCapacityError } from '../src/lib/graph/engine';
import { minorUnits, decimalAmount } from '../src/lib/graph/money';
import { edge, snapshot, rule, ring } from './fixtures';

const run = (edges: ReturnType<typeof ring>, index: number, thresholds = {}) => detectPatterns(snapshot(edges), [rule(index, thresholds)]).findings;

describe('temporal graph detection', () => {
  it('detects one chronological ring with exact path evidence and stable identity', () => {
    const first = run(ring(), 0);
    expect(first).toHaveLength(1);
    expect(first[0].evidence.accountPath).toEqual(['a', 'b', 'c', 'a']);
    expect(first[0].evidence.transactionIds).toEqual(['1', '2', '3']);
    expect(run([...ring()].reverse(), 0)[0].fingerprint).toBe(first[0].fingerprint);
  });
  it.each(['PENDING', 'FAILED', 'CANCELLED', 'REJECTED'])('excludes %s transfers', status => {
    const edges = ring(); edges[1].status = status;
    expect(run(edges, 0)).toHaveLength(0);
  });
  it('includes settled FLAGGED transfers from the classroom dataset', () => {
    const edges = ring(); edges[2].status = 'FLAGGED'; expect(run(edges, 0)).toHaveLength(1);
  });
  it('rejects reversed time, long windows, low retention and mixed currency cycles', () => {
    for (const extra of [{ occurredAt: '2026-02-28T00:00:00Z' }, { occurredAt: '2026-04-01T00:00:00Z' }, { amount: '100.00' }, { currency: 'USD' }]) {
      const edges = ring(); Object.assign(edges[2], extra); expect(run(edges, 0)).toHaveLength(0);
    }
  });
  it('does not report a repeated-node walk as a simple cycle', () => {
    expect(run([edge('1', 'a', 'b'), edge('2', 'b', 'c', '1000000', 1), edge('3', 'c', 'b', '1000000', 2), edge('4', 'b', 'a', '1000000', 3)], 0, { min_hops: 4 })).toHaveLength(0);
  });
  it('detects four-hop layering and enforces per-hop delays', () => {
    const chain = [edge('1', 'a', 'b', '3000000', 0), edge('2', 'b', 'c', '2900000', 1), edge('3', 'c', 'd', '2800000', 2), edge('4', 'd', 'e', '2700000', 3)];
    expect(run(chain, 4)).toHaveLength(1);
    expect(run(chain.map(e => ({ ...e, currency: 'USD' })), 4)).toHaveLength(0);
    chain[3].occurredAt = '2026-03-04T00:00:00Z'; expect(run(chain, 4)).toHaveLength(0);
  });
  it('finds repeated sub-threshold transfers, excluding boundary and FX mistakes', () => {
    const transfers = [edge('1', 'a', 'hub', '950000', 0), edge('2', 'b', 'hub', '965000', 20), edge('3', 'c', 'hub', '980000', 30)];
    expect(run(transfers, 1)).toHaveLength(1);
    expect(run(transfers.map(e => ({ ...e, amount: '1000000' })), 1)).toHaveLength(0);
    expect(run(transfers.map(e => ({ ...e, currency: 'USD' })), 1)).toHaveLength(0);
  });
  it('aggregates rapid outflows, with FIFO attribution preventing double use', () => {
    const transfers = [edge('1', 'a', 'hub', '1000000', 0), edge('2', 'hub', 'b', '500000', 10), edge('3', 'hub', 'c', '450000', 20)];
    const result = run(transfers, 2);
    expect(result).toHaveLength(1);
    expect(result[0].evidence.metrics.allocatedAmount).toBe('950000.00');
    expect(run([transfers[0], edge('4', 'z', 'hub', '1000000', 1), ...transfers.slice(1)], 2)).toHaveLength(1);
  });
  it('requires distinct fan-in sources and fan-out destinations with causal ordering', () => {
    const transfers = [0, 1, 2, 3].map(i => edge(`in${i}`, `a${i}`, 'hub', '1000000', 0));
    transfers.push(...[0, 1, 2].map(i => edge(`out${i}`, 'hub', `b${i}`, '1000000', 20)));
    expect(run(transfers, 5)).toHaveLength(1);
    expect(run(transfers.map(e => e.id.startsWith('out') ? { ...e, occurredAt: '2026-02-28T00:00:00Z' } : e), 5)).toHaveLength(0);
  });
  it('preserves a completed intermediary pattern when an unrelated receipt follows it', () => {
    const transfers = [0,1,2,3].map(i=>edge(`in${i}`,`a${i}`,'hub','1000000',0));
    transfers.push(...[0,1,2,3,4].map(i=>edge(`out${i}`,'hub',`b${i}`,'800000',10+i)));
    transfers.push(edge('later-credit','late-sender','hub','100',20));
    const result=run(transfers,5);
    expect(result).toHaveLength(1);
    expect(result[0].evidence.transactionIds).toHaveLength(9);
    expect(result[0].evidence.transactionIds).not.toContain('later-credit');
  });
  it('requires split-transfer counterparty diversity and respects disabled rules', () => {
    const transfers = [0, 1, 2, 3].map(i => edge(`s${i}`, 'hub', `b${i}`, '920000', i));
    expect(run(transfers, 6)).toHaveLength(1);
    expect(run(transfers.map(e => ({ ...e, target: 'b' })), 6)).toHaveLength(0);
    expect(detectPatterns(snapshot(transfers), [{ ...rule(6), enabled: false }]).findings).toHaveLength(0);
  });
  it('measures dormancy from activity history, not the current account status', () => {
    expect(run([edge('spike', 'a', 'b', '2000000')], 3)).toHaveLength(1);
    expect(run([edge('recent', 'z', 'a', '100', -60), edge('spike', 'a', 'b', '2000000')], 3)).toHaveLength(0);
  });
  it('validates rule bounds, preserves unknown rules as skipped, changes identity on threshold changes', () => {
    expect(() => run(ring(), 0, { max_hops: 100 })).toThrow('Invalid thresholds');
    const result = detectPatterns(snapshot(ring()), [{ ...rule(0), name: 'Unknown custom rule' }]);
    expect(result.skippedRules).toEqual(['rule-0']);
    expect(run(ring(), 0)[0].fingerprint).not.toBe(run(ring(), 0, { amount_retention_pct: 80 })[0].fingerprint);
  });
  it('fails explicitly on graph capacity or malformed projection data', () => {
    const graph = snapshot(ring()); graph.edges = Array(10001).fill(graph.edges[0]);
    expect(() => detectPatterns(graph, [rule(0)])).toThrow(GraphCapacityError);
    const invalid = ring(); invalid[0].amount = 'NaN'; expect(() => run(invalid, 0)).toThrow();
  });
  it('handles empty graphs and large NUMERIC values without precision loss', () => {
    expect(detectPatterns({ nodes: [], edges: [] }, [rule(0)]).findings).toEqual([]);
    const value = '99999999999999.99'; expect(decimalAmount(minorUnits(value))).toBe(value);
    expect(minorUnits('0.01')).toBe(BigInt(1));
    expect(() => minorUnits('1.001')).toThrow();
  });
});
