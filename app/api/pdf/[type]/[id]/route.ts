import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/db";
import { bookings } from "@/db/schema/marketing";
import { invoices, payments } from "@/db/schema/finance";
import { customers, units, projects } from "@/db/schema/master";
import { user as userTable } from "@/db/schema/auth";
import { eq } from "drizzle-orm";

// Dynamic import to avoid issues with react-pdf in edge runtime
async function renderPdf(element: React.ReactElement): Promise<ArrayBuffer> {
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const buffer = await renderToBuffer(element as any);
  // Convert Node Buffer to ArrayBuffer for the Response constructor
  const ab = new ArrayBuffer(buffer.byteLength);
  const view = new Uint8Array(ab);
  view.set(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength));
  return ab;
}

function pdfResponse(body: ArrayBuffer, filename: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const { type, id } = await params;

  // Auth check
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    switch (type) {
      case "booking":
        return await generateBookingPdf(id);
      case "invoice":
        return await generateInvoicePdf(id);
      case "payment":
        return await generatePaymentPdf(id);
      case "bast":
        return await generateBastPdf(id);
      default:
        return NextResponse.json(
          { error: `Tipe dokumen "${type}" tidak valid. Gunakan: booking, invoice, payment, bast` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error(`[PDF] Error generating ${type} PDF:`, error);
    const message = error instanceof Error ? error.message : "Gagal generate PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── Booking Letter ───────────────────────────────────────────────────────────

async function generateBookingPdf(bookingId: string) {
  const [bookingData] = await db
    .select({
      bookingNumber: bookings.bookingNumber,
      bookingDate: bookings.bookingDate,
      bookingFee: bookings.bookingFee,
      dpAmount: bookings.dpAmount,
      paymentScheme: bookings.paymentScheme,
      termin: bookings.termin,
      customerName: customers.name,
      customerPhone: customers.phone,
      customerAddress: customers.address,
      customerNik: customers.nik,
      unitCode: units.code,
      unitCluster: units.cluster,
      unitTypeName: units.typeName,
      unitLandArea: units.landArea,
      unitBuildingArea: units.buildingArea,
      unitPrice: units.price,
      projectName: projects.name,
      projectLocation: projects.location,
      marketingName: userTable.name,
    })
    .from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .innerJoin(units, eq(bookings.unitId, units.id))
    .innerJoin(projects, eq(bookings.projectId, projects.id))
    .innerJoin(userTable, eq(bookings.marketingId, userTable.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!bookingData) {
    return NextResponse.json({ error: "Booking tidak ditemukan" }, { status: 404 });
  }

  const { BookingLetterTemplate } = await import("@/lib/pdf-templates/booking-letter");
  const React = await import("react");

  const element = React.createElement(BookingLetterTemplate, {
    data: {
      bookingNumber: bookingData.bookingNumber,
      bookingDate: bookingData.bookingDate,
      bookingFee: bookingData.bookingFee,
      dpAmount: bookingData.dpAmount,
      paymentScheme: bookingData.paymentScheme,
      termin: bookingData.termin,
      customer: {
        name: bookingData.customerName,
        phone: bookingData.customerPhone,
        address: bookingData.customerAddress,
        nik: bookingData.customerNik,
      },
      unit: {
        code: bookingData.unitCode,
        cluster: bookingData.unitCluster,
        typeName: bookingData.unitTypeName,
        landArea: bookingData.unitLandArea,
        buildingArea: bookingData.unitBuildingArea,
        price: bookingData.unitPrice,
      },
      project: {
        name: bookingData.projectName,
        location: bookingData.projectLocation,
      },
      marketing: {
        name: bookingData.marketingName,
      },
    },
  });

  const buffer = await renderPdf(element);

  return pdfResponse(buffer, `Surat_Booking_${bookingData.bookingNumber}.pdf`);
}

// ─── Invoice ──────────────────────────────────────────────────────────────────

async function generateInvoicePdf(invoiceId: string) {
  const [invoiceData] = await db
    .select({
      invoiceNumber: invoices.invoiceNumber,
      type: invoices.type,
      amount: invoices.amount,
      dueDate: invoices.dueDate,
      status: invoices.status,
      notes: invoices.notes,
      createdAt: invoices.createdAt,
      bookingId: invoices.bookingId,
      customerName: customers.name,
      customerPhone: customers.phone,
      customerAddress: customers.address,
      unitCode: units.code,
      projectName: projects.name,
    })
    .from(invoices)
    .leftJoin(customers, eq(invoices.customerId, customers.id))
    .leftJoin(units, eq(invoices.unitId, units.id))
    .innerJoin(projects, eq(invoices.projectId, projects.id))
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  if (!invoiceData) {
    return NextResponse.json({ error: "Invoice tidak ditemukan" }, { status: 404 });
  }

  // Get booking number if linked
  let bookingInfo: { bookingNumber: string } | null = null;
  if (invoiceData.bookingId) {
    const [b] = await db
      .select({ bookingNumber: bookings.bookingNumber })
      .from(bookings)
      .where(eq(bookings.id, invoiceData.bookingId))
      .limit(1);
    bookingInfo = b || null;
  }

  const { InvoiceTemplate } = await import("@/lib/pdf-templates/invoice");
  const React = await import("react");

  const element = React.createElement(InvoiceTemplate, {
    data: {
      invoiceNumber: invoiceData.invoiceNumber,
      type: invoiceData.type,
      amount: invoiceData.amount,
      dueDate: invoiceData.dueDate,
      status: invoiceData.status,
      notes: invoiceData.notes,
      createdAt: invoiceData.createdAt,
      customer: {
        name: invoiceData.customerName || "N/A",
        phone: invoiceData.customerPhone || "-",
        address: invoiceData.customerAddress,
      },
      unit: invoiceData.unitCode ? { code: invoiceData.unitCode } : null,
      project: { name: invoiceData.projectName },
      booking: bookingInfo,
    },
  });

  const buffer = await renderPdf(element);

  return pdfResponse(buffer, `Invoice_${invoiceData.invoiceNumber}.pdf`);
}

// ─── Payment Receipt ──────────────────────────────────────────────────────────

async function generatePaymentPdf(paymentId: string) {
  const [paymentData] = await db
    .select({
      paymentNumber: payments.paymentNumber,
      amount: payments.amount,
      paymentDate: payments.paymentDate,
      paymentMethod: payments.paymentMethod,
      status: payments.status,
      invoiceId: payments.invoiceId,
      verifiedBy: payments.verifiedBy,
      customerName: customers.name,
      customerPhone: customers.phone,
      customerAddress: customers.address,
      unitCode: units.code,
      projectName: projects.name,
    })
    .from(payments)
    .leftJoin(customers, eq(payments.customerId, customers.id))
    .leftJoin(units, eq(payments.unitId, units.id))
    .innerJoin(projects, eq(payments.projectId, projects.id))
    .where(eq(payments.id, paymentId))
    .limit(1);

  if (!paymentData) {
    return NextResponse.json({ error: "Payment tidak ditemukan" }, { status: 404 });
  }

  // Get invoice info if linked
  let invoiceInfo: { invoiceNumber: string; type: string } | null = null;
  if (paymentData.invoiceId) {
    const [inv] = await db
      .select({ invoiceNumber: invoices.invoiceNumber, type: invoices.type })
      .from(invoices)
      .where(eq(invoices.id, paymentData.invoiceId))
      .limit(1);
    invoiceInfo = inv || null;
  }

  // Get verifier name if present
  let verifierInfo: { name: string } | null = null;
  if (paymentData.verifiedBy) {
    const [v] = await db
      .select({ name: userTable.name })
      .from(userTable)
      .where(eq(userTable.id, paymentData.verifiedBy))
      .limit(1);
    verifierInfo = v || null;
  }

  const { PaymentReceiptTemplate } = await import("@/lib/pdf-templates/payment-receipt");
  const React = await import("react");

  const element = React.createElement(PaymentReceiptTemplate, {
    data: {
      paymentNumber: paymentData.paymentNumber,
      amount: paymentData.amount,
      paymentDate: paymentData.paymentDate,
      paymentMethod: paymentData.paymentMethod,
      status: paymentData.status,
      customer: {
        name: paymentData.customerName || "N/A",
        phone: paymentData.customerPhone || "-",
        address: paymentData.customerAddress,
      },
      invoice: invoiceInfo,
      unit: paymentData.unitCode ? { code: paymentData.unitCode } : null,
      project: { name: paymentData.projectName },
      verifiedBy: verifierInfo,
    },
  });

  const buffer = await renderPdf(element);

  return pdfResponse(buffer, `Kwitansi_${paymentData.paymentNumber}.pdf`);
}

// ─── BAST ─────────────────────────────────────────────────────────────────────

async function generateBastPdf(bookingId: string) {
  const [bookingData] = await db
    .select({
      bookingNumber: bookings.bookingNumber,
      bookingDate: bookings.bookingDate,
      customerName: customers.name,
      customerNik: customers.nik,
      customerPhone: customers.phone,
      customerAddress: customers.address,
      unitCode: units.code,
      unitCluster: units.cluster,
      unitTypeName: units.typeName,
      unitLandArea: units.landArea,
      unitBuildingArea: units.buildingArea,
      projectName: projects.name,
      projectLocation: projects.location,
    })
    .from(bookings)
    .innerJoin(customers, eq(bookings.customerId, customers.id))
    .innerJoin(units, eq(bookings.unitId, units.id))
    .innerJoin(projects, eq(bookings.projectId, projects.id))
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (!bookingData) {
    return NextResponse.json({ error: "Booking tidak ditemukan" }, { status: 404 });
  }

  const { BastTemplate } = await import("@/lib/pdf-templates/bast");
  const React = await import("react");

  const element = React.createElement(BastTemplate, {
    data: {
      bookingNumber: bookingData.bookingNumber,
      bookingDate: bookingData.bookingDate,
      handoverDate: null, // Will use current date
      customer: {
        name: bookingData.customerName,
        nik: bookingData.customerNik,
        phone: bookingData.customerPhone,
        address: bookingData.customerAddress,
      },
      unit: {
        code: bookingData.unitCode,
        cluster: bookingData.unitCluster,
        typeName: bookingData.unitTypeName,
        landArea: bookingData.unitLandArea,
        buildingArea: bookingData.unitBuildingArea,
      },
      project: {
        name: bookingData.projectName,
        location: bookingData.projectLocation,
      },
    },
  });

  const buffer = await renderPdf(element);

  return pdfResponse(buffer, `BAST_${bookingData.bookingNumber}.pdf`);
}
