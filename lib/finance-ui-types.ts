/**
 * UI Projection Types for Finance Module
 *
 * These are minimal projection interfaces used by UI components that receive
 * data from FinanceShell. They are structural subsets of FinanceShellProps data
 * (assignable without cast) but do NOT import from finance-shell.tsx or
 * reference FinanceShellProps / FinanceTransactionItem.
 *
 * Purpose: type isolation — downstream components declare only the fields they render.
 */

/**
 * Minimal project projection for UI components (e.g., CreateInvoiceDialog).
 * Only includes fields rendered by consuming components.
 */
export interface ProjectOption {
  id: string;
  name: string;
}

/**
 * Minimal unit projection for invoice creation.
 */
export interface UnitOption {
  id: string;
  code: string;
  projectId: string;
  price: number;
}

/**
 * Minimal customer projection for invoice creation.
 */
export interface CustomerOption {
  id: string;
  name: string;
}

/**
 * Minimal fields for an approval card display.
 * Deliberately does NOT reference FinanceTransactionItem.
 */
export interface ApprovalTransactionProjection {
  id: string;
  transactionNumber: string;
  projectId: string;
  categoryId: string;
  description: string;
  amount: number;
  transactionDate: Date;
  approvalStatus:
    | "pending"
    | "insufficient_balance"
    | "approved"
    | "rejected"
    | "not_required";
  projectName: string;
  /** Resolved from resolvedApproverName || createdBy */
  requesterName: string | null;
}
