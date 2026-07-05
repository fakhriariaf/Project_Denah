/**
 * finance.repo.ts
 *
 * Read-only query helpers for the Finance domain.
 * Centralises repetitive DB lookups so that finance server actions
 * stay focused on business logic (verify, approve, reject) rather than
 * inlining the same SELECT queries in multiple places.
 *
 * Usage: import from "@/server/repositories" or directly from this file.
 */

import { db } from "@/db";
import { financeAccounts, financeCategories } from "@/db/schema/master";
import { eq, and, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A finance account row as returned by Drizzle. */
export type FinanceAccount = typeof financeAccounts.$inferSelect;

// ---------------------------------------------------------------------------
// Query functions
// ---------------------------------------------------------------------------

/**
 * Fetch a single finance account (kas/bank) by its ID.
 * Returns `null` when the account does not exist.
 */
export async function getAccountById(accountId: string): Promise<FinanceAccount | null> {
  const [account] = await db
    .select()
    .from(financeAccounts)
    .where(eq(financeAccounts.id, accountId))
    .limit(1);

  return account ?? null;
}

/**
 * Resolve the income category ID to use when recording a verified payment.
 *
 * The lookup order is:
 * 1. Any income category whose name contains "pemasukan", "booking", "kpr", or "dp".
 * 2. Fallback: any income category at all.
 *
 * Throws a descriptive error when no income category is configured yet,
 * so the Admin is prompted to create one in Master Data → Kategori Keuangan.
 *
 * @param tx  A Drizzle transaction object (or the global `db` instance).
 * @returns   The resolved category ID.
 */
export async function getIncomeCategoryId(tx: typeof db): Promise<string> {
  // Primary: look for a revenue-oriented category by name
  const [primaryMatch] = await tx
    .select({ id: financeCategories.id })
    .from(financeCategories)
    .where(
      and(
        eq(financeCategories.type, "income"),
        sql`lower(${financeCategories.name}) LIKE '%pemasukan%'
          OR lower(${financeCategories.name}) LIKE '%booking%'
          OR lower(${financeCategories.name}) LIKE '%kpr%'
          OR lower(${financeCategories.name}) LIKE '%dp%'`
      )
    )
    .limit(1);

  if (primaryMatch) return primaryMatch.id;

  // Fallback: any income category
  const [fallback] = await tx
    .select({ id: financeCategories.id })
    .from(financeCategories)
    .where(eq(financeCategories.type, "income"))
    .limit(1);

  if (fallback) return fallback.id;

  throw new Error(
    "Kategori keuangan pemasukan belum dikonfigurasi. " +
    "Harap buat kategori pemasukan di menu Master terlebih dahulu."
  );
}
