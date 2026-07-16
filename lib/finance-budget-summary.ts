/**
 * Pure budget-detail arithmetic and related-transaction pagination.
 *
 * This module is intentionally free of any database or React dependency so the
 * budget-detail rules can be unit- and property-tested in isolation. It mirrors
 * the logic used by the budget detail page
 * (`app/finance/budgets/[id]/page.tsx`).
 *
 * Requirement mapping:
 * - Requirement 9.1: the budget detail page shows a category allocation table
 *   (allocated / used / remaining per line) plus overall totals — the totals
 *   are the sums of each per-line field.
 * - Requirement 9.2: related transactions are ordered by transaction date
 *   descending, with a maximum of 50 per page and pagination controls.
 *
 * The page computes the overall totals from the in-memory allocation lines and
 * paginates related transactions at the database layer with
 * `ORDER BY transactionDate DESC`, `LIMIT 50`, `OFFSET (page - 1) * 50`. This
 * module reproduces that exact behaviour purely so the arithmetic and the
 * bounded/ordered pagination window are the one source of truth and verifiable
 * without a database.
 */

/** Default maximum related transactions shown per page (mirrors `PAGE_SIZE`). */
export const BUDGET_TRANSACTION_PAGE_SIZE = 50;

/** Minimal shape of a budget allocation line needed to compute overall totals. */
export interface BudgetLineInput {
  /** Amount allocated to the category. */
  allocatedAmount: number | null | undefined;
  /** Amount already used against the allocation. */
  usedAmount: number | null | undefined;
  /** Amount remaining on the allocation. */
  remainingAmount: number | null | undefined;
}

/** Overall budget totals summed across all allocation lines. */
export interface BudgetTotals {
  /** Σ allocatedAmount across every line. */
  totalAllocated: number;
  /** Σ usedAmount across every line. */
  totalUsed: number;
  /** Σ remainingAmount across every line. */
  totalRemaining: number;
}

/**
 * Compute the overall budget totals from the per-category allocation lines.
 *
 * Rules (Requirement 9.1):
 * - `totalAllocated` is the exact sum of every line's `allocatedAmount`.
 * - `totalUsed` is the exact sum of every line's `usedAmount`.
 * - `totalRemaining` is the exact sum of every line's `remainingAmount`.
 *
 * Null/undefined per-line values are treated as `0`, mirroring the `?? 0`
 * fallbacks used by the page.
 */
export function computeBudgetTotals(
  lines: readonly BudgetLineInput[],
): BudgetTotals {
  let totalAllocated = 0;
  let totalUsed = 0;
  let totalRemaining = 0;

  for (const line of lines) {
    totalAllocated += line.allocatedAmount ?? 0;
    totalUsed += line.usedAmount ?? 0;
    totalRemaining += line.remainingAmount ?? 0;
  }

  return { totalAllocated, totalUsed, totalRemaining };
}

/** Minimal shape of a related transaction needed to order/paginate the list. */
export interface DatedTransaction {
  /** Transaction date used to order the list newest-first. */
  transactionDate: Date;
}

/** A single bounded page of date-descending-ordered transactions. */
export interface TransactionPage<T extends DatedTransaction> {
  /** The bounded window of transactions for this page (≤ pageSize items). */
  items: T[];
  /** Total number of transactions across all pages. */
  totalCount: number;
  /** Total number of pages (always ≥ 1). */
  totalPages: number;
  /** The clamped current page (1 ≤ currentPage ≤ totalPages). */
  currentPage: number;
  /** The effective page size used to slice. */
  pageSize: number;
}

/**
 * Order a transaction list newest-first and return the bounded page window.
 *
 * Rules (Requirement 9.2):
 * - The full list is sorted by `transactionDate` descending (newest first).
 *   The sort is stable, so equal-dated transactions keep their input order.
 * - `totalPages = max(1, ceil(totalCount / pageSize))`.
 * - The requested `page` is clamped to `[1, totalPages]` (non-finite or
 *   non-positive requests fall back to page 1), mirroring the page's
 *   `safePage` / `currentPage` handling.
 * - The returned `items` are the contiguous slice
 *   `sorted[(currentPage - 1) * pageSize .. currentPage * pageSize)`, so the
 *   window holds at most `pageSize` items and is itself ordered newest-first.
 *
 * Because the clamped page drives the slice offset, iterating pages
 * `1..totalPages` partitions the sorted list exactly: the union of all pages
 * equals the full sorted set with no duplicates or drops.
 */
export function paginateTransactions<T extends DatedTransaction>(
  transactions: readonly T[],
  page: number,
  pageSize: number = BUDGET_TRANSACTION_PAGE_SIZE,
): TransactionPage<T> {
  const sorted = [...transactions].sort(
    (a, b) => b.transactionDate.getTime() - a.transactionDate.getTime(),
  );

  const totalCount = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const requested = Number.isFinite(page) ? Math.floor(page) : 1;
  const safePage = requested > 0 ? requested : 1;
  const currentPage = Math.min(safePage, totalPages);

  const offset = (currentPage - 1) * pageSize;
  const items = sorted.slice(offset, offset + pageSize);

  return { items, totalCount, totalPages, currentPage, pageSize };
}

export default computeBudgetTotals;
