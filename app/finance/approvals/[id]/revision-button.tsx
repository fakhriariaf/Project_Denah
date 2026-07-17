"use client";

/**
 * ApprovalRevisionButton — app/finance/approvals/[id]/revision-button.tsx (Task 8.4)
 *
 * Thin expense-approval-specific wrapper around the generic, config-driven
 * `RevisionDialog`. It configures the editable expense-approval fields (amount,
 * account, category, description, attachment), keeps the document number and
 * creation date read-only (Req 4.2), surfaces the rejection reason as a
 * prominent inline notice (Req 4.1), and wires the two-step server actions:
 * `startExpenseApprovalRevision` (called on open) and
 * `resubmitExpenseApprovalRevision` (called on submit). Field errors keep the
 * dialog open with entered data preserved (Req 4.15). Visibility is gated by the
 * page to Admin Keuangan / Super Admin (Req 8.3).
 *
 * Account and category select options are resolved server-side (id → name) and
 * passed in, so the dialog never has to fetch master data on the client.
 *
 * _Requirements: 4.5, 4.6, 4.7, 4.15, 8.3_
 */

import { RevisionDialog } from "@/components/finance/revision-dialog";
import {
  startExpenseApprovalRevision,
  resubmitExpenseApprovalRevision,
} from "@/server/actions/finance-revision";

export interface ApprovalRevisionOption {
  value: string;
  label: string;
}

export type ApprovalRevisionInitialValues = Record<string, string> & {
  amount: string;
  accountId: string;
  categoryId: string;
  description: string;
  attachmentId: string;
};

export function RevisionButton({
  transactionId,
  rejectionReason,
  transactionNumber,
  createdAt,
  initialValues,
  accountOptions,
  categoryOptions,
}: {
  transactionId: string;
  rejectionReason: string | null;
  transactionNumber: string;
  createdAt: string;
  initialValues: ApprovalRevisionInitialValues;
  accountOptions: ApprovalRevisionOption[];
  categoryOptions: ApprovalRevisionOption[];
}) {
  return (
    <RevisionDialog
      entityId={transactionId}
      triggerLabel="Revisi Pengajuan"
      title="Revisi Pengajuan Pengeluaran"
      description="Perbaiki data pengajuan pengeluaran yang ditolak lalu ajukan ulang untuk persetujuan."
      successMessage="Pengajuan pengeluaran berhasil diajukan ulang untuk persetujuan."
      rejectionReason={rejectionReason}
      startAction={startExpenseApprovalRevision}
      resubmitAction={resubmitExpenseApprovalRevision}
      readOnlyFields={[
        { label: "Nomor Transaksi", value: transactionNumber, mono: true },
        { label: "Tanggal Dibuat", value: createdAt },
      ]}
      initialValues={initialValues}
      fields={[
        {
          name: "amount",
          label: "Jumlah Pengeluaran",
          type: "amount",
          required: true,
          placeholder: "0",
        },
        {
          name: "accountId",
          label: "Akun",
          type: "select",
          required: true,
          placeholder: "Pilih akun…",
          options: accountOptions,
        },
        {
          name: "categoryId",
          label: "Kategori",
          type: "select",
          required: true,
          placeholder: "Pilih kategori…",
          options: categoryOptions,
        },
        {
          name: "description",
          label: "Deskripsi",
          type: "textarea",
          required: true,
          placeholder: "Deskripsi pengeluaran",
        },
        {
          name: "attachmentId",
          label: "Lampiran",
          type: "proof",
        },
      ]}
    />
  );
}

export default RevisionButton;
