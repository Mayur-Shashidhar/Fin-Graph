'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  RotateCw,
  ArrowRight,
  Database,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Ban,
  AlertCircle,
  TrendingUp,
  Building2,
  Users,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button, TransactionStatusBadge } from '@/components/ui';
import { ActivityChart } from '@/components/dashboard/ActivityChart';
import { DashboardResponse } from '@/types';
import { formatINR, formatCompactINR, formatDateTime } from '@/lib/formatters';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    }
    setError(null);

    try {
      const res = await fetch('/api/dashboard/stats');
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}: Failed to retrieve database statistics`);
      }
      const json: DashboardResponse = await res.json();
      setData(json);
    } catch (err: unknown) {
      console.error('[Dashboard fetch error]:', err);
      setError(err instanceof Error ? err.message : 'Database query execution failed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    fetch('/api/dashboard/stats')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP Error ${res.status}: Failed to retrieve database statistics`);
        return res.json();
      })
      .then((json: DashboardResponse) => {
        if (!ignore) {
          setData(json);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Database query execution failed');
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-28 rounded-xl bg-neutral-900 border border-neutral-800" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-neutral-900 border border-neutral-800" />
          ))}
        </div>
        <div className="h-80 rounded-xl bg-neutral-900 border border-neutral-800" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-8 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-300">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-white">Database Query Failure</h3>
          <p className="text-xs text-neutral-400 max-w-md mx-auto">{error || 'Unable to connect to PostgreSQL.'}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadData()}>
          Retry Database Connection
        </Button>
      </div>
    );
  }

  const { summary, recentTransactions, activityTimeline } = data;

  return (
    <div className="space-y-8">
      {/* Top Banner / Surveillance Status Bar */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px] text-neutral-300 border-neutral-700">
              PostgreSQL Monitored
            </Badge>
            <span className="text-xs text-neutral-500 font-mono">Sprint 2 Surveillance Engine</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            Surveillance &amp; AML Intelligence Overview
          </h2>
          <p className="text-xs text-neutral-400">
            Real-time aggregate telemetry derived strictly from the PostgreSQL database layer.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="gap-2 font-mono text-xs"
          >
            <RotateCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Querying...' : 'Refresh'}
          </Button>
          <Link href="/transactions">
            <Button variant="default" size="sm" className="gap-2 text-xs">
              View Transactions
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Primary 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Monitored Volume */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider font-mono">
                Total Monitored Volume
              </span>
              <span className="p-1.5 rounded border border-neutral-800 bg-neutral-900 text-neutral-300">
                <Database className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold font-mono tracking-tight text-white">
                {formatCompactINR(summary.totalVolumeInr)}
              </div>
              <p className="text-[11px] font-mono text-neutral-400 mt-1">
                {formatINR(summary.totalVolumeInr)}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-neutral-850 flex items-center justify-between text-[11px] text-neutral-400 font-mono">
              <span>Total Transactions:</span>
              <span className="text-white font-semibold">{summary.totalTransactions}</span>
            </div>
          </CardContent>
        </Card>

        {/* Flagged Transactions */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider font-mono">
                Flagged for AML
              </span>
              <span className="p-1.5 rounded border border-neutral-700 bg-neutral-900 text-white font-semibold">
                <AlertTriangle className="h-4 w-4 text-white" />
              </span>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono tracking-tight text-white">
                  {summary.flaggedCount}
                </span>
                <span className="text-xs text-neutral-400 font-mono">
                  ({((summary.flaggedCount / (summary.totalTransactions || 1)) * 100).toFixed(1)}%)
                </span>
              </div>
              <p className="text-[11px] font-mono text-neutral-400 mt-1">
                Value: {formatINR(summary.flaggedVolumeInr)}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-neutral-850 flex items-center justify-between text-[11px] text-neutral-400 font-mono">
              <span>Alert Queue:</span>
              <span className="text-white font-semibold">{summary.openAlerts} Open / {summary.totalAlerts} Total</span>
            </div>
          </CardContent>
        </Card>

        {/* Completed Transactions */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider font-mono">
                Settled / Completed
              </span>
              <span className="p-1.5 rounded border border-neutral-800 bg-neutral-900 text-neutral-300">
                <CheckCircle2 className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono tracking-tight text-white">
                  {summary.completedCount}
                </span>
                <span className="text-xs text-neutral-400 font-mono">
                  ({((summary.completedCount / (summary.totalTransactions || 1)) * 100).toFixed(1)}%)
                </span>
              </div>
              <p className="text-[11px] font-mono text-neutral-400 mt-1">
                Value: {formatINR(summary.completedVolumeInr)}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-neutral-850 flex items-center justify-between text-[11px] text-neutral-400 font-mono">
              <span>Settlement Rate:</span>
              <span className="text-white font-semibold">
                {((summary.completedCount / (summary.totalTransactions || 1)) * 100).toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Exceptions & Holds */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider font-mono">
                Pending &amp; Rejected
              </span>
              <span className="p-1.5 rounded border border-neutral-800 bg-neutral-900 text-neutral-300">
                <Clock className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono tracking-tight text-white">
                  {summary.pendingCount + summary.rejectedCount + summary.cancelledCount + summary.failedCount}
                </span>
                <span className="text-xs text-neutral-400 font-mono">Exceptions</span>
              </div>
              <p className="text-[11px] font-mono text-neutral-400 mt-1">
                Hold Value: {formatINR(summary.pendingVolumeInr)}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-neutral-850 flex items-center justify-between text-[11px] text-neutral-400 font-mono">
              <span>Non-Completed:</span>
              <span className="text-white font-semibold">
                {summary.pendingCount} P / {summary.rejectedCount} R / {summary.cancelledCount} C / {summary.failedCount} F
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Detailed Breakdown Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Status Distribution Summary Card */}
        <Card>
          <CardHeader className="py-4 px-5">
            <CardTitle className="text-sm">Transaction Status Matrix</CardTitle>
            <CardDescription>Exact breakdown across all 500 ledger records</CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-2.5 text-xs font-mono">
            <div className="flex items-center justify-between py-1 border-b border-neutral-850">
              <span className="flex items-center gap-2 text-neutral-300">
                <CheckCircle2 className="h-3.5 w-3.5 text-neutral-400" />
                Completed
              </span>
              <div className="text-right">
                <span className="font-bold text-white">{summary.completedCount}</span>
                <span className="text-neutral-500 text-[10px] ml-1.5">({formatCompactINR(summary.completedVolumeInr)})</span>
              </div>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-neutral-850">
              <span className="flex items-center gap-2 text-white font-semibold">
                <AlertTriangle className="h-3.5 w-3.5 text-white" />
                Flagged (AML)
              </span>
              <div className="text-right">
                <span className="font-bold text-white">{summary.flaggedCount}</span>
                <span className="text-neutral-400 text-[10px] ml-1.5">({formatCompactINR(summary.flaggedVolumeInr)})</span>
              </div>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-neutral-850">
              <span className="flex items-center gap-2 text-neutral-400">
                <Clock className="h-3.5 w-3.5 text-neutral-500" />
                Pending Verification
              </span>
              <div className="text-right">
                <span className="font-bold text-white">{summary.pendingCount}</span>
                <span className="text-neutral-500 text-[10px] ml-1.5">({formatCompactINR(summary.pendingVolumeInr)})</span>
              </div>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-neutral-850">
              <span className="flex items-center gap-2 text-neutral-400">
                <XCircle className="h-3.5 w-3.5 text-neutral-500" />
                Rejected
              </span>
              <div className="text-right">
                <span className="font-bold text-white">{summary.rejectedCount}</span>
                <span className="text-neutral-500 text-[10px] ml-1.5">({formatCompactINR(summary.rejectedVolumeInr)})</span>
              </div>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-neutral-850">
              <span className="flex items-center gap-2 text-neutral-400">
                <Ban className="h-3.5 w-3.5 text-neutral-500" />
                Cancelled / Aborted
              </span>
              <div className="text-right">
                <span className="font-bold text-white">{summary.cancelledCount}</span>
                <span className="text-neutral-500 text-[10px] ml-1.5">({formatCompactINR(summary.cancelledVolumeInr)})</span>
              </div>
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="flex items-center gap-2 text-neutral-400">
                <AlertCircle className="h-3.5 w-3.5 text-neutral-500" />
                Failed Execution
              </span>
              <div className="text-right">
                <span className="font-bold text-white">{summary.failedCount}</span>
                <span className="text-neutral-500 text-[10px] ml-1.5">({formatCompactINR(summary.failedVolumeInr)})</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alert Triage Telemetry Card */}
        <Card>
          <CardHeader className="py-4 px-5">
            <CardTitle className="text-sm">Alert Triage Queue</CardTitle>
            <CardDescription>Investigation state of seeded AML alerts</CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-2.5 text-xs font-mono">
            <div className="flex items-center justify-between py-1 border-b border-neutral-850">
              <span className="text-neutral-400">Total Seeded Alerts:</span>
              <span className="font-bold text-white">{summary.totalAlerts}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-neutral-850">
              <span className="text-neutral-300">Open / Actionable:</span>
              <span className="font-bold text-white">{summary.openAlerts}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-neutral-850">
              <span className="text-white font-semibold">Critical Severity:</span>
              <span className="font-bold text-white bg-neutral-900 px-2 py-0.5 rounded border border-neutral-700">
                {summary.criticalAlerts}
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-neutral-850">
              <span className="text-neutral-400">Resolved / Closed:</span>
              <span className="font-medium text-neutral-400">{summary.totalAlerts - summary.openAlerts}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-neutral-400">Active Rules:</span>
              <span className="font-medium text-neutral-300">{summary.activeRules} Enabled</span>
            </div>
          </CardContent>
        </Card>

        {/* Monitored Graph Entities Card */}
        <Card>
          <CardHeader className="py-4 px-5">
            <CardTitle className="text-sm">Graph Entity Topology</CardTitle>
            <CardDescription>Relational nodes backing AML detection</CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-2.5 text-xs font-mono">
            <div className="flex items-center justify-between py-1 border-b border-neutral-850">
              <span className="flex items-center gap-2 text-neutral-300">
                <Users className="h-3.5 w-3.5 text-neutral-400" />
                Customer Entities
              </span>
              <span className="font-bold text-white">{summary.totalCustomers}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-neutral-850">
              <span className="flex items-center gap-2 text-neutral-300">
                <Building2 className="h-3.5 w-3.5 text-neutral-400" />
                Accounts Monitored
              </span>
              <span className="font-bold text-white">{summary.totalAccounts}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-neutral-850">
              <span className="flex items-center gap-2 text-neutral-400">
                <Layers className="h-3.5 w-3.5 text-neutral-500" />
                Ledger Transactions
              </span>
              <span className="font-bold text-white">{summary.totalTransactions}</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-neutral-850">
              <span className="text-neutral-400">Currency Standard:</span>
              <span className="font-medium text-neutral-300">INR (₹)</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-neutral-400">Storage Engine:</span>
              <span className="font-medium text-neutral-300">PostgreSQL 14+</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Timeline Bar Chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-white" />
              Chronological Transaction Activity
            </CardTitle>
            <Badge variant="outline" className="text-[10px] text-neutral-400">
              PostgreSQL DATE_TRUNC
            </Badge>
          </div>
          <CardDescription>
            Daily transaction volume and frequency aggregation derived from real timestamps
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActivityChart data={activityTimeline} />
        </CardContent>
      </Card>

      {/* Recent Transactions Stream Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Recent Ledger Activity</CardTitle>
              <CardDescription>Latest transactions recorded in the PostgreSQL database</CardDescription>
            </div>
            <Link href="/transactions">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs font-mono">
                Explore Full Table
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-neutral-800 bg-neutral-900/60 text-neutral-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-4">Occurred At</th>
                  <th className="py-2.5 px-4">Source Account</th>
                  <th className="py-2.5 px-4">Destination Account</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4 text-right">Amount (INR)</th>
                  <th className="py-2.5 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-850">
                {recentTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-neutral-900/40 transition-colors">
                    <td className="py-3 px-4 text-neutral-400 whitespace-nowrap">
                      {formatDateTime(tx.occurred_at)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-medium text-white">{tx.source_account_number}</div>
                      <div className="text-[10px] text-neutral-400 truncate max-w-[180px]">
                        {tx.source_customer_name}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-medium text-white">{tx.destination_account_number}</div>
                      <div className="text-[10px] text-neutral-400 truncate max-w-[180px]">
                        {tx.destination_customer_name}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-neutral-300 whitespace-nowrap">
                      <span className="rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] border border-neutral-800">
                        {tx.transaction_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-white whitespace-nowrap">
                      {formatINR(tx.amount)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <TransactionStatusBadge status={tx.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
