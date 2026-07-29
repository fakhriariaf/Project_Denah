import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FinanceTableState } from "@/components/finance/finance-table-state";

/**
 * FinanceTableState is the unified empty / loading / error state for finance
 * tables. It keeps tables from ever rendering blank without context: empty
 * mentions the active tab/filter, loading shows a Sage Green skeleton, and
 * error hides technical details behind a retry action.
 *
 * Design / requirements: 15.1, 15.2, 15.3, 15.4.
 */
const meta = {
  title: "Finance/FinanceTableState",
  component: FinanceTableState,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Empty, loading, and error states for finance tables. Empty names the active filter, loading uses " +
          "a Sage Green skeleton, and error offers a retry without exposing technical detail. Light theme only.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "inline-radio",
      options: ["empty", "loading", "error"],
    },
  },
} satisfies Meta<typeof FinanceTableState>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empty state naming the active tab and filter (Req 15.1). */
export const Empty: Story = {
  args: {
    variant: "empty",
    filterContext: "Invoice & Tagihan - Belum Lunas",
  },
};

/** Empty state without a specific filter context. */
export const EmptyNoFilter: Story = {
  args: {
    variant: "empty",
  },
};

/** Loading skeleton consistent with Sage Green tokens (Req 15.2). */
export const Loading: Story = {
  args: {
    variant: "loading",
    columns: 6,
  },
};

/** Error state with a retry callback and no technical detail (Req 15.3). */
export const Error: Story = {
  args: {
    variant: "error",
    onRetry: () => {},
  },
};

/** Error state without a retry handler (retry button hidden). */
export const ErrorWithoutRetry: Story = {
  args: {
    variant: "error",
  },
};
