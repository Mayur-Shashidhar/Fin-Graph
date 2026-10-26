import { z } from 'zod';

const neo4jSchema = z.object({
  NEO4J_URI: z.string().regex(/^(neo4j|bolt)(\+s|\+ssc)?:\/\//),
  NEO4J_USERNAME: z.string().min(1),
  NEO4J_PASSWORD: z.string().min(1),
  NEO4J_DATABASE: z.string().min(1).default('neo4j'),
});

export function getNeo4jConfig() {
  const parsed = neo4jSchema.safeParse(process.env);
  if (!parsed.success) {
    // Only field names, never credential values, belong in configuration errors.
    throw new Error(`Neo4j configuration missing or invalid: ${parsed.error.issues.map(i => i.path[0]).join(', ')}`);
  }
  return parsed.data;
}

export const ELIGIBLE_STATUSES = ['COMPLETED', 'FLAGGED'];
export const MAX_GRAPH_EDGES = 10000;
export const MAX_GRAPH_NODES = 5000;
export const MAX_PATH_HOPS = 6;
export const QUERY_TIMEOUT_MS = 15000;
