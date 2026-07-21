const DEFAULT_PAGE_SIZE = 100;
const MAX_ROWS = 50_000;

function errorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message);
  }
  return JSON.stringify(error);
}

type RangeQuery = {
  select(columns: string): RangeQuery;
  order(column: string, opts?: { ascending?: boolean }): RangeQuery;
  eq(column: string, value: unknown): RangeQuery;
  range(from: number, to: number): Promise<{ data: unknown; error: unknown }>;
};

/**
 * MatuDB caps single responses (~100 rows). Paginate with range() for accurate counts.
 */
export async function fetchAllRows<T>(
  buildQuery: () => RangeQuery,
  columns: string,
  options?: { pageSize?: number; orderBy?: string },
): Promise<T[]> {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const orderBy = options?.orderBy ?? 'created_at';
  const rows: T[] = [];
  let from = 0;

  while (from < MAX_ROWS) {
    const { data, error } = await buildQuery()
      .select(columns)
      .order(orderBy, { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`fetchAllRows failed: ${errorMessage(error)}`);
    }

    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

export async function countRows(
  buildQuery: () => RangeQuery,
  options?: { pageSize?: number },
): Promise<number> {
  const pageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  let total = 0;
  let from = 0;

  while (from < MAX_ROWS) {
    const { data, error } = await buildQuery()
      .select('id')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`countRows failed: ${errorMessage(error)}`);
    }

    const batch = (data ?? []) as unknown[];
    total += batch.length;
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return total;
}
