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

// ==========================================================================
// Extended Budget Summary — Finance Home, Tab Budget, Detail Budget
// ==========================================================================

/**
 * A budget entity with status and period information.
 * Used by `computeFilteredBudgetTotals` to determine which budgets to include.
 */
export interface BudgetEntity {
  id: string;
  projectId: string;
  name: string;
  periodStart: Date;
  periodEnd: Date;
  totalAmount: number;
  status: "draft" | "active" | "closed";
}

/**
 * A budget allocation line with persisted usage (from budget_lines table).
 */
export interface BudgetLineDetail {
  budgetId: string;
  categoryId: string;
  allocatedAmount: number;
  usedAmount: number;
  remainingAmount: number;
}

/**
 * Pre-aggregated actual usage from approved expense transactions.
 */
export interface BudgetActualUsage {
  budgetId: string;
  categoryId: string;
  actualAmount: number;
}

/**
 * Optional filter for computing budget totals.
 */
export interface BudgetTotalsFilter {
  projectId?: string | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
}

/**
 * Extended budget totals result with actual vs persisted comparison.
 */
export interface FilteredBudgetTotals {
  /** Sum of totalAmount for active budgets matching filter. */
  totalAllocated: number;
  /** Sum of budgetLines.usedAmount for matching active budgets. */
  totalUsedPersisted: number;
  /** Sum of budgetActualUsage.actualAmount for matching active budgets. */
  totalUsedActual: number;
  /** totalAllocated - totalUsedActual */
  remaining: number;
  /** (totalUsedActual / totalAllocated) * 100, 0 if no allocation. */
  absorptionPercentage: number;
  /** totalUsedActual > totalAllocated */
  isOverBudget: boolean;
  /** totalUsedPersisted !== totalUsedActual */
  persistedDiffersFromActual: boolean;
}

/**
 * Check whether two date ranges overlap (inclusive on both ends).
 * Returns true if [aStart, aEnd] overlaps with [bStart, bEnd].
 */
function periodsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart.getTime() <= bEnd.getTime() && bStart.getTime() <= aEnd.getTime();
}

/**
 * Compute extended budget totals from budgets, budget lines, and actual usage.
 *
 * This is a PURE function — no side effects, no database queries, no mutations.
 *
 * Filtering logic:
 * - Only budgets with status "active" are included.
 * - If filter.projectId is provided and non-null, only budgets matching that projectId are included.
 * - If filter.periodStart and/or filter.periodEnd are provided, only budgets whose
 *   [periodStart, periodEnd] overlaps the filter range are included.
 *   When only one bound is provided, the range is open-ended on the missing side.
 *
 * Computation:
 * - totalAllocated: sum of budget.totalAmount for all matching active budgets.
 * - totalUsedPersisted: sum of budgetLines.usedAmount for lines belonging to matching budgets.
 * - totalUsedActual: sum of budgetActualUsage.actualAmount for records belonging to matching budgets.
 * - remaining: totalAllocated - totalUsedActual.
 * - absorptionPercentage: (totalUsedActual / totalAllocated) * 100, or 0 if totalAllocated is 0.
 * - isOverBudget: totalUsedActual > totalAllocated.
 * - persistedDiffersFromActual: totalUsedPersisted !== totalUsedActual.
 *
 * Requirements: 1.6, 1.7, 1.8, 9.3, 10.2
 */
export function computeFilteredBudgetTotals(
  budgets: readonly BudgetEntity[],
  budgetLines: readonly BudgetLineDetail[],
  budgetActualUsage: readonly BudgetActualUsage[],
  filter?: BudgetTotalsFilter | null,
): FilteredBudgetTotals {
  // Step 1: Filter budgets to active status only
  let activeBudgets = budgets.filter((b) => b.status === "active");

  // Step 2: Apply projectId filter if provided
  if (filter?.projectId != null) {
    activeBudgets = activeBudgets.filter((b) => b.projectId === filter.projectId);
  }

  // Step 3: Apply period overlap filter if provided
  if (filter?.periodStart != null || filter?.periodEnd != null) {
    const filterStart = filter.periodStart ?? new Date(0);
    const filterEnd = filter.periodEnd ?? new Date(8640000000000000); // max safe date

    activeBudgets = activeBudgets.filter((b) =>
      periodsOverlap(b.periodStart, b.periodEnd, filterStart, filterEnd),
    );
  }

  // Step 4: Collect matching budget IDs for line/usage lookup
  const activeBudgetIds = new Set(activeBudgets.map((b) => b.id));

  // Step 5: Compute totalAllocated from budget.totalAmount
  const totalAllocated = activeBudgets.reduce((sum, b) => sum + b.totalAmount, 0);

  // Step 6: Compute totalUsedPersisted from budget lines
  const totalUsedPersisted = budgetLines
    .filter((line) => activeBudgetIds.has(line.budgetId))
    .reduce((sum, line) => sum + line.usedAmount, 0);

  // Step 7: Compute totalUsedActual from actual usage
  const totalUsedActual = budgetActualUsage
    .filter((usage) => activeBudgetIds.has(usage.budgetId))
    .reduce((sum, usage) => sum + usage.actualAmount, 0);

  // Step 8: Derive computed values
  const remaining = totalAllocated - totalUsedActual;
  const absorptionPercentage =
    totalAllocated === 0 ? 0 : (totalUsedActual / totalAllocated) * 100;
  const isOverBudget = totalUsedActual > totalAllocated;
  const persistedDiffersFromActual = totalUsedPersisted !== totalUsedActual;

  return {
    totalAllocated,
    totalUsedPersisted,
    totalUsedActual,
    remaining,
    absorptionPercentage,
    isOverBudget,
    persistedDiffersFromActual,
  };
}

export default computeBudgetTotals;
