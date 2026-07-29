import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  CashFlowChart,
  CashFlowChartSkeleton,
} from "@/components/finance/cash-flow-chart";

/**
 * CashFlowChart — Line chart showing cash inflow, outflow, and net flow
 * over a given period. Uses Recharts with Sage Green design tokens.
 *
 * Three lines:
 * - Arus Masuk (Sage Green #8FAF9A)
 * - Arus Keluar (Red #DC2626)
 * - Arus Kas Bersih (Sage Dark #4F6F52, dashed)
 *
 * Requirements: 9.5, 9.6
 */
const meta = {
  title: "Components/CashFlowChart",
  component: CashFlowChart,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Presentational line chart for cash flow visualization. " +
          "Displays inflow, outflow, and net flow over time with Sage Green theme. " +
          "Hydration-safe — no Date.now() or Math.random().",
      },
    },
  },
} satisfies Meta<typeof CashFlowChart>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Fixture Data ────────────────────────────────────────────────────────────

const sixMonthsData = [
  { period: "Jan 2025", inflow: 850_000_000, outflow: 620_000_000, netFlow: 230_000_000 },
  { period: "Feb 2025", inflow: 920_000_000, outflow: 710_000_000, netFlow: 210_000_000 },
  { period: "Mar 2025", inflow: 1_100_000_000, outflow: 880_000_000, netFlow: 220_000_000 },
  { period: "Apr 2025", inflow: 780_000_000, outflow: 650_000_000, netFlow: 130_000_000 },
  { period: "Mei 2025", inflow: 1_050_000_000, outflow: 790_000_000, netFlow: 260_000_000 },
  { period: "Jun 2025", inflow: 960_000_000, outflow: 720_000_000, netFlow: 240_000_000 },
];

const negativeNetFlowData = [
  { period: "Jan 2025", inflow: 500_000_000, outflow: 620_000_000, netFlow: -120_000_000 },
  { period: "Feb 2025", inflow: 730_000_000, outflow: 710_000_000, netFlow: 20_000_000 },
  { period: "Mar 2025", inflow: 400_000_000, outflow: 880_000_000, netFlow: -480_000_000 },
  { period: "Apr 2025", inflow: 950_000_000, outflow: 650_000_000, netFlow: 300_000_000 },
  { period: "Mei 2025", inflow: 600_000_000, outflow: 790_000_000, netFlow: -190_000_000 },
  { period: "Jun 2025", inflow: 1_100_000_000, outflow: 720_000_000, netFlow: 380_000_000 },
];

const largeValuesData = [
  { period: "Jan 2025", inflow: 3_200_000_000, outflow: 1_800_000_000, netFlow: 1_400_000_000 },
  { period: "Feb 2025", inflow: 4_500_000_000, outflow: 2_900_000_000, netFlow: 1_600_000_000 },
  { period: "Mar 2025", inflow: 2_800_000_000, outflow: 3_100_000_000, netFlow: -300_000_000 },
  { period: "Apr 2025", inflow: 5_100_000_000, outflow: 2_400_000_000, netFlow: 2_700_000_000 },
  { period: "Mei 2025", inflow: 3_900_000_000, outflow: 3_600_000_000, netFlow: 300_000_000 },
  { period: "Jun 2025", inflow: 4_200_000_000, outflow: 2_100_000_000, netFlow: 2_100_000_000 },
];

// ─── Stories ─────────────────────────────────────────────────────────────────

/** Default: 6 months of realistic data with positive net flow */
export const Default: Story = {
  args: {
    data: sixMonthsData,
    title: "Grafik Arus Kas",
    dateRange: "Jan 2025 - Jun 2025",
  },
};

/** Empty: no data — shows empty state message */
export const Empty: Story = {
  args: {
    data: [],
    title: "Grafik Arus Kas",
    dateRange: "Jan 2025 - Jun 2025",
  },
};

/** NegativeNetFlow: months where outflow exceeds inflow */
export const NegativeNetFlow: Story = {
  args: {
    data: negativeNetFlowData,
    title: "Grafik Arus Kas — Defisit Beberapa Bulan",
    dateRange: "Jan 2025 - Jun 2025",
  },
};

/** LargeValues: values in billions to test axis abbreviation (Rp X.XM) */
export const LargeValues: Story = {
  args: {
    data: largeValuesData,
    title: "Grafik Arus Kas — Proyek Besar",
    dateRange: "Jan 2025 - Jun 2025",
  },
};

/** Skeleton: loading fallback state */
export const Skeleton: Story = {
  args: {
    data: [],
    title: "",
    dateRange: "",
  },
  render: () => <CashFlowChartSkeleton />,
};
