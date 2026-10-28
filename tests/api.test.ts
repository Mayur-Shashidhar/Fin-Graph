import { beforeEach, describe, expect, it, vi } from 'vitest';
import { edge, snapshot, ring } from './fixtures';
import { graphNeighborhood } from '../src/lib/graph/repository';
import { authorizeGraphOperation, graphQuerySchema } from '../src/lib/graph/api';

vi.mock('../src/lib/graph/repository', async importOriginal => ({
  ...await importOriginal<typeof import('../src/lib/graph/repository')>(),
  loadGraphSnapshot: vi.fn(),
}));
vi.mock('../src/lib/graph/sync', () => ({ getSyncStatus: vi.fn(), syncGraph: vi.fn() }));
vi.mock('../src/lib/graph/detection', () => ({
  runDetection: vi.fn(), ProjectionLagError: class extends Error {},
}));
import { loadGraphSnapshot } from '../src/lib/graph/repository';
import { getSyncStatus, syncGraph } from '../src/lib/graph/sync';
import { runDetection } from '../src/lib/graph/detection';
import { GET } from '../src/app/api/graph/route';
import { POST as sync } from '../src/app/api/graph/sync/route';
import { POST as detect } from '../src/app/api/detection/run/route';

const token = 'test-only-operator-token-32-characters';
const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('GRAPH_API_TOKEN', token); });

describe('graph API', () => {
  it('fails closed when unconfigured and requires authentication', () => {
    expect(authorizeGraphOperation(new Request('http://localhost'))?.status).toBe(401);
    vi.stubEnv('GRAPH_API_TOKEN', '');
    expect(authorizeGraphOperation(new Request('http://localhost', { headers }))?.status).toBe(503);
  });
  it('rejects unauthenticated requests before accessing either database', async () => {
    expect((await GET(new Request('http://localhost/api/graph'))).status).toBe(401);
    expect(loadGraphSnapshot).not.toHaveBeenCalled();
    expect((await detect(new Request('http://localhost/api/detection/run', { method: 'POST' }))).status).toBe(401);
    expect(runDetection).not.toHaveBeenCalled();
  });
  it('validates query bounds, timestamps, UUIDs and unknown fields', async () => {
    for (const query of ['depth=100', 'limit=0', 'accountId=bad', 'startDate=tomorrow', 'extra=1', 'startDate=2026-02-01T00:00:00Z&endDate=2026-01-01T00:00:00Z']) {
      expect((await GET(new Request(`http://localhost/api/graph?${query}`, { headers }))).status).toBe(400);
    }
    expect(graphQuerySchema.parse({}).depth).toBe(2);
    expect(graphQuerySchema.parse({accountId:'a0000000-0000-0000-0000-000000000001'}).accountId).toBe('a0000000-0000-0000-0000-000000000001');
  });
  it('returns bounded graph responses and sanitized service errors', async () => {
    vi.mocked(loadGraphSnapshot).mockResolvedValue(snapshot(ring()));
    vi.mocked(getSyncStatus).mockResolvedValue({ pending: 0, failed: 0, dead: 0, processed: 3, revision: '3', lastSyncedAt: null });
    const response = await GET(new Request('http://localhost/api/graph?limit=1', { headers }));
    expect(response.status).toBe(200);
    const body = await response.json(); expect(body.edges).toHaveLength(1); expect(body.meta.truncated).toBe(true);
    vi.mocked(loadGraphSnapshot).mockRejectedValue(new Error('neo4j://secret-password@internal-server'));
    const failure = await GET(new Request('http://localhost/api/graph', { headers }));
    expect(failure.status).toBe(503); expect(await failure.text()).not.toContain('secret-password');
  });
  it('rejects malformed bodies and invalid types without starting work', async () => {
    for (const body of ['{', '{"persist":"false"}', '{"unknown":true}']) {
      expect((await detect(new Request('http://localhost/api/detection/run', { method: 'POST', headers, body }))).status).toBe(400);
    }
    expect(runDetection).not.toHaveBeenCalled();
    expect((await sync(new Request('http://localhost/api/graph/sync', { method: 'POST', headers, body: '{"batchSize":501}' }))).status).toBe(400);
    expect(syncGraph).not.toHaveBeenCalled();
  });
  it('passes preview and batch options to the backend', async () => {
    await detect(new Request('http://localhost/api/detection/run', { method: 'POST', headers, body: '{"persist":false}' }));
    expect(runDetection).toHaveBeenCalledWith(false);
    await sync(new Request('http://localhost/api/graph/sync', { method: 'POST', headers, body: '{"batchSize":25}' }));
    expect(syncGraph).toHaveBeenCalledWith(25);
  });
});

it('limits undirected exploration by hop depth, dates, and edge count', () => {
  const graph = snapshot([edge('1', 'a', 'b'), edge('2', 'b', 'c'), edge('3', 'c', 'd')]);
  expect(graphNeighborhood(graph, { accountId: 'a', depth: 1, limit: 10 }).nodes.map(n => n.id)).toEqual(['a', 'b']);
  expect(graphNeighborhood(graph, { accountId: 'a', depth: 2, limit: 10 }).edges).toHaveLength(2);
  expect(graphNeighborhood(graph, { accountId: 'a', depth: 2, limit: 10, startDate: '2026-04-01T00:00:00Z' }).edges).toHaveLength(0);
});
