import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ApprovalCard } from "@/app/finance/components/approval-card";
import type { ApprovalTransactionProjection } from "@/lib/finance-ui-types";
import type { ApprovalCardBudgetInfo } from "@/app/finance/components/approval-card";

/**
 * ApprovalCard displays a single expense approval request as a card.
 * Shows transaction details, budget allocation info, and a "Tinjau" action button.
 *
 * Variants:
 * - Found (with allocated amount)
 * - Not allocated (shows "Belum dialokasikan", never Rp 0)
 * - Ambiguous (shows "Anggaran tidak dapat ditentukan")
 * - Long description (truncation behavior)
 *
 * Design / requirements: 7.5, 7.6, 7.8.
 */

// ─── Mock Data ───────────────────────────────────────────────────────────────

const baseTransaction: ApprovalTransactionProjection = {
  id: "txn-001",
  transactionNumber: "EXP-2025-0042",
  projectId: "proj-1",
  categoryId: "cat-material",
  description: "Pembelian material bangunan untuk konstruksi rumah tipe 45",
  amount: 15750000,
  transactionDate: new Date("2025-01-15"),
  approvalStatus: "pending",
  projectName: "Taman Sari Residence",
  requesterName: "Ahmad Wijaya",
};

// ─── Meta ────────────────────────────────────────────────────────────────────

const meta = {
  title: "Finance/ApprovalCard",
  component: ApprovalCard,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Card component for expense approval queue. Shows transaction number, " +
          "description, amount (Rupiah tabular-nums), project, requester, budget info, " +
          "and a 'Tinjau' button (Sage Green, 44×44px min touch target).",
      },
    },
  },
  argTypes: {
    onReview: { action: "onReview" },
  },
} satisfies Meta<typeof ApprovalCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Found: budget allocation found, shows remaining amount */
export const Found: Story = {
  args: {
    transaction: baseTransaction,
    budgetInfo: {
      type: "found",
      categoryRemaining: 35000000,
      budgetName: "Anggaran Konstruksi Q1 2025",
    },
    onReview: () => {},
  },
};

/** Not allocated: no matching budget line — shows "Belum dialokasikan" */
export const NotAllocated: Story = {
  args: {
    transaction: {
      ...baseTransaction,
      id: "txn-002",
      transactionNumber: "EXP-2025-0043",
      description: "Biaya konsultasi arsitek",
      amount: 8500000,
    },
    budgetInfo: {
      type: "not_allocated",
    },
    onReview: () => {},
  },
};

/** Ambiguous: multiple budgets match — shows "Anggaran tidak dapat ditentukan" */
export const Ambiguous: Story = {
  args: {
    transaction: {
      ...baseTransaction,
      id: "txn-003",
      transactionNumber: "EXP-2025-0044",
      description: "Pembelian peralatan kantor dan operasional",
      amount: 3200000,
    },
    budgetInfo: {
      type: "ambiguous",
    },
    onReview: () => {},
  },
};

/** Long description: tests truncation behavior at 120 chars */
export const LongDescription: Story = {
  args: {
    transaction: {
      ...baseTransaction,
      id: "txn-004",
      transactionNumber: "EXP-2025-0045",
      description:
        "Pengadaan material konstruksi berupa semen Portland tipe I sebanyak 500 sak, pasir halus 20 truk, " +
        "batu split 15 truk, besi beton diameter 10mm dan 12mm untuk pondasi dan kolom struktur bangunan rumah tipe 70 " +
        "di blok C kavling 1 sampai 10 Taman Sari Residence fase 2",
      amount: 187500000,
      requesterName: "Mohammad Rizky Pratama Putra",
    },
    budgetInfo: {
      type: "found",
      categoryRemaining: 12500000,
      budgetName: "Anggaran Material Fase 2",
    },
    onReview: () => {},
  },
};

/** Null requester: requesterName is null */
export const NullRequester: Story = {
  args: {
    transaction: {
      ...baseTransaction,
      id: "txn-005",
      transactionNumber: "EXP-2025-0046",
      requesterName: null,
    },
    budgetInfo: {
      type: "found",
      categoryRemaining: 50000000,
      budgetName: "Budget Operasional",
    },
    onReview: () => {},
  },
};
