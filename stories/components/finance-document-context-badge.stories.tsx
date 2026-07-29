import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FinanceDocumentContextBadge } from "@/components/finance/finance-document-context-badge";

/**
 * FinanceDocumentContextBadge marks an invoice as a customer document, an
 * internal expense, or a neutral finance document. It is driven by the
 * classification from `getInvoiceDocumentContext`.
 *
 * Every variant carries a text label — color is never the sole differentiator —
 * so the badge stays accessible (information not conveyed by color alone).
 *
 * Design / requirements: 2.3, 2.4, 5.4.
 */
const meta = {
  title: "Finance/FinanceDocumentContextBadge",
  component: FinanceDocumentContextBadge,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Badge indicating invoice document context: customer (Sage Green), internal (amber), or " +
          "neutral (muted). Text label always present for accessibility. Light theme only.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "inline-radio",
      options: ["customer", "internal", "neutral"],
    },
  },
} satisfies Meta<typeof FinanceDocumentContextBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Customer invoice — Sage Green primary theme. */
export const Customer: Story = {
  args: {
    variant: "customer",
  },
};

/** Internal expense (Pengeluaran Internal) — amber/warning theme. */
export const Internal: Story = {
  args: {
    variant: "internal",
  },
};

/** Neutral finance document — muted theme when context is not yet certain. */
export const Neutral: Story = {
  args: {
    variant: "neutral",
  },
};

/** Custom label override, e.g. a more specific customer invoice type. */
export const CustomLabel: Story = {
  args: {
    variant: "customer",
    label: "Booking Fee",
  },
};

/** All three variants side by side for quick visual comparison. */
export const AllVariants: Story = {
  args: {
    variant: "customer",
  },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <FinanceDocumentContextBadge variant="customer" />
      <FinanceDocumentContextBadge variant="internal" />
      <FinanceDocumentContextBadge variant="neutral" />
    </div>
  ),
};
