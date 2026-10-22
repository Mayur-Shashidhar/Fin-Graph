import 'server-only';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { getValidatedEnv } from '@/lib/env';

/**
 * Reusable PostgreSQL connection pool for FinGraph.
 * Configured as a singleton across Next.js server invocations.
 */

declare global {
  var __finGraphPgPool: Pool | undefined;
}

function initPool(): Pool {
  const env = getValidatedEnv();

  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err) => {
    // Log unexpected errors on idle pool clients without leaking credentials
    console.error('[FinGraph DB Pool Error]:', err.name, err.message);
  });

  return pool;
}

/**
 * Retrieves the active singleton PostgreSQL connection pool.
 */
export function getDbPool(): Pool {
  if (process.env.NODE_ENV === 'production') {
    if (!globalThis.__finGraphPgPool) {
      globalThis.__finGraphPgPool = initPool();
    }
    return globalThis.__finGraphPgPool;
  }

  // Preserve pool during HMR in development
  if (!globalThis.__finGraphPgPool) {
    globalThis.__finGraphPgPool = initPool();
  }
  return globalThis.__finGraphPgPool;
}

/**
 * Executes a parameterized SQL query against the connection pool.
 * Parameterized queries prevent SQL injection vulnerabilities.
 *
 * @param text Parameterized SQL query string (e.g., 'SELECT * FROM accounts WHERE id = $1')
 * @param params Array of parameter values for placeholder tokens
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const pool = getDbPool();
  return pool.query<T>(text, params);
}

/**
 * Acquires a dedicated client from the pool for multi-query transactions.
 * Remember to release the client back to the pool in a finally block!
 */
export async function getClient(): Promise<PoolClient> {
  const pool = getDbPool();
  return pool.connect();
}

export interface DbHealthResult {
  connected: boolean;
  responseTimeMs?: number;
  error?: string;
}

/**
 * Probes PostgreSQL connection with a lightweight ping query.
 * Sanitizes all output to ensure internal connection strings or credentials are never exposed.
 */
export async function checkDatabaseHealth(): Promise<DbHealthResult> {
  const startTime = Date.now();
  try {
    const res = await query<{ ping: number }>('SELECT 1 AS ping;');
    const responseTimeMs = Date.now() - startTime;

    if (res.rows && res.rows[0]?.ping === 1) {
      return {
        connected: true,
        responseTimeMs,
      };
    }

    return {
      connected: false,
      responseTimeMs,
      error: 'Unexpected response from database verification query',
    };
  } catch (error: unknown) {
    const responseTimeMs = Date.now() - startTime;
    // Log detailed error on server console only
    console.error('[FinGraph Health Check Error]:', error instanceof Error ? error.message : error);

    // Return sanitized status without credentials, URLs, or low-level stack traces
    return {
      connected: false,
      responseTimeMs,
      error: 'PostgreSQL connection failed or database unreachable',
    };
  }
}
