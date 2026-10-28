import { databaseId } from '@/lib/validation';
import { authorizeRequest, requestSession } from '@/lib/auth';
import { readGraphBody } from '@/lib/graph/api';
import { alertDetails, reviewAlert, reviewSchema, workflowFailure } from '@/lib/workflows';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  const denied = authorizeRequest(request); if (denied) return denied;
  try { return Response.json(await alertDetails(databaseId.parse((await context.params).id))); }
  catch (error) { return workflowFailure(error); }
}
export async function PATCH(request: Request, context: Context) {
  const denied = authorizeRequest(request); if (denied) return denied;
  try { return Response.json(await reviewAlert(databaseId.parse((await context.params).id), reviewSchema.parse(await readGraphBody(request)), requestSession(request)?.name ?? 'API operator')); }
  catch (error) { return workflowFailure(error); }
}
