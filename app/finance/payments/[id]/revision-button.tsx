"use client";

/**
 * RevisionButton — app/finance/payments/[id]/revision-button.tsx (Task 6.2)
 *
 * Thin payment-specific wrapper around the generic, config-driven
 * `RevisionDialog`. It configures the editable payment fields (amount, payment
 * date, payment method, proof attachment), keeps the document number and
 * creation date read-only (Req 4.2), surfaces the rejection reason as a
 * prominent inline notice (Req 4.1), and wires the two-step server actions:
 * `startPaymentRevision` (called on open) and `resubmitPaymentRevision` (called
 * on submit). Field errors keep the dialog open with entered data preserved
 * (Req 4.15). Visibility is gated by the page to Admin Keuangan / Super Admin
 * (Req 6.5).
 *
 * _Requirements: 4.1, 4.2, 4.15, 6.5_
 */

import { RevisionDialog } from "@/components/finance/revision-dialog";
import {
  startPaymentRevision,
  resubmitPaymentRevision,
} from "@/server/actions/finance-revision";
import { getPaymentMethodLabel } from "@/lib/label-helpers";

export type PaymentRevisionInitialValues = Record<string, string> & {
  amount: string;
  paymentDate: string; // yyyy-mm-dd (for <input type="date">)
  paymentMethod: string;
  proofAttachmentId: string;
};

export function RevisionButton({
  paymentId,
  rejectionReason,
  paymentNumber,
  createdAt,
  initialValues,
}: {
  paymentId: string;
  rejectionReason: string | null;
  paymentNumber: string;
  createdAt: string;
  initialValues: PaymentRevisionInitialValues;
}) {
  return (
    <RevisionDialog
      entityId={paymentId}
      triggerLabel="Revisi Pembayaran"
      title="Revisi Pembayaran"
      description="Perbaiki data pembayaran yang ditolak lalu ajukan ulang untuk verifikasi."
      successMessage="Pembayaran berhasil diajukan ulang untuk verifikasi."
      rejectionReason={rejectionReason}
      startAction={startPaymentRevision}
      resubmitAction={resubmitPaymentRevision}
      readOnlyFields={[
        { label: "Nomor Pembayaran", value: paymentNumber, mono: true },
        { label: "Tanggal Dibuat", value: createdAt },
      ]}
      initialValues={initialValues}
      fields={[
        {
          name: "amount",
          label: "Jumlah Pembayaran",
          type: "amount",
          required: true,
          placeholder: "0",
        },
        {
          name: "paymentDate",
          label: "Tanggal Pembayaran",
          type: "date",
          required: true,
        },
        {
          name: "paymentMethod",
          label: "Metode Pembayaran",
          type: "select",
          required: true,
          options: [
            { value: "cash", label: getPaymentMethodLabel("cash") },
            { value: "transfer", label: getPaymentMethodLabel("transfer") },
            { value: "giro", label: getPaymentMethodLabel("giro") },
            { value: "other", label: getPaymentMethodLabel("other") },
          ],
        },
        {
          name: "proofAttachmentId",
          label: "Bukti Pembayaran",
          type: "proof",
        },
      ]}
    />
  );
}

export default RevisionButton;
