import { beforeEach, expect, it, vi } from 'vitest';
import { rule, ring, snapshot } from './fixtures';
vi.mock('../src/lib/db',()=>({query:vi.fn(),getClient:vi.fn()}));
vi.mock('../src/lib/queries/rules',()=>({getDetectionRules:vi.fn()}));
vi.mock('../src/lib/graph/repository',()=>({loadGraphSnapshot:vi.fn()}));
vi.mock('../src/lib/graph/sync',()=>({getSyncStatus:vi.fn()}));
import { query, getClient } from '../src/lib/db';
import { getDetectionRules } from '../src/lib/queries/rules';
import { loadGraphSnapshot } from '../src/lib/graph/repository';
import { getSyncStatus } from '../src/lib/graph/sync';
import { runDetection, ProjectionLagError } from '../src/lib/graph/detection';

const status={pending:0,failed:0,dead:0,processed:3,revision:'3',lastSyncedAt:null};
beforeEach(()=>{
  vi.resetAllMocks();
  vi.mocked(query).mockResolvedValue({rows:[{id:'run-audit'}],rowCount:1,command:'SELECT',oid:0,fields:[]});
  vi.mocked(getDetectionRules).mockResolvedValue([rule(0)]);
  vi.mocked(loadGraphSnapshot).mockResolvedValue(snapshot(ring()));
});
it('rejects a projection changed and fully resynchronized during analysis',async()=>{
  vi.mocked(getSyncStatus).mockResolvedValueOnce(status).mockResolvedValueOnce({...status,revision:'4'});
  await expect(runDetection()).rejects.toBeInstanceOf(ProjectionLagError);
  expect(getClient).not.toHaveBeenCalled();
  expect(query).toHaveBeenLastCalledWith(expect.stringContaining("status = 'FAILED'"),['run-audit']);
});
it('records the analyzed projection revision on a consistent preview',async()=>{
  vi.mocked(getSyncStatus).mockResolvedValue(status);
  const result=await runDetection(false);
  expect(result.findingCount).toBe(1);expect(result.projectionRevision).toBe('3');
  expect(getClient).not.toHaveBeenCalled();
});
