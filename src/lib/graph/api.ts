import 'server-only';
import { authorizeRequest } from '../auth';
import { databaseId } from '../validation';
import { z } from 'zod';
import { GraphCapacityError } from './engine';
import { ProjectionLagError } from './detection';

export const graphQuerySchema = z.object({
  accountId: databaseId.optional(),
  depth: z.coerce.number().int().min(1).max(6).default(2),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  startDate: z.iso.datetime({ offset: true }).optional(),
  endDate: z.iso.datetime({ offset: true }).optional(),
}).strict().refine(v => !v.startDate || !v.endDate || Date.parse(v.startDate) <= Date.parse(v.endDate), { message: 'startDate must precede endDate' });

/** Server-side operator authentication for every graph data/operation endpoint. */
export function authorizeGraphOperation(request: Request): Response | null {
  return authorizeRequest(request);
}

export async function readGraphBody(request: Request): Promise<unknown> {
  const body = await request.text();
  if (body.length > 10000) throw new GraphRequestError('Request body is too large');
  try { return body.trim() ? JSON.parse(body) : {}; }
  catch { throw new GraphRequestError('Invalid JSON request body'); }
}

export class GraphRequestError extends Error {}
export function graphApiError(error: unknown): Response {
  if (error instanceof z.ZodError || error instanceof GraphRequestError) return Response.json({ error: 'Invalid graph request' }, { status: 400 });
  if (error instanceof GraphCapacityError) return Response.json({ error: error.message }, { status: 422 });
  if (error instanceof ProjectionLagError) return Response.json({ error: error.message }, { status: 409 });
  return Response.json({ error: 'Graph operation unavailable. Check database setup, connectivity and rule configuration.' }, { status: 503 });
}
