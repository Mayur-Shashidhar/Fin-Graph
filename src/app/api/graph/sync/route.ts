import { z } from 'zod';
import { authorizeGraphOperation, graphApiError, readGraphBody } from '@/lib/graph/api';
import { getSyncStatus, syncGraph } from '@/lib/graph/sync';

export async function GET(request: Request) {
  const denied = authorizeGraphOperation(request);
  if (denied) return denied;
  try { return Response.json(await getSyncStatus()); }
  catch (error) { return graphApiError(error); }
}
export async function POST(request: Request) {
  const denied = authorizeGraphOperation(request);
  if (denied) return denied;
  try {
    const { batchSize } = z.object({ batchSize: z.number().int().min(1).max(500).default(100) }).strict().parse(await readGraphBody(request));
    return Response.json(await syncGraph(batchSize));
  } catch (error) { return graphApiError(error); }
}
