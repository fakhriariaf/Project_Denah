-- 0007_material_request_income_hardening.sql
-- Drizzle migration. Apply only through `npx.cmd drizzle-kit migrate` after
-- the mandatory pre-migration audit passes. Do not run this file manually with
-- psql: doing so would make Drizzle's migration history diverge from the DB.
--
-- Step 1: Speed up the material-request loop lookup (finance approve/reject to material).
-- Non-unique because it is a 1:1 by design but not DB-enforced.
CREATE INDEX IF NOT EXISTS "idx_transactions_material_request" ON "transactions" ("material_request_id") WHERE "material_request_id" IS NOT NULL;--> statement-breakpoint
-- Step 2: Partial unique index for idempotency of KPR realisation income.
-- IMPORTANT: Pre-migration audit REQUIRED: ensure there is at most one non-reversal income
-- transaction per kpr_process_id BEFORE creating this index, otherwise it fails.
-- Query to check duplicates:
--   SELECT kpr_process_id, COUNT(*) FROM transactions
--   WHERE kpr_process_id IS NOT NULL AND type = 'income' AND reversal_of_transaction_id IS NULL
--   GROUP BY kpr_process_id HAVING COUNT(*) > 1;
-- Run `npx.cmd tsx db/scripts/audit-uniq-income-per-kpr.ts` before migration.
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_income_per_kpr" ON "transactions" ("kpr_process_id") WHERE "kpr_process_id" IS NOT NULL AND "type" = 'income' AND "reversal_of_transaction_id" IS NULL;
