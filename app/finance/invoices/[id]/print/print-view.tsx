"use client";

import { useRouter } from "next/navigation";
import { InvoicePrintModal } from "@/components/invoice-print-modal";

/**
 * Client wrapper for the invoice print route (`/finance/invoices/[id]/print`).
 *
 * Renders the shared `InvoicePrintModal` (which owns the print CSS + the
 * "Cetak / Simpan PDF" action) as the full content of the dedicated print tab.
 * Because this route is opened in a new browser tab (target="_blank" on the
 * detail page's "Cetak Invoice" button), "Tutup" navigates back to the invoice
 * detail page rather than relying on window.close() (which browsers may block).
 */
export function InvoicePrintView({
  invoice,
  payments,
}: {
  invoice: React.ComponentProps<typeof InvoicePrintModal>["invoice"];
  payments: React.ComponentProps<typeof InvoicePrintModal>["payments"];
}) {
  const router = useRouter();

  return (
    <InvoicePrintModal
      invoice={invoice}
      payments={payments}
      onClose={() => router.push(`/finance/invoices/${invoice.id}`)}
    />
  );
}

export default InvoicePrintView;
