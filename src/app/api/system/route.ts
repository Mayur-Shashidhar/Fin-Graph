import { authorizeRequest } from '@/lib/auth';
import { checkDatabaseHealth, query } from '@/lib/db';
import { checkGraphHealth } from '@/lib/neo4j';
import { getSyncStatus } from '@/lib/graph/sync';
import { isDemo } from '@/lib/demo';
import { workflowFailure } from '@/lib/workflows';
export async function GET(request: Request) {
  const denied = authorizeRequest(request); if (denied) return denied;
  try {
    const [database, graph, sync, runs] = await Promise.all([checkDatabaseHealth(), checkGraphHealth(), getSyncStatus(), query('SELECT * FROM graph_detection_runs ORDER BY started_at DESC LIMIT 5')]);
    return Response.json({ demo: isDemo(), database, graph, sync, runs: runs.rows });
  } catch (error) { return workflowFailure(error); }
}
