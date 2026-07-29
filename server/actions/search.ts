"use server";

import { db } from "@/db";
import { units, projects } from "@/db/schema/master";
import { bookings, leads } from "@/db/schema/marketing";
import { invoices } from "@/db/schema/finance";
import { spks } from "@/db/schema/production";
import { ilike, or } from "drizzle-orm";
import { z } from "zod";
import { requireAnyRole, FINANCE_MODULE_ROLES } from "@/server/permissions";
import { applyRateLimit } from "@/server/middleware/apply-rate-limit";

/** Global search keyword guard: trimmed, 2..100 chars. */
const searchQuerySchema = z.string().trim().min(2).max(100);

/**
 * Escapes PostgreSQL LIKE/ILIKE metacharacters. Drizzle parameterises the value,
 * so this is not SQL injection — but an unescaped `%` still widens the pattern
 * and makes the search return unrelated rows.
 */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export interface SearchResult {
  id: string;
  type: "unit" | "project" | "booking" | "invoice" | "spk" | "lead" | "user";
  title: string;
  subtitle: string;
  href: string;
}

/**
 * Global search across multiple entities.
 * Returns max 5 results per category, sorted by relevance.
 */
export async function globalSearch(query: string): Promise<SearchResult[]> {
  // P1 BUGFIX: the previous role-set contained "Finance", which is not a role that
  // exists in `getSessionRole` — the actual finance role is "Admin Keuangan".
  // Every Admin Keuangan account was therefore redirected to /unauthorized when
  // using global search. Reuses FINANCE_MODULE_ROLES (identical 7-role set) so the
  // list stays in sync; this does not widen access.
  const user = await requireAnyRole([...FINANCE_MODULE_ROLES]);
  applyRateLimit(user.id, "search");

  // Runtime validation: short queries produce table-wide LIKE scans, long ones are
  // pure abuse. Invalid input returns an empty result instead of throwing.
  const parsed = searchQuerySchema.safeParse(query);
  if (!parsed.success) return [];

  // Escape LIKE metacharacters so a keyword such as "50%" or "INV_" matches
  // literally instead of turning into a wildcard scan.
  const q = `%${escapeLikePattern(parsed.data)}%`;
  const results: SearchResult[] = [];

  // Run all searches in parallel for performance
  const [unitRes, projectRes, bookingRes, invoiceRes, spkRes, leadRes] = await Promise.allSettled([
    // Search Units
    db.select({ id: units.id, code: units.code, cluster: units.cluster, projectId: units.projectId })
      .from(units)
      .where(or(ilike(units.code, q), ilike(units.cluster, q)))
      .limit(5),
    // Search Projects
    db.select({ id: projects.id, name: projects.name, code: projects.code })
      .from(projects)
      .where(or(ilike(projects.name, q), ilike(projects.code, q)))
      .limit(5),
    // Search Bookings
    db.select({ id: bookings.id, bookingNumber: bookings.bookingNumber })
      .from(bookings)
      .where(ilike(bookings.bookingNumber, q))
      .limit(5),
    // Search Invoices
    db.select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber })
      .from(invoices)
      .where(ilike(invoices.invoiceNumber, q))
      .limit(5),
    // Search SPKs
    db.select({ id: spks.id, spkNumber: spks.spkNumber, title: spks.title })
      .from(spks)
      .where(or(ilike(spks.spkNumber, q), ilike(spks.title, q)))
      .limit(5),
    // Search Leads
    db.select({ id: leads.id, name: leads.name, phone: leads.phone })
      .from(leads)
      .where(or(ilike(leads.name, q), ilike(leads.phone, q)))
      .limit(5),
  ]);

  // Process results — skip failed queries gracefully
  if (unitRes.status === "fulfilled") {
    for (const u of unitRes.value) {
      results.push({ id: u.id, type: "unit", title: u.code || "Unit", subtitle: u.cluster || "", href: `/siteplan/${u.projectId}` });
    }
  }
  if (projectRes.status === "fulfilled") {
    for (const p of projectRes.value) {
      results.push({ id: p.id, type: "project", title: p.name, subtitle: p.code || "", href: `/siteplan/${p.id}` });
    }
  }
  if (bookingRes.status === "fulfilled") {
    for (const b of bookingRes.value) {
      results.push({ id: b.id, type: "booking", title: b.bookingNumber || "Booking", subtitle: "", href: `/marketing/bookings/${b.id}` });
    }
  }
  if (invoiceRes.status === "fulfilled") {
    for (const inv of invoiceRes.value) {
      results.push({ id: inv.id, type: "invoice", title: inv.invoiceNumber || "Invoice", subtitle: "", href: `/finance/invoices/${inv.id}` });
    }
  }
  if (spkRes.status === "fulfilled") {
    for (const s of spkRes.value) {
      results.push({ id: s.id, type: "spk", title: s.spkNumber || "SPK", subtitle: s.title || "", href: `/production` });
    }
  }
  if (leadRes.status === "fulfilled") {
    for (const l of leadRes.value) {
      results.push({ id: l.id, type: "lead", title: l.name || "Lead", subtitle: l.phone || "", href: `/marketing/leads` });
    }
  }

  return results;
}
