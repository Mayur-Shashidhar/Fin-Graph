import { NextResponse } from 'next/server';
import { getDashboardSummaryMetrics, getActivityTimeline } from '@/lib/queries/stats';
import { getRecentTransactions } from '@/lib/queries/transactions';
import { DashboardResponse } from '@/types';

/**
 * GET /api/dashboard/stats
 * Returns aggregated surveillance metrics, recent transaction stream, and activity timeline.
 * Never leaks database connection credentials or raw database stack traces.
 */
export async function GET(): Promise<NextResponse<DashboardResponse | { error: string }>> {
  try {
    const [summary, recentTransactions, activityTimeline] = await Promise.all([
      getDashboardSummaryMetrics(),
      getRecentTransactions(10),
      getActivityTimeline(),
    ]);

    return NextResponse.json({
      summary,
      recentTransactions,
      activityTimeline,
    });
  } catch (err: unknown) {
    console.error('[Dashboard Stats API Error]:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Failed to retrieve dashboard statistics from database' },
      { status: 500 }
    );
  }
}
