import { databaseId } from '@/lib/validation';
import { authorizeRequest, requestSession } from '@/lib/auth';
import { readGraphBody } from '@/lib/graph/api';
import { updateRule, updateRuleSchema, workflowFailure } from '@/lib/workflows';
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = authorizeRequest(request); if (denied) return denied;
  try { return Response.json(await updateRule(databaseId.parse((await context.params).id), updateRuleSchema.parse(await readGraphBody(request)), requestSession(request)?.name ?? 'API operator')); }
  catch (error) { return workflowFailure(error); }
}
