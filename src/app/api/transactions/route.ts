import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getPaginatedTransactions } from '@/lib/queries/transactions';
import { PaginatedTransactionsResponse } from '@/types';

const VALID_STATUSES = ['COMPLETED', 'PENDING', 'FLAGGED', 'REJECTED', 'CANCELLED', 'FAILED', 'ALL'] as const;
const VALID_TYPES = ['NEFT', 'RTGS', 'IMPS', 'UPI', 'WIRE_TRANSFER', 'INTERNAL_TRANSFER', 'INTERNAL', 'ALL'] as const;

const transactionsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1, 'Page must be >= 1').default(1),
    pageSize: z.coerce.number().int().min(1, 'Page size must be >= 1').max(100, 'Page size must be <= 100').default(20),
    search: z.string().max(200, 'Search query must be at most 200 characters').optional(),
    status: z
      .string()
      .trim()
      .transform((val) => val.toUpperCase())
      .pipe(z.enum(VALID_STATUSES))
      .optional(),
    type: z
      .string()
      .trim()
      .transform((val) => val.toUpperCase())
      .pipe(z.enum(VALID_TYPES))
      .optional(),
    minAmount: z.coerce.number().nonnegative('minAmount must be non-negative').optional(),
    maxAmount: z.coerce.number().positive('maxAmount must be positive').optional(),
    startDate: z
      .string()
      .trim()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: 'Invalid startDate timestamp format',
      })
      .optional(),
    endDate: z
      .string()
      .trim()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: 'Invalid endDate timestamp format',
      })
      .optional(),
    sortBy: z.enum(['occurred_at', 'amount', 'status', 'transaction_type']).default('occurred_at'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .refine(
    (data) => {
      if (data.minAmount !== undefined && data.maxAmount !== undefined) {
        return data.minAmount <= data.maxAmount;
      }
      return true;
    },
    { message: 'minAmount cannot be greater than maxAmount', path: ['minAmount'] }
  );

/**
 * GET /api/transactions
 * Returns server-side paginated, filtered, and sorted transactions.
 * All inputs validated with Zod; all queries parameterized.
 */
export async function GET(
  req: NextRequest
): Promise<NextResponse<PaginatedTransactionsResponse | { error: string }>> {
  try {
    const searchParams = req.nextUrl.searchParams;
    const rawParams = {
      page: searchParams.get('page') || undefined,
      pageSize: searchParams.get('pageSize') || undefined,
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      type: searchParams.get('type') || undefined,
      minAmount: searchParams.get('minAmount') || undefined,
      maxAmount: searchParams.get('maxAmount') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: searchParams.get('sortOrder') || undefined,
    };

    const parsed = transactionsQuerySchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        { error: `Invalid query parameters: ${parsed.error.issues.map((i) => i.message).join(', ')}` },
        { status: 400 }
      );
    }

    const {
      page,
      pageSize,
      search,
      status,
      type,
      minAmount,
      maxAmount,
      startDate,
      endDate,
      sortBy,
      sortOrder,
    } = parsed.data;

    const result = await getPaginatedTransactions({
      page,
      pageSize,
      search,
      status,
      transactionType: type,
      minAmount,
      maxAmount,
      startDate,
      endDate,
      sortBy,
      sortOrder,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error('[Transactions API Error]:', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'An error occurred while fetching transactions from the database' },
      { status: 500 }
    );
  }
}
