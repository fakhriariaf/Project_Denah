"use server";

import { db } from "@/db";
import { requireAuth } from "@/server/permissions";
import { eq, desc } from "drizzle-orm";

import { unitStatusHistories } from "@/db/schema/master";
import { bookings, bookingStatusHistories, kprProcesses } from "@/db/schema/marketing";
import { invoices, payments } from "@/db/schema/finance";
import { spks, spkProgressLogs } from "@/db/schema/production";

export interface TimelineEvent {
  id: string;
  type: "status_change" | "booking" | "booking_status" | "kpr" | "invoice" | "payment" | "spk" | "progress" | "bast";
  title: string;
  description?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Get the full activity timeline for a specific unit.
 * Pulls events from multiple tables and merges them into a sorted timeline.
 */
export async function getUnitTimeline(unitId: string): Promise<TimelineEvent[]> {
  await requireAuth();

  if (!unitId) return [];

  const events: TimelineEvent[] = [];

  // 1. Unit Status Histories
  const statusHistories = await db
    .select()
    .from(unitStatusHistories)
    .where(eq(unitStatusHistories.unitId, unitId))
    .orderBy(desc(unitStatusHistories.changedAt));

  for (const sh of statusHistories) {
    events.push({
      id: sh.id,
      type: "status_change",
      title: `Status berubah: ${sh.previousStatus ?? "—"} → ${sh.newStatus}`,
      description: sh.reason ?? undefined,
      timestamp: sh.changedAt,
      metadata: {
        previousStatus: sh.previousStatus,
        newStatus: sh.newStatus,
        changedBy: sh.changedBy,
      },
    });
  }

  // 2. Bookings for this unit
  const unitBookings = await db
    .select()
    .from(bookings)
    .where(eq(bookings.unitId, unitId))
    .orderBy(desc(bookings.createdAt));

  for (const bk of unitBookings) {
    events.push({
      id: `booking-${bk.id}`,
      type: "booking",
      title: `Booking dibuat: ${bk.bookingNumber}`,
      description: `Skema: ${bk.paymentScheme} | Status: ${bk.status}`,
      timestamp: bk.bookingDate,
      metadata: {
        bookingId: bk.id,
        bookingNumber: bk.bookingNumber,
        paymentScheme: bk.paymentScheme,
        status: bk.status,
      },
    });

    // 3. Booking Status Histories (joined via booking)
    const bkStatusHistories = await db
      .select()
      .from(bookingStatusHistories)
      .where(eq(bookingStatusHistories.bookingId, bk.id))
      .orderBy(desc(bookingStatusHistories.changedAt));

    for (const bsh of bkStatusHistories) {
      events.push({
        id: bsh.id,
        type: "booking_status",
        title: `Status booking: ${bsh.previousStatus ?? "—"} → ${bsh.newStatus}`,
        description: bsh.notes ?? undefined,
        timestamp: bsh.changedAt,
        metadata: {
          bookingId: bk.id,
          bookingNumber: bk.bookingNumber,
          previousStatus: bsh.previousStatus,
          newStatus: bsh.newStatus,
        },
      });
    }

    // 4. KPR Processes (joined via booking)
    const kprList = await db
      .select()
      .from(kprProcesses)
      .where(eq(kprProcesses.bookingId, bk.id))
      .orderBy(desc(kprProcesses.createdAt));

    for (const kpr of kprList) {
      events.push({
        id: `kpr-${kpr.id}`,
        type: "kpr",
        title: `KPR: ${kpr.status}`,
        description: kpr.akadDate
          ? `Akad: ${kpr.akadDate.toLocaleDateString("id-ID")}`
          : kpr.realizedDate
            ? `Realisasi: ${kpr.realizedDate.toLocaleDateString("id-ID")}`
            : undefined,
        timestamp: kpr.updatedAt ?? kpr.createdAt,
        metadata: {
          kprId: kpr.id,
          status: kpr.status,
          akadDate: kpr.akadDate,
          realizedDate: kpr.realizedDate,
        },
      });
    }
  }

  // 5. Invoices for this unit
  const unitInvoices = await db
    .select()
    .from(invoices)
    .where(eq(invoices.unitId, unitId))
    .orderBy(desc(invoices.createdAt));

  for (const inv of unitInvoices) {
    events.push({
      id: `invoice-${inv.id}`,
      type: "invoice",
      title: `Invoice: ${inv.invoiceNumber}`,
      description: `${inv.type} — Rp ${inv.amount.toLocaleString("id-ID")} | ${inv.status}`,
      timestamp: inv.createdAt,
      metadata: {
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        type: inv.type,
        amount: inv.amount,
        status: inv.status,
      },
    });
  }

  // 6. Payments for this unit
  const unitPayments = await db
    .select()
    .from(payments)
    .where(eq(payments.unitId, unitId))
    .orderBy(desc(payments.paymentDate));

  for (const pay of unitPayments) {
    events.push({
      id: `payment-${pay.id}`,
      type: "payment",
      title: `Pembayaran: ${pay.paymentNumber}`,
      description: `Rp ${pay.amount.toLocaleString("id-ID")} | ${pay.status}${pay.verifiedAt ? ` (verified)` : ""}`,
      timestamp: pay.paymentDate,
      metadata: {
        paymentId: pay.id,
        paymentNumber: pay.paymentNumber,
        amount: pay.amount,
        status: pay.status,
        verifiedAt: pay.verifiedAt,
      },
    });
  }

  // 7. SPKs for this unit
  const unitSpks = await db
    .select()
    .from(spks)
    .where(eq(spks.unitId, unitId))
    .orderBy(desc(spks.createdAt));

  for (const spk of unitSpks) {
    events.push({
      id: `spk-${spk.id}`,
      type: "spk",
      title: `SPK: ${spk.spkNumber}`,
      description: `${spk.title} | Progress: ${spk.progressPct}% | ${spk.status}`,
      timestamp: spk.createdAt,
      metadata: {
        spkId: spk.id,
        spkNumber: spk.spkNumber,
        status: spk.status,
        startDate: spk.startDate,
        progressPct: spk.progressPct,
      },
    });

    // 8. SPK Progress Logs (joined via spk)
    const progressLogs = await db
      .select()
      .from(spkProgressLogs)
      .where(eq(spkProgressLogs.spkId, spk.id))
      .orderBy(desc(spkProgressLogs.progressDate));

    for (const log of progressLogs) {
      events.push({
        id: log.id,
        type: "progress",
        title: `Progress +${log.percentageAdded}% → ${log.currentTotalPct}%`,
        description: log.notes ?? undefined,
        timestamp: log.progressDate,
        metadata: {
          spkId: spk.id,
          spkNumber: spk.spkNumber,
          percentageAdded: log.percentageAdded,
          currentTotalPct: log.currentTotalPct,
        },
      });
    }
  }

  // Sort all events by timestamp descending (newest first)
  events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return events;
}
