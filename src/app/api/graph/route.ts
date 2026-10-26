import { authorizeGraphOperation, graphApiError, graphQuerySchema } from '@/lib/graph/api';
import { graphNeighborhood, loadGraphSnapshot } from '@/lib/graph/repository';
import { getSyncStatus } from '@/lib/graph/sync';

export async function GET(request: Request) {
  const denied = authorizeGraphOperation(request);
  if (denied) return denied;
  try {
    const params = graphQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const snapshot = await loadGraphSnapshot();
    if (params.accountId && !snapshot.nodes.some(n => n.id === params.accountId)) return Response.json({ error: 'Account not found in graph projection' }, { status: 404 });
    return Response.json({ ...graphNeighborhood(snapshot, params), sync: await getSyncStatus() });
  } catch (error) { return graphApiError(error); }
}
