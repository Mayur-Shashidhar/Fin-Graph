import { z } from 'zod';
import { authorizeGraphOperation, graphApiError, readGraphBody } from '@/lib/graph/api';
import { runDetection } from '@/lib/graph/detection';

export async function POST(request: Request) {
  const denied = authorizeGraphOperation(request);
  if (denied) return denied;
  try {
    const { persist } = z.object({ persist: z.boolean().default(true) }).strict().parse(await readGraphBody(request));
    return Response.json(await runDetection(persist));
  } catch (error) { return graphApiError(error); }
}
