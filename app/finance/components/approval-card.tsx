"use client";

import type { ApprovalTransactionProjection } from "@/lib/finance-ui-types";
import { formatRupiah } from "@/lib/format-utils";

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface ApprovalCardBudgetInfo {
  type: "found" | "not_allocated" | "ambiguous";
  /** Sisa alokasi kategori — hanya ada jika type === "found" */
  categoryRemaining?: number;
  budgetName?: string;
}

export interface ApprovalCardProps {
  /** Minimal transaction projection — NOT FinanceTransactionItem */
  transaction: ApprovalTransactionProjection;
  /** Budget category remaining lookup result */
  budgetInfo: ApprovalCardBudgetInfo;
  onReview: (id: string) => void;
  /** Whether the current user can review/approve this card. Default: false (safe). */
  canReview?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Formats date as "dd MMM yyyy" (e.g. "05 Jan 2025").
 * Uses id-ID locale with short month for Indonesian abbreviation.
 */
function formatShortDate(date: Date): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleDateString("id-ID", { month: "short" });
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Truncates text to max length with ellipsis.
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "…";
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ApprovalCard({ transaction, budgetInfo, onReview, canReview = false }: ApprovalCardProps) {
  const {
    id,
    transactionNumber,
    description,
    amount,
    transactionDate,
    projectName,
    requesterName,
  } = transaction;

  return (
    <div
      className="rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-sage"
    >
      <div className="flex flex-col gap-3">
        {/* Kode pengajuan */}
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-sm font-medium text-foreground">
            {transactionNumber}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatShortDate(transactionDate)}
          </span>
        </div>

        {/* Deskripsi */}
        <p className="text-sm text-foreground leading-snug">
          {truncateText(description, 120)}
        </p>

        {/* Nama proyek */}
        <span className="text-xs font-medium text-muted-foreground">
          {projectName}
        </span>

        {/* Jumlah — Rupiah tabular-nums */}
        <span className="font-mono text-base font-semibold tabular-nums text-foreground">
          {formatRupiah(amount)}
        </span>

        {/* Peminta */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>Peminta:</span>
          <span className="font-medium">
            {requesterName || "—"}
          </span>
        </div>

        {/* Budget info section */}
        <div className="text-xs">
          {budgetInfo.type === "found" && (
            <span className="text-foreground">
              Sisa Alokasi Kategori:{" "}
              <span className="font-mono tabular-nums font-medium">
                {formatRupiah(budgetInfo.categoryRemaining)}
              </span>
            </span>
          )}
          {budgetInfo.type === "not_allocated" && (
            <span className="text-muted-foreground">
              Belum dialokasikan
            </span>
          )}
          {budgetInfo.type === "ambiguous" && (
            <span className="text-muted-foreground">
              Anggaran tidak dapat ditentukan
            </span>
          )}
        </div>

        {/* Tinjau button — only rendered when canReview is true */}
        {canReview && (
          <button
            type="button"
            onClick={() => onReview(id)}
            aria-label={`Tinjau pengajuan ${transactionNumber}`}
            className="mt-1 inline-flex min-h-[44px] min-w-[44px] items-center justify-center self-start rounded-lg bg-[#4F6F52] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#4F6F52]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F6F52] focus-visible:ring-offset-2"
          >
            Tinjau
          </button>
        )}
      </div>
    </div>
  );
}

export default ApprovalCard;
