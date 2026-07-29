import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { CreateInvoiceDialog } from "@/app/finance/components/create-invoice-dialog";
import type { ProjectOption, UnitOption, CustomerOption } from "@/lib/finance-ui-types";

/**
 * CreateInvoiceDialog is the "Buat Invoice" dialog on Finance Home.
 * Uses minimal projection types (ProjectOption, UnitOption, CustomerOption)
 * and calls createInvoice() server action.
 *
 * Variants:
 * - Closed (dialog not visible)
 * - Open with data (projects, units, customers populated)
 * - Open with empty lists (no projects/units/customers)
 * - Submitting state (loading)
 *
 * Design / requirements: 2.1, 2.3.
 */

// ─── Mock Data ───────────────────────────────────────────────────────────────

const mockProjects: ProjectOption[] = [
  { id: "p1", name: "Taman Sari Residence" },
  { id: "p2", name: "Green Valley Estate" },
  { id: "p3", name: "Bukit Indah Permai" },
];

const mockUnits: UnitOption[] = [
  { id: "u1", code: "A1", projectId: "p1", price: 500000000 },
  { id: "u2", code: "A2", projectId: "p1", price: 550000000 },
  { id: "u3", code: "B1", projectId: "p2", price: 750000000 },
  { id: "u4", code: "C1", projectId: "p3", price: 450000000 },
];

const mockCustomers: CustomerOption[] = [
  { id: "c1", name: "Budi Santoso" },
  { id: "c2", name: "Siti Rahayu" },
  { id: "c3", name: "Ahmad Wijaya" },
];

// ─── Meta ────────────────────────────────────────────────────────────────────

const meta = {
  title: "Finance/CreateInvoiceDialog",
  component: CreateInvoiceDialog,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Dialog for creating new invoices. Accepts minimal projection types " +
          "(ProjectOption[], UnitOption[], CustomerOption[]) and calls the existing " +
          "createInvoice() server action. Field 'Keterangan' maps to `notes`.",
      },
    },
  },
  argTypes: {
    onOpenChange: { action: "onOpenChange" },
    onSuccess: { action: "onSuccess" },
  },
} satisfies Meta<typeof CreateInvoiceDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Closed: dialog not visible */
export const Closed: Story = {
  args: {
    open: false,
    onOpenChange: () => {},
    projects: mockProjects,
    units: mockUnits,
    customers: mockCustomers,
    onSuccess: () => {},
  },
};

/** Open with data: projects, units, customers populated */
export const OpenWithData: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    projects: mockProjects,
    units: mockUnits,
    customers: mockCustomers,
    onSuccess: () => {},
  },
};

/** Open with empty lists: no options available */
export const OpenEmptyLists: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    projects: [],
    units: [],
    customers: [],
    onSuccess: () => {},
  },
};

/** Submitting state: simulated by rendering in open state (loading handled internally) */
export const Submitting: Story = {
  args: {
    open: true,
    onOpenChange: () => {},
    projects: mockProjects,
    units: mockUnits,
    customers: mockCustomers,
    onSuccess: () => {},
  },
  parameters: {
    docs: {
      description: {
        story:
          "The submitting/loading state is managed internally by the component. " +
          "This story shows the dialog open — the loading spinner appears after form submission.",
      },
    },
  },
};
