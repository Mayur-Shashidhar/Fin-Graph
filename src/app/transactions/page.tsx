'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
} from '@tanstack/react-table';
import {
  ArrowLeft,
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCw,
  X,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { Card, CardContent, Badge, Button, TransactionStatusBadge, TransactionIdCell } from '@/components/ui';
import { TransactionRecord, PaginatedTransactionsResponse } from '@/types';
import { NewTransfer } from '@/components/transactions/NewTransfer';
import { formatMoney, formatDateTime } from '@/lib/formatters';

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FLAGGED', label: 'Flagged (AML)' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'FAILED', label: 'Failed' },
];

const TYPE_OPTIONS = [
  { value: 'ALL', label: 'All Types' },
  { value: 'RTGS', label: 'RTGS' },
  { value: 'NEFT', label: 'NEFT' },
  { value: 'IMPS', label: 'IMPS' },
  { value: 'UPI', label: 'UPI' },
  { value: 'WIRE_TRANSFER', label: 'Wire Transfer' },
];

export default function TransactionsPage() {
  // Query state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState<'occurred_at' | 'amount' | 'status' | 'transaction_type'>('occurred_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Filter drawer toggle on smaller screens
  const [showFilters, setShowFilters] = useState(false);

  // Data state
  const [response, setResponse] = useState<PaginatedTransactionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce search term by 350ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset to page 1 on search change
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch paginated transactions from server API
  useEffect(() => {
    let ignore = false;
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (statusFilter !== 'ALL') params.set('status', statusFilter);
    if (typeFilter !== 'ALL') params.set('type', typeFilter);
    if (minAmount) params.set('minAmount', minAmount);
    if (maxAmount) params.set('maxAmount', maxAmount);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    params.set('sortBy', sortBy);
    params.set('sortOrder', sortOrder);

    fetch(`/api/transactions?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || `HTTP ${res.status}: Failed to load transactions`);
        }
        return res.json();
      })
      .then((data: PaginatedTransactionsResponse) => {
        if (!ignore) {
          setResponse(data);
          setLoading(false);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Database query error');
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [
    page,
    pageSize,
    debouncedSearch,
    statusFilter,
    typeFilter,
    minAmount,
    maxAmount,
    startDate,
    endDate,
    sortBy,
    sortOrder,
    refreshTrigger,
  ]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setStatusFilter('ALL');
    setTypeFilter('ALL');
    setMinAmount('');
    setMaxAmount('');
    setStartDate('');
    setEndDate('');
    setSortBy('occurred_at');
    setSortOrder('desc');
    setPage(1);
  };

  const handleManualRefresh = () => {
    setLoading(true);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleSortToggle = useCallback(
    (column: 'occurred_at' | 'amount' | 'status' | 'transaction_type') => {
      if (sortBy === column) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortBy(column);
        setSortOrder('desc');
      }
      setPage(1);
    },
    [sortBy]
  );

  // Define TanStack Table columns
  const columns = useMemo<ColumnDef<TransactionRecord>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'Transaction ID',
        cell: ({ row }) => <TransactionIdCell id={row.original.id} />,
      },
      {
        accessorKey: 'amount',
        header: () => (
          <button
            onClick={() => handleSortToggle('amount')}
            className="flex items-center gap-1.5 hover:text-white transition-colors ml-auto"
          >
            <span>Amount</span>
            {sortBy === 'amount' ? (
              sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-white" /> : <ArrowDown className="h-3 w-3 text-white" />
            ) : (
              <ArrowUpDown className="h-3 w-3 text-neutral-500" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <div className="text-right font-mono font-bold text-white whitespace-nowrap">
            {formatMoney(row.original.amount, row.original.currency)}
          </div>
        ),
      },
      {
        accessorKey: 'occurred_at',
        header: () => (
          <button
            onClick={() => handleSortToggle('occurred_at')}
            className="flex items-center gap-1.5 hover:text-white transition-colors"
          >
            <span>Occurred At</span>
            {sortBy === 'occurred_at' ? (
              sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-white" /> : <ArrowDown className="h-3 w-3 text-white" />
            ) : (
              <ArrowUpDown className="h-3 w-3 text-neutral-500" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <div className="font-mono text-neutral-300 whitespace-nowrap">
            {formatDateTime(row.original.occurred_at)}
          </div>
        ),
      },
      {
        accessorKey: 'source_account_number',
        header: 'Source Account',
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <div className="font-mono font-medium text-white">{row.original.source_account_number}</div>
            <div className="text-[10px] text-neutral-400 truncate max-w-[150px]">
              {row.original.source_customer_name}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'destination_account_number',
        header: 'Destination Account',
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <div className="font-mono font-medium text-white">{row.original.destination_account_number}</div>
            <div className="text-[10px] text-neutral-400 truncate max-w-[150px]">
              {row.original.destination_customer_name}
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'transaction_type',
        header: () => (
          <button
            onClick={() => handleSortToggle('transaction_type')}
            className="flex items-center gap-1.5 hover:text-white transition-colors"
          >
            <span>Type</span>
            {sortBy === 'transaction_type' ? (
              sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-white" /> : <ArrowDown className="h-3 w-3 text-white" />
            ) : (
              <ArrowUpDown className="h-3 w-3 text-neutral-500" />
            )}
          </button>
        ),
        cell: ({ row }) => (
          <span className="rounded bg-neutral-900 px-2 py-0.5 text-[10px] font-mono border border-neutral-800 text-neutral-300">
            {row.original.transaction_type}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: () => (
          <div className="text-right">
            <button
              onClick={() => handleSortToggle('status')}
              className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <span>Status</span>
              {sortBy === 'status' ? (
                sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-white" /> : <ArrowDown className="h-3 w-3 text-white" />
              ) : (
                <ArrowUpDown className="h-3 w-3 text-neutral-500" />
              )}
            </button>
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-right">
            <TransactionStatusBadge status={row.original.status} />
          </div>
        ),
      },
    ],
    [handleSortToggle, sortBy, sortOrder]
  );

  const tableData = useMemo(() => response?.data || [], [response]);

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: response?.pagination.totalPages || 1,
  });

  const totalCount = response?.pagination.totalCount || 0;
  const totalPages = response?.pagination.totalPages || 1;
  const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px] text-neutral-400">
              PostgreSQL Data Table
            </Badge>
            <span className="text-xs font-mono text-neutral-500">Transaction ledger</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            Transaction Surveillance Ledger
          </h2>
          <p className="text-xs text-neutral-400">
            Search, filter, and inspect verified financial transactions across monitored accounts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <NewTransfer onCreated={handleManualRefresh}/>
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={loading}
            className="gap-2 font-mono text-xs"
          >
            <RotateCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Link href="/">
            <Button variant="outline" size="sm" className="gap-2 text-xs">
              <ArrowLeft className="h-3.5 w-3.5" />
              Dashboard
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-neutral-800 bg-neutral-950 p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by ID, account number, customer name, description..."
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900/80 py-2 pl-9 pr-8 text-xs text-white placeholder-neutral-500 focus:border-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-400 font-mono"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Quick Select Status */}
          <div className="w-full md:w-44">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900/80 py-2 px-3 text-xs text-neutral-200 focus:border-neutral-600 focus:outline-none font-mono"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-neutral-950 text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Select Type */}
          <div className="w-full md:w-44">
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900/80 py-2 px-3 text-xs text-neutral-200 focus:border-neutral-600 focus:outline-none font-mono"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-neutral-950 text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Advanced Filters Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={`gap-1.5 text-xs font-mono ${showFilters ? 'bg-neutral-850 border-neutral-600' : ''}`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters {(minAmount || maxAmount || startDate || endDate) && '•'}
          </Button>

          {/* Reset Filters Button */}
          {(searchTerm || statusFilter !== 'ALL' || typeFilter !== 'ALL' || minAmount || maxAmount || startDate || endDate) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="text-xs text-neutral-400 hover:text-white font-mono"
            >
              Reset
            </Button>
          )}
        </div>

        {/* Collapsible Advanced Filters (Amount & Date Range) */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-neutral-850 text-xs font-mono">
            <div>
              <label className="block text-neutral-400 mb-1 text-[11px]">Min Amount (transaction currency)</label>
              <input
                type="number"
                min="0"
                value={minAmount}
                onChange={(e) => {
                  setMinAmount(e.target.value);
                  setPage(1);
                }}
                placeholder="e.g. 500000"
                className="w-full rounded border border-neutral-800 bg-neutral-900 py-1.5 px-2.5 text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
              />
            </div>

            <div>
              <label className="block text-neutral-400 mb-1 text-[11px]">Max Amount (transaction currency)</label>
              <input
                type="number"
                min="0"
                value={maxAmount}
                onChange={(e) => {
                  setMaxAmount(e.target.value);
                  setPage(1);
                }}
                placeholder="e.g. 10000000"
                className="w-full rounded border border-neutral-800 bg-neutral-900 py-1.5 px-2.5 text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-600"
              />
            </div>

            <div>
              <label className="block text-neutral-400 mb-1 text-[11px]">Start Date (UTC)</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded border border-neutral-800 bg-neutral-900 py-1.5 px-2.5 text-white focus:outline-none focus:border-neutral-600"
              />
            </div>

            <div>
              <label className="block text-neutral-400 mb-1 text-[11px]">End Date (UTC, inclusive)</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded border border-neutral-800 bg-neutral-900 py-1.5 px-2.5 text-white focus:outline-none focus:border-neutral-600"
              />
            </div>
          </div>
        )}
      </Card>

      {/* Main Table Card */}
      <Card className="border-neutral-800 bg-neutral-950">
        <CardContent className="p-0!">
          {error ? (
            <div className="py-16 text-center space-y-3">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-300">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-white">Database Query Error</h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">{error}</p>
              <Button variant="outline" size="sm" onClick={handleManualRefresh}>
                Retry Query
              </Button>
            </div>
          ) : loading ? (
            <div className="p-8 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-center gap-2 text-neutral-400 py-12">
                <RotateCw className="h-4 w-4 animate-spin text-neutral-400" />
                Querying PostgreSQL records...
              </div>
            </div>
          ) : tableData.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400">
                <FileText className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-white">No Matching Transactions</h3>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto font-mono">
                No database records match your filter criteria. Try adjusting your search query or clearing active filters.
              </p>
              <Button variant="outline" size="sm" onClick={handleResetFilters} className="font-mono text-xs">
                Clear All Filters
              </Button>
            </div>
          ) : (
            <div>
              <p id="transaction-scroll-help" className="border-b border-neutral-800 px-4 py-2 text-xs text-neutral-400">
                Scroll horizontally to view all transaction columns.
              </p>
              <div
                className="overflow-x-auto rounded-b-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
                role="region"
                aria-label="Transaction ledger"
                aria-describedby="transaction-scroll-help"
                tabIndex={0}
              >
              <table className="w-full text-left text-xs font-mono">
                <thead className="border-b border-neutral-800 bg-neutral-900/60 text-neutral-400 uppercase tracking-wider text-[10px]">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th key={header.id} className="py-3 px-4 select-none">
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-neutral-850">
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="hover:bg-neutral-900/40 transition-colors">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="py-3 px-4">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </CardContent>

        {/* Server Pagination Bar */}
        {!loading && !error && tableData.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-neutral-800 text-xs font-mono">
            <div className="flex items-center gap-3 text-neutral-400">
              <span>
                Showing <strong className="text-white">{startItem}</strong> to <strong className="text-white">{endItem}</strong> of{' '}
                <strong className="text-white">{totalCount}</strong> transactions
              </span>
              <span className="text-neutral-700">|</span>
              <div className="flex items-center gap-1.5">
                <span>Page size:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded border border-neutral-800 bg-neutral-900 py-1 px-2 text-white focus:outline-none"
                >
                  {[10, 20, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-neutral-400 mr-2">
                Page <strong className="text-white">{page}</strong> of <strong className="text-white">{totalPages}</strong>
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(1)}
                disabled={page <= 1}
                className="px-2"
                aria-label="First page"
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-2"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-2"
                aria-label="Next page"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages}
                className="px-2"
                aria-label="Last page"
              >
                <ChevronsRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
