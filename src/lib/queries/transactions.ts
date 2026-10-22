import 'server-only';
import { query } from '@/lib/db';
import { TransactionRecord, PaginatedTransactionsResponse } from '@/types';

export interface TransactionFilterOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  transactionType?: string;
  minAmount?: number;
  maxAmount?: number;
  startDate?: string;
  endDate?: string;
  sortBy?: 'occurred_at' | 'amount' | 'status' | 'transaction_type';
  sortOrder?: 'asc' | 'desc';
}

const ALLOWED_SORT_COLUMNS: Record<string, string> = {
  occurred_at: 't.occurred_at',
  amount: 't.amount',
  status: 't.status',
  transaction_type: 't.transaction_type',
};

/**
 * Fetches recent transactions with associated account numbers and customer names.
 * Parameterized to prevent SQL injection.
 */
export async function getRecentTransactions(limit = 10): Promise<TransactionRecord[]> {
  const safeLimit = Math.max(1, Math.min(limit, 50));

  const result = await query<TransactionRecord>(
    `
    SELECT
      t.id,
      t.source_account_id,
      t.destination_account_id,
      t.amount,
      t.currency,
      t.transaction_type,
      t.status,
      t.description,
      t.occurred_at,
      t.created_at,
      src.account_number AS source_account_number,
      c_src.full_name AS source_customer_name,
      dst.account_number AS destination_account_number,
      c_dst.full_name AS destination_customer_name
    FROM transactions t
    JOIN accounts src ON t.source_account_id = src.id
    JOIN customers c_src ON src.customer_id = c_src.id
    JOIN accounts dst ON t.destination_account_id = dst.id
    JOIN customers c_dst ON dst.customer_id = c_dst.id
    ORDER BY t.occurred_at DESC, t.id ASC
    LIMIT $1;
    `,
    [safeLimit]
  );

  return result.rows;
}

/**
 * Executes a server-side paginated, filtered, and sorted query for transactions.
 * All dynamic parameters are strictly parameterized ($1, $2...).
 * Column names are whitelisted to prevent SQL injection.
 */
export async function getPaginatedTransactions(
  options: TransactionFilterOptions = {}
): Promise<PaginatedTransactionsResponse> {
  const page = Math.max(1, options.page || 1);
  const pageSize = Math.max(1, Math.min(options.pageSize || 20, 100));
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const params: unknown[] = [];

  // 1. Text Search (Transaction ID, Accounts, Customer Names, Description)
  if (options.search && options.search.trim()) {
    const searchParam = `%${options.search.trim()}%`;
    params.push(searchParam);
    const idx = params.length;
    conditions.push(`(
      t.id::text ILIKE $${idx}
      OR src.account_number ILIKE $${idx}
      OR dst.account_number ILIKE $${idx}
      OR c_src.full_name ILIKE $${idx}
      OR c_dst.full_name ILIKE $${idx}
      OR t.description ILIKE $${idx}
    )`);
  }

  // 2. Status Filter
  if (options.status && options.status !== 'ALL') {
    params.push(options.status.trim());
    conditions.push(`t.status = $${params.length}`);
  }

  // 3. Transaction Type Filter
  if (options.transactionType && options.transactionType !== 'ALL') {
    params.push(options.transactionType.trim());
    conditions.push(`t.transaction_type = $${params.length}`);
  }

  // 4. Min Amount Filter
  if (typeof options.minAmount === 'number' && !isNaN(options.minAmount)) {
    params.push(options.minAmount);
    conditions.push(`t.amount >= $${params.length}`);
  }

  // 5. Max Amount Filter
  if (typeof options.maxAmount === 'number' && !isNaN(options.maxAmount)) {
    params.push(options.maxAmount);
    conditions.push(`t.amount <= $${params.length}`);
  }

  // 6. Date Range Filters
  if (options.startDate) {
    params.push(options.startDate);
    conditions.push(`t.occurred_at >= $${params.length}::timestamptz`);
  }
  if (options.endDate) {
    params.push(options.endDate);
    conditions.push(`t.occurred_at <= $${params.length}::timestamptz`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // 7. Whitelisted Sorting with Deterministic Secondary Key
  const sortCol = ALLOWED_SORT_COLUMNS[options.sortBy || 'occurred_at'] || 't.occurred_at';
  const sortDir = options.sortOrder?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const orderClause = `ORDER BY ${sortCol} ${sortDir}, t.id ASC`;

  // Count Query for Pagination
  const countQueryText = `
    SELECT COUNT(*)::text AS total
    FROM transactions t
    JOIN accounts src ON t.source_account_id = src.id
    JOIN customers c_src ON src.customer_id = c_src.id
    JOIN accounts dst ON t.destination_account_id = dst.id
    JOIN customers c_dst ON dst.customer_id = c_dst.id
    ${whereClause};
  `;

  const countResult = await query<{ total: string }>(countQueryText, params);
  const totalCount = parseInt(countResult.rows[0]?.total || '0', 10);
  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  // Clamped Offset
  const validOffset = page > totalPages ? 0 : offset;

  // Data Query with Pagination
  params.push(pageSize);
  const limitIdx = params.length;
  params.push(validOffset);
  const offsetIdx = params.length;

  const dataQueryText = `
    SELECT
      t.id,
      t.source_account_id,
      t.destination_account_id,
      t.amount,
      t.currency,
      t.transaction_type,
      t.status,
      t.description,
      t.occurred_at,
      t.created_at,
      src.account_number AS source_account_number,
      c_src.full_name AS source_customer_name,
      dst.account_number AS destination_account_number,
      c_dst.full_name AS destination_customer_name
    FROM transactions t
    JOIN accounts src ON t.source_account_id = src.id
    JOIN customers c_src ON src.customer_id = c_src.id
    JOIN accounts dst ON t.destination_account_id = dst.id
    JOIN customers c_dst ON dst.customer_id = c_dst.id
    ${whereClause}
    ${orderClause}
    LIMIT $${limitIdx} OFFSET $${offsetIdx};
  `;

  const dataResult = await query<TransactionRecord>(dataQueryText, params);

  return {
    data: dataResult.rows,
    pagination: {
      page: Math.min(page, totalPages),
      pageSize,
      totalCount,
      totalPages,
    },
  };
}
