'use client';

import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { ActivityTimelinePoint } from '@/types';
import { formatCompactINR, formatINR } from '@/lib/formatters';

interface ActivityChartProps {
  data: ActivityTimelinePoint[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: ActivityTimelinePoint;
    value: number;
    dataKey: string;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    const point = payload[0].payload;
    return (
      <div className="rounded-lg border border-neutral-700 bg-neutral-950 p-3 shadow-xl text-xs space-y-1.5 font-mono">
        <p className="font-semibold text-white border-b border-neutral-800 pb-1">{label}</p>
        <div className="flex items-center justify-between gap-4 text-neutral-300">
          <span>Total Transactions:</span>
          <span className="font-bold text-white">{point.transactionCount}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-neutral-400">
          <span>Flagged Scenarios:</span>
          <span className="font-semibold text-neutral-200">{point.flaggedCount}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-neutral-400">
          <span>Completed:</span>
          <span className="font-semibold text-neutral-200">{point.completedCount}</span>
        </div>
        <div className="flex items-center justify-between gap-4 text-neutral-300 pt-1 border-t border-neutral-800">
          <span>Volume:</span>
          <span className="font-bold text-white">{formatINR(point.volumeInr)}</span>
        </div>
      </div>
    );
  }
  return null;
}

export function ActivityChart({ data }: ActivityChartProps) {
  const [metric, setMetric] = useState<'count' | 'volume'>('count');

  if (!data || data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-neutral-800 text-xs text-neutral-400 font-mono">
        No transaction activity recorded in the queried time window.
      </div>
    );
  }

  // Format chart data safely without floating point distortion
  const chartData = data.map((d) => ({
    ...d,
    displayDate: d.date.slice(5), // '03-01' from '2026-03-01'
    numericVolume: parseFloat(d.volumeInr) || 0,
  }));

  return (
    <div className="space-y-4">
      {/* Chart metric toggle - strictly monochrome */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-neutral-400 font-mono">
          Span: {data[0]?.date} to {data[data.length - 1]?.date} ({data.length} active observation days)
        </div>
        <div className="flex items-center rounded-lg border border-neutral-800 bg-neutral-900/60 p-0.5 text-xs font-mono">
          <button
            onClick={() => setMetric('count')}
            className={`rounded px-2.5 py-1 text-xs transition-colors ${
              metric === 'count'
                ? 'bg-white text-black font-semibold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Count
          </button>
          <button
            onClick={() => setMetric('volume')}
            className={`rounded px-2.5 py-1 text-xs transition-colors ${
              metric === 'volume'
                ? 'bg-white text-black font-semibold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Volume (INR)
          </button>
        </div>
      </div>

      {/* Monochrome Bar Chart Container */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="#262626" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="displayDate"
              stroke="#737373"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: '#404040' }}
            />
            <YAxis
              stroke="#737373"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: '#404040' }}
              tickFormatter={(v) => (metric === 'volume' ? formatCompactINR(v) : String(v))}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#171717' }} />
            {metric === 'count' ? (
              <Bar dataKey="transactionCount" fill="#ffffff" radius={[2, 2, 0, 0]} maxBarSize={28} />
            ) : (
              <Bar dataKey="numericVolume" fill="#a3a3a3" radius={[2, 2, 0, 0]} maxBarSize={28} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono border-t border-neutral-800 pt-2">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-white" />
          {metric === 'count' ? 'Transaction Frequency' : 'Aggregate Volume (INR)'}
        </span>
        <span>Daily resolution via PostgreSQL DATE_TRUNC</span>
      </div>
    </div>
  );
}
