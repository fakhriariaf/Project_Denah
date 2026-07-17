import { db } from "@/db";
import { invoices, payments } from "@/db/schema/finance";
import { projects, units, customers } from "@/db/schema/master";
import { attachments } from "@/db/schema/system";
import { eq, desc } from "drizzle-orm";
import { requireAuth, getSessionRole } from "@/server/permissions";
import { redirect, notFound } from "next/navigation";
import { InvoicePrintView } from "./print-view";

export const revalidate = 0;

/**
 * Invoice print route — `/finance/invoices/[id]/print`.
 *
 * Server component that reuses the same invoice data-loading and read-gate
 * behaviour as the invoice detail page, then renders a print-friendly view via
 * the shared `InvoicePrintModal` (labels centralized through
 * `lib/label-helpers.ts`). Opened in a new tab from the detail page's
 * "Cetak Invoice" button.
 *
 * - Auth: `requireAuth()` (unauthenticated → login with session-expired).
 * - Read gate: isSuperAdmin || isKeuangan || isDireksi || isAdminKantor
 *   (preserves isAdminKantor view access), else redirect("/unauthorized").
 * - `notFound()` for a missing invoice.
 */
export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const activeUser = await requireAuth();
  const { isSuperAdmin, isKeuangan, isDireksi, isAdminKantor } = await getSessionRole(
    activeUser.id,
  );

  const hasAccess = isSuperAdmin || isKeuangan || isDireksi || isAdminKantor;
  if (!hasAccess) {
    redirect("/unauthorized");
  }

  // Fetch invoice with the relations the print view needs.
  const [invoice] = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      type: invoices.type,
      amount: invoices.amount,
      dueDate: invoices.dueDate,
      status: invoices.status,
      notes: invoices.notes,
      createdAt: invoices.createdAt,
      bookingId: invoices.bookingId,
      projectName: projects.name,
      customerName: customers.name,
      unitCode: units.code,
    })
    .from(invoices)
    .innerJoin(projects, eq(invoices.projectId, projects.id))
    .leftJoin(customers, eq(invoices.customerId, customers.id))
    .leftJoin(units, eq(invoices.unitId, units.id))
    .where(eq(invoices.id, id))
    .limit(1);

  if (!invoice) {
    notFound();
  }

  // Payments linked to this invoice (proof file resolved via attachments join).
  const paymentsList = await db
    .select({
      id: payments.id,
      invoiceId: payments.invoiceId,
      paymentNumber: payments.paymentNumber,
      amount: payments.amount,
      paymentDate: payments.paymentDate,
      paymentMethod: payments.paymentMethod,
      proofFileUrl: attachments.fileUrl,
      status: payments.status,
      verifiedAt: payments.verifiedAt,
    })
    .from(payments)
    .leftJoin(attachments, eq(payments.proofAttachmentId, attachments.id))
    .where(eq(payments.invoiceId, id))
    .orderBy(desc(payments.paymentDate));

  return <InvoicePrintView invoice={invoice} payments={paymentsList} />;
}
