import { authorizeRequest } from '@/lib/auth';
import { query } from '@/lib/db';
import { workflowFailure } from '@/lib/workflows';
export async function GET(request: Request) {
  const denied = authorizeRequest(request); if (denied) return denied;
  try {
    const data = await query(`SELECT a.*, c.full_name AS customer_name FROM accounts a JOIN customers c ON c.id = a.customer_id ORDER BY a.account_number LIMIT 1000`);
    return Response.json({ data: data.rows });
  } catch (error) { return workflowFailure(error); }
}
