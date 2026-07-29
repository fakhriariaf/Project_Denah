import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BudgetAlertNotice } from "@/components/finance/budget-alert-notice";

/**
 * BudgetAlertNotice displays an amber warning banner when a budget exceeds 80% absorption.
 * Renders nothing (null) when no budget qualifies.
 *
 * Variants:
 * - No alert (null) — nothing renders
 * - Warning (85%) — amber banner with usage info
 * - Over-budget (105%) — same banner style, percentage > 100%
 *
 * Design / requirements: 3.1, 3.5.
 */
const meta = {
  title: "Finance/BudgetAlertNotice",
  component: BudgetAlertNotice,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Conditional amber/yellow warning banner for budget absorption > 80%. " +
          "Shows budget name, percentage, used/total in Rupiah, and a link to detail page. " +
          "Renders null when `budget` is null (no budget exceeds threshold).",
      },
    },
  },
} satisfies Meta<typeof BudgetAlertNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No alert: no budget exceeds 80% — component renders nothing */
export const NoAlert: Story = {
  args: {
    budget: null,
  },
};

/** Warning: budget at 85% absorption */
export const Warning: Story = {
  args: {
    budget: {
      id: "budget-001",
      name: "Anggaran Konstruksi Q1 2025",
      totalAmount: 500000000,
      usedAmount: 425000000,
      absorptionPercentage: 85.0,
    },
  },
};

/** Over-budget: budget at 105% absorption — has overspent */
export const OverBudget: Story = {
  args: {
    budget: {
      id: "budget-002",
      name: "Biaya Marketing Taman Sari",
      totalAmount: 200000000,
      usedAmount: 210000000,
      absorptionPercentage: 105.0,
    },
  },
};

/** Edge: budget barely above threshold at 80.1% */
export const BarelyAboveThreshold: Story = {
  args: {
    budget: {
      id: "budget-003",
      name: "Operasional Kantor",
      totalAmount: 100000000,
      usedAmount: 80100000,
      absorptionPercentage: 80.1,
    },
  },
};
