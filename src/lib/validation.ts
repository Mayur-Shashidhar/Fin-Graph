import { z } from 'zod';
// PostgreSQL UUID accepts the deterministic non-RFC-version IDs in seed.sql.
export const databaseId = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid database identifier');

export function transactionDateBoundary(endOfDay = false) {
  return z.union([z.iso.date(), z.iso.datetime({ offset: true })]).transform(value =>
    value.length === 10 ? `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z` : value);
}
