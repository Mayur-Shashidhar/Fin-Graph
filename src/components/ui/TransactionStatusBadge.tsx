import React from 'react';
import {
  CheckCircle,
  AlertTriangle,
  Clock,
  XCircle,
  Ban,
  AlertCircle,
} from 'lucide-react';
import { TransactionStatus } from '@/types';

interface TransactionStatusBadgeProps {
  status: TransactionStatus | string;
  className?: string;
}

/**
 * Strictly monochrome status badge for financial transactions.
 * Uses grayscale text, borders, icons, and contrast without any colored accents.
 */
export function TransactionStatusBadge({
  status,
  className = '',
}: TransactionStatusBadgeProps) {
  const normStatus = (status || '').toUpperCase();

  switch (normStatus) {
    case 'COMPLETED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium tracking-wide border border-neutral-700 bg-neutral-900 text-neutral-200 ${className}`}
        >
          <CheckCircle className="h-3 w-3 text-neutral-300" />
          COMPLETED
        </span>
      );

    case 'FLAGGED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-semibold tracking-wide border border-white bg-white text-black ${className}`}
        >
          <AlertTriangle className="h-3 w-3 text-black" />
          FLAGGED
        </span>
      );

    case 'PENDING':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium tracking-wide border border-dashed border-neutral-600 bg-neutral-950 text-neutral-400 ${className}`}
        >
          <Clock className="h-3 w-3 text-neutral-400" />
          PENDING
        </span>
      );

    case 'REJECTED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium tracking-wide border border-neutral-800 bg-neutral-950 text-neutral-400 ${className}`}
        >
          <XCircle className="h-3 w-3 text-neutral-400" />
          REJECTED
        </span>
      );

    case 'CANCELLED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium tracking-wide border border-neutral-800 bg-neutral-950 text-neutral-400 ${className}`}
        >
          <Ban className="h-3 w-3 text-neutral-400" />
          CANCELLED
        </span>
      );

    case 'FAILED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium tracking-wide border border-neutral-700 bg-neutral-900 text-neutral-300 ${className}`}
        >
          <AlertCircle className="h-3 w-3 text-neutral-400" />
          FAILED
        </span>
      );

    default:
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border border-neutral-800 bg-neutral-900 text-neutral-300 ${className}`}
        >
          {status}
        </span>
      );
  }
}
