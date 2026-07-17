import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { FinanceDocLink } from "@/components/finance/finance-doc-link";

/**
 * FinanceDocLink renders a finance document identifier (invoice / payment /
 * transaction / approval number, budget name) as a semantic anchor when a
 * concrete `href` is provided, and as plain monospace text otherwise
 * (route-safe: callers activate links per phase).
 *
 * Design / requirements: 1.6, 1.7, 11.1, 11.3.
 */
const meta = {
  title: "Finance/FinanceDocLink",
  component: FinanceDocLink,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Document-number link with monospace font and Sage Green hover (#4F6F52 → #3D563F). " +
          "Renders a real `<a href>` when given a concrete href, and plain monospace text when the href is missing/empty.",
      },
    },
  },
  args: {
    href: "/finance/invoices/inv-001",
    children: "INV-2026-0001",
  },
  argTypes: {
    href: { control: "text" },
    children: { control: "text" },
  },
} satisfies Meta<typeof FinanceDocLink>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Interactive playground — toggle the `href` control to switch between link and plain text. */
export const Playground: Story = {};

/** With a concrete href: renders a semantic anchor (Sage Green hover, monospace). */
export const AsLink: Story = {
  args: {
    href: "/finance/invoices/inv-001",
    children: "INV-2026-0001",
  },
};

/** Without an href: renders plain monospace text (route-safe fallback). */
export const AsPlainText: Story = {
  args: {
    href: null,
    children: "INV-2026-0001",
  },
};

/** Side-by-side comparison of both variants across finance entity types. */
export const Variants: Story = {
  render: () => (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex items-center gap-3">
        <span className="w-40 text-muted-foreground">Invoice (link)</span>
        <FinanceDocLink href="/finance/invoices/inv-001">INV-2026-0001</FinanceDocLink>
      </div>
      <div className="flex items-center gap-3">
        <span className="w-40 text-muted-foreground">Pembayaran (link)</span>
        <FinanceDocLink href="/finance/payments/pay-001">PAY-2026-0042</FinanceDocLink>
      </div>
      <div className="flex items-center gap-3">
        <span className="w-40 text-muted-foreground">Transaksi (link)</span>
        <FinanceDocLink href="/finance/transactions/trx-001">TRX-2026-0107</FinanceDocLink>
      </div>
      <div className="flex items-center gap-3">
        <span className="w-40 text-muted-foreground">Plain text (no href)</span>
        <FinanceDocLink href={null}>PAY-2026-0042</FinanceDocLink>
      </div>
    </div>
  ),
};
