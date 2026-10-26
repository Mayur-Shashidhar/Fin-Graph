import { authorizeRequest } from '@/lib/auth';
import { retryFailedEvents } from '@/lib/graph/sync';
import { graphApiError } from '@/lib/graph/api';
export async function POST(request: Request) {
  const denied=authorizeRequest(request);if(denied)return denied;
  try { const result=await retryFailedEvents();return Response.json({queued:result.rowCount??0}); }
  catch(error){return graphApiError(error);}
}
