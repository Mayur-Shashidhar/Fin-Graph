import { authorizeRequest } from '@/lib/auth';
import { databaseId } from '@/lib/validation';
import { query } from '@/lib/db';
import { WorkflowError, workflowFailure } from '@/lib/workflows';
import type { TransactionRecord, Alert } from '@/types';
export async function GET(request:Request,context:{params:Promise<{id:string}>}){
  const denied=authorizeRequest(request);if(denied)return denied;
  try{
    const id=databaseId.parse((await context.params).id);
    const result=await query<TransactionRecord>(`SELECT t.*, sa.account_number AS source_account_number, sc.full_name AS source_customer_name, da.account_number AS destination_account_number, dc.full_name AS destination_customer_name FROM transactions t JOIN accounts sa ON sa.id=t.source_account_id JOIN customers sc ON sc.id=sa.customer_id JOIN accounts da ON da.id=t.destination_account_id JOIN customers dc ON dc.id=da.customer_id WHERE t.id=$1`,[id]);
    if(!result.rows[0])throw new WorkflowError('Transaction not found.',404);
    const alerts=await query<Alert>(`SELECT * FROM alerts WHERE transaction_id=$1::uuid OR (evidence->'transactionIds') ? $1::text ORDER BY risk_score DESC`,[id]);
    return Response.json({transaction:result.rows[0],alerts:alerts.rows});
  }catch(error){return workflowFailure(error);}
}
