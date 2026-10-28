import { getDetectionRules } from '@/lib/queries/rules';
import { ruleCode, validateRule } from '@/lib/graph/rules';
import { authorizeGraphOperation, graphApiError } from '@/lib/graph/api';

export async function GET(request: Request) {
  const denied = authorizeGraphOperation(request);
  if (denied) return denied;
  try {
    const data = (await getDetectionRules()).map(rule => {
      const code = ruleCode(rule);
      return { ...rule, code: code ?? null, supported: !!code,
        effectiveThresholds: code ? validateRule(rule).thresholds : null };
    });
    return Response.json({ data });
  } catch (error) { return graphApiError(error); }
}
