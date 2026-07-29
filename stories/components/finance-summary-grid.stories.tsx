import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Wallet, TrendingDown, PiggyBank, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FinanceSummaryGrid } from "@/components/finance/finance-summary-grid";

/**
 * FinanceSummaryGrid is the responsive card grid used on Finance Home for the
 * kas summary (Total Kas Masuk, Pengeluaran Disetujui, Saldo Bersih, Piutang
 * Berjalan, Anggaran Aktif) and the budget summary (Total Anggaran Aktif,
 * Terpakai, Sisa).
 *
 * Layout: 4 columns on desktop (≥1024px), 2 columns on tablet (≥640px), and a
 * single column on mobile. Monetary values use Rupiah id-ID format with
 * tabular-nums. When `items` is empty it renders an empty state instead of a
 * blank grid.
 *
 * Design / requirements: 1.4, 1.5, 15.1, 16.1.
 */
const meta = {
  title: "Finance/FinanceSummaryGrid",
  component: FinanceSummaryGrid,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Responsive summary card grid for Finance Home. Rupiah id-ID formatting with tabular-nums, " +
          "Sage Green semantic tokens, and an empty state when there is no data. Light theme only.",
      },
    },
  },
} satisfies Meta<typeof FinanceSummaryGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Kas summary: the four headline cash metrics on Finance Home. */
export const KasSummary: Story = {
  args: {
    "aria-label": "Ringkasan Kas",
    items: [
      {
        key: "kas-masuk",
        label: "Total Kas Masuk",
        value: 1_250_000_000,
        icon: <Wallet className="h-4 w-4" />,
      },
      {
        key: "pengeluaran",
        label: "Pengeluaran Disetujui",
        value: 480_000_000,
        icon: <TrendingDown className="h-4 w-4" />,
      },
      {
        key: "saldo",
        label: "Saldo Bersih",
        value: 770_000_000,
        icon: <PiggyBank className="h-4 w-4" />,
      },
      {
        key: "piutang",
        label: "Piutang Berjalan",
        value: 325_000_000,
        icon: <Receipt className="h-4 w-4" />,
      },
    ],
  },
};

/** Five KPI cards used by the Finance Home overview. */
export const FinanceHomeOverview: Story = {
  args: {
    "aria-label": "Ringkasan utama keuangan",
    items: [
      ...KasSummary.args.items,
      {
        key: "anggaran-aktif",
        label: "Anggaran Aktif",
        value: 1_000_000_000,
        icon: <Wallet className="h-4 w-4" />,
        indicator: <span className="text-xs text-muted-foreground">Terpakai 42,5%</span>,
      },
    ],
  },
};

/** Budget summary: three-card allocation view with an over-budget indicator. */
export const BudgetSummaryOverBudget: Story = {
  args: {
    "aria-label": "Ringkasan Anggaran",
    items: [
      {
        key: "total-anggaran",
        label: "Total Anggaran Aktif",
        value: 1_000_000_000,
      },
      {
        key: "terpakai",
        label: "Anggaran Terpakai",
        value: 1_200_000_000,
      },
      {
        key: "sisa",
        label: "Sisa Anggaran",
        value: -200_000_000,
        accent: "danger",
        indicator: (
          <Badge className="bg-destructive/10 text-destructive border border-destructive/20">
            Over Budget
          </Badge>
        ),
      },
    ],
  },
};

/** Normal state: a single card with a healthy trend indicator. */
export const Normal: Story = {
  args: {
    "aria-label": "Ringkasan Keuangan",
    items: [
      {
        key: "saldo",
        label: "Saldo Bersih",
        value: 770_000_000,
        icon: <PiggyBank className="h-4 w-4" />,
        indicator: (
          <Badge variant="secondary" className="text-xs font-normal">
            Naik 12% dari bulan lalu
          </Badge>
        ),
      },
    ],
  },
};

/** Empty state: no summary data available (Req 15.1). */
export const Empty: Story = {
  args: {
    items: [],
    emptyMessage: "Belum ada data ringkasan untuk filter aktif.",
  },
};
