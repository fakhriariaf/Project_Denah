import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { KpiComparisonIndicator } from "@/components/finance/kpi-comparison-indicator";

/**
 * KpiComparisonIndicator shows period-over-period KPI trend.
 * Consumes output from `calculateKpiPercentageChange` utility.
 *
 * Variants:
 * - neutral (Semua Periode) → "Pilih periode untuk melihat perbandingan"
 * - new_data → "Data baru pada periode ini"
 * - comparable positive → ↑ X.X% dari [label]
 * - comparable negative → ↓ X.X% dari [label]
 * - comparable zero → "Tidak ada perubahan dari [label]"
 *
 * Design / requirements: 1.9, 1.10, 1.11.
 */
const meta = {
  title: "Finance/KpiComparisonIndicator",
  component: KpiComparisonIndicator,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Small presentational component showing period-over-period KPI trend. " +
          "Arrows only shown for comparable state. Text size: text-xs (12px). " +
          "Hydration-safe — no Date.now() or browser-dependent values.",
      },
    },
  },
} satisfies Meta<typeof KpiComparisonIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Neutral state: "Semua Periode" active — shows guidance text */
export const Neutral: Story = {
  args: {
    result: { percentage: null, state: "neutral" },
    comparisonLabel: null,
    isAllPeriod: true,
  },
};

/** New data state: previous period had 0, current has data */
export const NewData: Story = {
  args: {
    result: { percentage: null, state: "new_data" },
    comparisonLabel: "Des 2024",
    isAllPeriod: false,
  },
};

/** Comparable positive: income increased 15.3% */
export const ComparablePositive: Story = {
  args: {
    result: { percentage: 15.3, state: "comparable" },
    comparisonLabel: "Des 2024",
    isAllPeriod: false,
  },
};

/** Comparable negative: expense decreased -8.7% */
export const ComparableNegative: Story = {
  args: {
    result: { percentage: -8.7, state: "comparable" },
    comparisonLabel: "Nov 2024",
    isAllPeriod: false,
  },
};

/** Comparable zero: no change from previous period */
export const ComparableZero: Story = {
  args: {
    result: { percentage: 0, state: "comparable" },
    comparisonLabel: "Okt 2024",
    isAllPeriod: false,
  },
};

/** Neutral without "Semua Periode" — both values 0, no comparison label */
export const NeutralNoPriorData: Story = {
  args: {
    result: { percentage: null, state: "neutral" },
    comparisonLabel: null,
    isAllPeriod: false,
  },
};
