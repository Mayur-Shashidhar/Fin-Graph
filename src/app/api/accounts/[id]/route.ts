import { authorizeRequest } from '@/lib/auth';
import { databaseId } from '@/lib/validation';
import { query } from '@/lib/db';
import { WorkflowError, workflowFailure } from '@/lib/workflows';
export async function GET(request:Request,context:{params:Promise<{id:string}>}){
  const denied=authorizeRequest(request);if(denied)return denied;
  try{
    const id=databaseId.parse((await context.params).id);
    const account=await query('SELECT a.*,c.full_name AS customer_name FROM accounts a JOIN customers c ON c.id=a.customer_id WHERE a.id=$1',[id]);
    if(!account.rows[0])throw new WorkflowError('Account not found.',404);
    const transactions=await query('SELECT * FROM transactions WHERE source_account_id=$1 OR destination_account_id=$1 ORDER BY occurred_at DESC,id LIMIT 50',[id]);
    return Response.json({account:account.rows[0],transactions:transactions.rows});
  }catch(error){return workflowFailure(error);}
}
