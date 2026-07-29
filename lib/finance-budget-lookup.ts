/**
 * Budget category lookup for Approval Card.
 *
 * Pure utility that determines the remaining category allocation for a single
 * expense transaction in the context of approval. Used by ApprovalCard to
 * display "Sisa Alokasi Kategori: Rp X", "Belum dialokasikan", or
 * "Anggaran tidak dapat ditentukan".
 *
 * IMPORTANT — Formula yang BENAR (category-level):
 *   categoryRemaining = budgetLine.allocatedAmount - Σ actualUsage
 *                       WHERE budgetId AND categoryId match
 *
 * BUKAN (budget-level, SALAH):
 *   budget.totalAmount - Σ ALL actualUsage for budget
 *
 * Requirement: 7.6
 */

import type {
  BudgetEntity,
  BudgetLineDetail,
  BudgetActualUsage,
} from "@/lib/finance-budget-summary";

export interface BudgetCategoryLookupResult {
  type: "found" | "not_allocated" | "ambiguous";
  /** categoryRemaining = budgetLine.allocatedAmount - actualUsageForSameBudgetAndCategory */
  categoryRemaining?: number;
  budgetName?: string;
}

/**
 * Lookup sisa alokasi kategori untuk satu transaksi expense dalam konteks approval.
 *
 * Logic deterministik:
 * 1. Filter budgets: status === "active", projectId cocok, transactionDate
 *    berada di antara periodStart/periodEnd budget (inclusive).
 * 2. Untuk setiap budget kandidat, cari budget line dengan budgetId cocok
 *    DAN categoryId cocok.
 * 3. Hitung jumlah kandidat valid (budget yang memiliki budget line cocok).
 * 4. Jika tepat 1 match:
 *    - actualUsageForCategory = Σ budgetActualUsage.actualAmount
 *      WHERE budgetId === matchedBudget.id AND categoryId === transaction.categoryId
 *    - categoryRemaining = matchedBudgetLine.allocatedAmount - actualUsageForCategory
 *    - Return { type: "found", categoryRemaining, budgetName }
 * 5. Jika 0 match → { type: "not_allocated" }
 * 6. Jika > 1 match → { type: "ambiguous" }
 *
 * Constraints:
 * - Pure function, no side effects, no database queries, no mutations.
 * - NEVER uses budget.totalAmount — uses budgetLine.allocatedAmount (category-level).
 * - Valid ONLY when exactly ONE active budget matches.
 */
export function lookupBudgetCategoryForApproval(
  transaction: { projectId: string; categoryId: string; transactionDate: Date },
  budgets: readonly BudgetEntity[],
  budgetLines: readonly BudgetLineDetail[],
  budgetActualUsage: readonly BudgetActualUsage[],
): BudgetCategoryLookupResult {
  const txTime = transaction.transactionDate.getTime();

  // Step 1: Filter budgets — active, matching projectId, transactionDate within period
  const candidateBudgets = budgets.filter(
    (b) =>
      b.status === "active" &&
      b.projectId === transaction.projectId &&
      txTime >= b.periodStart.getTime() &&
      txTime <= b.periodEnd.getTime(),
  );

  // Step 2 & 3: For each candidate budget, find a matching budget line
  const validCandidates: Array<{
    budget: BudgetEntity;
    budgetLine: BudgetLineDetail;
  }> = [];

  for (const budget of candidateBudgets) {
    const matchingLine = budgetLines.find(
      (line) =>
        line.budgetId === budget.id &&
        line.categoryId === transaction.categoryId,
    );
    if (matchingLine) {
      validCandidates.push({ budget, budgetLine: matchingLine });
    }
  }

  // Step 5: 0 matches → not_allocated
  if (validCandidates.length === 0) {
    return { type: "not_allocated" };
  }

  // Step 6: > 1 match → ambiguous
  if (validCandidates.length > 1) {
    return { type: "ambiguous" };
  }

  // Step 4: Exactly 1 match
  const { budget: matchedBudget, budgetLine: matchedLine } = validCandidates[0];

  // Sum actual usage for the same budgetId AND categoryId
  const actualUsageForCategory = budgetActualUsage
    .filter(
      (usage) =>
        usage.budgetId === matchedBudget.id &&
        usage.categoryId === transaction.categoryId,
    )
    .reduce((sum, usage) => sum + usage.actualAmount, 0);

  // categoryRemaining = allocatedAmount (category-level) - actual usage
  const categoryRemaining = matchedLine.allocatedAmount - actualUsageForCategory;

  return {
    type: "found",
    categoryRemaining,
    budgetName: matchedBudget.name,
  };
}

export default lookupBudgetCategoryForApproval;
