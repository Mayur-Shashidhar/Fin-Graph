import { authorizeRequest } from '@/lib/auth';
import { alertFilters, listAlerts, workflowFailure } from '@/lib/workflows';
export async function GET(request: Request) {
  const denied = authorizeRequest(request); if (denied) return denied;
  try { return Response.json(await listAlerts(alertFilters.parse(Object.fromEntries(new URL(request.url).searchParams)))); }
  catch (error) { return workflowFailure(error); }
}
