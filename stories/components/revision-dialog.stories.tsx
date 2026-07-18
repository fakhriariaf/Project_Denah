import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  RevisionDialog,
  type RevisionActionResult,
} from "@/components/finance/revision-dialog";

/**
 * RevisionDialog drives the two-step finance revision flow for a rejected
 * entity: it calls `startAction` on open (opens a revision draft) and
 * `resubmitAction` on submit (validates + resubmits).
 *
 * These stories wire the dialog to mock async action callbacks so it is fully
 * interactive in Storybook without a server — no DB or server action is
 * involved. Open the dialog, edit fields, and submit to see each outcome.
 *
 * Design / requirements: 4.1, 4.2, 4.15, 6.5.
 */

const paymentFields = [
  { name: "amount", label: "Jumlah", type: "amount" as const, required: true },
  { name: "paymentDate", label: "Tanggal Pembayaran", type: "date" as const, required: true },
  {
    name: "paymentMethod",
    label: "Metode Pembayaran",
    type: "select" as const,
    required: true,
    options: [
      { value: "cash", label: "Tunai" },
      { value: "transfer", label: "Transfer" },
      { value: "giro", label: "Giro" },
      { value: "other", label: "Lainnya" },
    ],
  },
  {
    name: "proofAttachmentId",
    label: "Bukti Pembayaran",
    type: "proof" as const,
    helpText: "Lampiran bukti dapat dipertahankan atau dikosongkan.",
  },
];

const initialValues = {
  amount: "5000000",
  paymentDate: "2026-05-01",
  paymentMethod: "transfer",
  proofAttachmentId: "att-123",
};

const readOnlyFields = [
  { label: "Nomor Pembayaran", value: "PAY-2026-0042", mono: true },
  { label: "Dibuat", value: "01 Mei 2026, 09:12" },
];

/** Mock start-revision action: always succeeds (opens the draft). */
async function startActionOk(): Promise<RevisionActionResult> {
  return { success: true };
}

const meta = {
  title: "Finance/RevisionDialog",
  component: RevisionDialog,
  parameters: {
    layout: "centered",
    // RevisionDialog calls useRouter(). Enable the Next.js App Router mock so
    // the story behaves like the application instead of throwing at render.
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/finance/payments/pay-001",
      },
    },
    docs: {
      description: {
        component:
          "Two-step revision dialog for rejected payments / expense approvals. " +
          "Wired to mock async callbacks in Storybook (no server). Shows the prominent rejection notice, " +
          "read-only context fields, editable fields, and field-level validation errors on resubmit.",
      },
    },
  },
  args: {
    entityId: "pay-001",
    fields: paymentFields,
    initialValues,
    readOnlyFields,
    rejectionReason: "Nominal pembayaran tidak sesuai dengan bukti transfer yang dilampirkan.",
    startAction: startActionOk,
    triggerLabel: "Revisi",
  },
} satisfies Meta<typeof RevisionDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Happy path: resubmit succeeds and closes the dialog. */
export const ResubmitSuccess: Story = {
  args: {
    resubmitAction: async () => ({ success: true }),
  },
};

/** Validation failure: dialog stays open, entered data preserved, field errors shown (Req 4.15). */
export const ValidationErrors: Story = {
  args: {
    resubmitAction: async () => ({
      success: false,
      error: "Validasi gagal. Periksa kembali data yang dimasukkan.",
      fieldErrors: {
        amount: ["Jumlah harus lebih besar dari 0."],
        paymentDate: ["Tanggal pembayaran wajib diisi."],
      },
    }),
  },
};

/** Authorization/guard failure thrown by the resubmit action (toasted, dialog stays open). */
export const ResubmitAuthError: Story = {
  args: {
    resubmitAction: async () => {
      throw new Error("Anda tidak memiliki izin untuk merevisi item ini.");
    },
  },
};

/** No rejection reason recorded — a defensive placeholder notice is shown. */
export const NoRejectionReason: Story = {
  args: {
    rejectionReason: null,
    resubmitAction: async () => ({ success: true }),
  },
};
