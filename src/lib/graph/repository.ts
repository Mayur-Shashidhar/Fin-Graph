import 'server-only';
import neo4j from 'neo4j-driver';
import { graphTransaction } from '../neo4j';
import { MAX_GRAPH_EDGES, MAX_GRAPH_NODES } from './config';
import { GraphCapacityError } from './engine';
import type { GraphAccount, GraphSnapshot, GraphTransfer } from '../../types/graph';
import { PROJECTION_LOCK } from './sync';
import { isDemo } from '../demo';
import { loadDemoProjection } from './demo-projection';

/** Lock against projection writes while materializing both nodes and edges.
 * The data set is intentionally bounded for the academic prototype.
 */
export async function loadGraphSnapshot(): Promise<GraphSnapshot> {
  if (isDemo()) return loadDemoProjection();
  return graphTransaction('write', async tx => {
    await tx.run(PROJECTION_LOCK);
    const nodes = await tx.run(`MATCH (a:Account) RETURN a { .*, id: a.accountId } AS account LIMIT $limit`, { limit: neo4j.int(MAX_GRAPH_NODES + 1) });
    const edges = await tx.run(`MATCH (a:Account)-[t:TRANSFER]->(b:Account)
      RETURN t { .*, id: t.transactionId, source: a.accountId, target: b.accountId,
      occurredAt: toString(t.occurredAt) } AS transfer LIMIT $limit`, { limit: neo4j.int(MAX_GRAPH_EDGES + 1) });
    if (nodes.records.length > MAX_GRAPH_NODES || edges.records.length > MAX_GRAPH_EDGES) throw new GraphCapacityError('Graph exceeds prototype capacity');
    return {
      nodes: nodes.records.map(r => r.get('account') as GraphAccount),
      edges: edges.records.map(r => r.get('transfer') as GraphTransfer),
    };
  });
}

export interface GraphFilter { accountId?: string; depth: number; limit: number; startDate?: string; endDate?: string }

export function graphNeighborhood(snapshot: GraphSnapshot, filter: GraphFilter) {
  const eligible = snapshot.edges.filter(e => (!filter.startDate || Date.parse(e.occurredAt) >= Date.parse(filter.startDate)) && (!filter.endDate || Date.parse(e.occurredAt) <= Date.parse(filter.endDate)));
  const selected = new Set<string>(filter.accountId ? [filter.accountId] : snapshot.nodes.map(n => n.id));
  if (filter.accountId) {
    let frontier = new Set([filter.accountId]);
    for (let i = 0; i < filter.depth; i++) {
      const next = new Set<string>();
      for (const edge of eligible) {
        if (frontier.has(edge.source) && !selected.has(edge.target)) next.add(edge.target);
        if (frontier.has(edge.target) && !selected.has(edge.source)) next.add(edge.source);
      }
      for (const id of next) selected.add(id);
      frontier = next;
    }
  }
  const candidates = eligible.filter(e => selected.has(e.source) && selected.has(e.target)).sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt) || a.id.localeCompare(b.id));
  const edges = candidates.slice(0, filter.limit);
  const visible = new Set(edges.flatMap(e => [e.source, e.target]));
  if (filter.accountId) visible.add(filter.accountId);
  const nodes = snapshot.nodes.filter(n => visible.has(n.id));
  return { nodes, edges, meta: { truncated: candidates.length > edges.length, totalEdges: candidates.length, depth: filter.depth } };
}
