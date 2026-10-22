import { NextResponse } from 'next/server';
import { checkDatabaseHealth } from '@/lib/db';
import { HealthCheckResponse } from '@/types';

/**
 * Health check endpoint for FinGraph services.
 * Probes PostgreSQL connection without leaking credentials, connection strings, or system paths.
 */
export async function GET(): Promise<NextResponse<HealthCheckResponse>> {
  const timestamp = new Date().toISOString();

  try {
    const dbHealth = await checkDatabaseHealth();

    if (dbHealth.connected) {
      return NextResponse.json(
        {
          status: 'healthy',
          timestamp,
          service: 'fingraph-api',
          version: '0.1.0',
          database: {
            connected: true,
            responseTimeMs: dbHealth.responseTimeMs,
          },
        },
        { status: 200 }
      );
    }

    // Database is unreachable or disconnected
    return NextResponse.json(
      {
        status: 'degraded',
        timestamp,
        service: 'fingraph-api',
        version: '0.1.0',
        database: {
          connected: false,
          responseTimeMs: dbHealth.responseTimeMs,
          error: dbHealth.error || 'Database service unavailable',
        },
      },
      { status: 503 }
    );
  } catch {
    // Catch-all safety: Never leak unhandled internal exceptions to clients
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp,
        service: 'fingraph-api',
        version: '0.1.0',
        database: {
          connected: false,
          error: 'An internal error occurred during health inspection',
        },
      },
      { status: 503 }
    );
  }
}
