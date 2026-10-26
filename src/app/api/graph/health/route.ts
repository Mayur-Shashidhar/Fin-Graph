import { checkGraphHealth } from '@/lib/neo4j';
import { connection } from 'next/server';

export async function GET() {
  await connection();
  const neo4j = await checkGraphHealth();
  return Response.json({ status: neo4j.connected ? 'healthy' : 'degraded', neo4j }, { status: neo4j.connected ? 200 : 503 });
}
