/**
 * booking.repo.ts
 *
 * Read-only query helpers for the Booking domain.
 * These functions encapsulate the database JOINs so that server actions
 * can stay focused on business logic and mutation work.
 *
 * Usage: import from "@/server/repositories" or directly from this file.
 */

import { db } from "@/db";
import { bookings } from "@/db/schema/marketing";
import { invoices, payments } from "@/db/schema/finance";
import { units, customers, projects } from "@/db/schema/master";
import { user as userTable } from "@/db/schema/auth";
import { eq, desc } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Full booking row with joined project, unit, and customer data. */
export interface BookingWithDetails {
  id: string;
  bookingNumber: string;
  bookingDate: Date;
  bookingFee: number;
  dpAmount: number;
  paymentScheme: string;
  status: string;
  cancellationReason: string | null;
  marketingId: string | null;
  projectId: string;
  unitId: string;
  customerId: string;
  termin: number | null;
  projectName: string | null;
  unitCode: string | null;
  unitStatus: string | null;
  landArea: number | null;
  buildingArea: number | null;
  price: number | null;
  customerName: string | null;
  customerPhone: string | null;
  marketingName: string | null;
}

/** Booking row with associated invoices and their payments. */
export interface BookingWithInvoices {
  booking: typeof bookings.$inferSelect;
  invoices: Array<
    typeof invoices.$inferSelect & {
      payments: Array<typeof payments.$inferSelect>;
    }
  >;
}

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

/**
 * Fetch a single booking by its ID, with project, unit, and customer JOINed.
 * Returns `null` when the booking does not exist.
 */
export async function getBookingById(id: string): Promise<BookingWithDetails | null> {
  const [row] = await db
    .select({
      id: bookings.id,
      bookingNumber: bookings.bookingNumber,
      bookingDate: bookings.bookingDate,
      bookingFee: bookings.bookingFee,
      dpAmount: bookings.dpAmount,
      paymentScheme: bookings.paymentScheme,
      status: bookings.status,
      cancellationReason: bookings.cancellationReason,
      marketingId: bookings.marketingId,
      projectId: bookings.projectId,
      unitId: bookings.unitId,
      customerId: bookings.customerId,
      termin: bookings.termin,
      projectName: projects.name,
      unitCode: units.code,
      unitStatus: units.status,
      landArea: units.landArea,
      buildingArea: units.buildingArea,
      price: units.price,
      customerName: customers.name,
      customerPhone: customers.phone,
      marketingName: userTable.name,
    })
    .from(bookings)
    .leftJoin(projects, eq(bookings.projectId, projects.id))
    .leftJoin(units, eq(bookings.unitId, units.id))
    .leftJoin(customers, eq(bookings.customerId, customers.id))
    .leftJoin(userTable, eq(bookings.marketingId, userTable.id))
    .where(eq(bookings.id, id))
    .limit(1);

  return row ?? null;
}

/**
 * Fetch a booking along with all of its invoices and the payments on each invoice.
 * Returns `null` when the booking does not exist.
 */
export async function getBookingWithInvoices(id: string): Promise<BookingWithInvoices | null> {
  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, id))
    .limit(1);

  if (!booking) return null;

  const bookingInvoices = await db
    .select()
    .from(invoices)
    .where(eq(invoices.bookingId, id))
    .orderBy(desc(invoices.createdAt));

  const invoicesWithPayments = await Promise.all(
    bookingInvoices.map(async (invoice) => {
      const invoicePayments = await db
        .select()
        .from(payments)
        .where(eq(payments.invoiceId, invoice.id))
        .orderBy(desc(payments.createdAt));
      return { ...invoice, payments: invoicePayments };
    })
  );

  return { booking, invoices: invoicesWithPayments };
}
