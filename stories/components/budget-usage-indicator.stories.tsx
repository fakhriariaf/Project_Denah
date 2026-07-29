import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BudgetUsageIndicator } from "@/components/finance/budget-usage-indicator";

/**
 * BudgetUsageIndicator renders budget absorption (serapan) as a progress bar
 * plus terpakai/sisa nominal. Its visual state follows the usage percentage:
 * normal (<50%), peringatan (50–80%), kritis (>80%), and over-budget (>100%).
 *
 * When over budget, the bar visually caps at 100%, the sisa goes negative, and
 * an "Over Budget" badge appears.
 *
 * Design / requirements: 9.5, 9.6.
 */
const meta = {
  title: "Finance/BudgetUsageIndicator",
  component: BudgetUsageIndicator,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Budget absorption indicator with normal / peringatan / kritis / over-budget states. " +
          "Progress caps at 100% visually; sisa can be negative. Tabular-nums, Sage Green tokens, light theme only.",
      },
    },
  },
} satisfies Meta<typeof BudgetUsageIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Normal absorption below 50% — Sage Green bar. */
export const Normal: Story = {
  args: {
    label: "Serapan Budget",
    totalBudget: 1_000_000_000,
    usedAmount: 111_000_000,
  },
};

/** Warning band (50–80%). */
export const Peringatan: Story = {
  args: {
    label: "Serapan Budget",
    totalBudget: 1_000_000_000,
    usedAmount: 650_000_000,
  },
};

/** Critical band (>80%). */
export const Kritis: Story = {
  args: {
    label: "Serapan Budget",
    totalBudget: 1_000_000_000,
    usedAmount: 920_000_000,
  },
};

/** Over budget (>100%): capped bar, negative sisa, Over Budget badge (Req 9.6). */
export const OverBudget: Story = {
  args: {
    label: "Serapan Budget",
    totalBudget: 1_000_000_000,
    usedAmount: 1_200_000_000,
  },
};

/** Compact variant for table cells. */
export const Compact: Story = {
  args: {
    label: "Serapan",
    totalBudget: 1_000_000_000,
    usedAmount: 111_000_000,
    compact: true,
  },
};

/** Compact variant while over budget. */
export const CompactOverBudget: Story = {
  args: {
    label: "Serapan",
    totalBudget: 1_000_000_000,
    usedAmount: 1_200_000_000,
    compact: true,
  },
};
