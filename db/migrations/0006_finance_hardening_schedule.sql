-- =============================================================================
-- Migration: 0006_finance_hardening_schedule.sql
-- Spec: finance-flow-hardening-and-installment-schedule
-- =============================================================================
-- Entirely additive: ADD COLUMN, CREATE INDEX only. No DROP/ALTER TYPE/RENAME.
--
-- payments.status = "voided" does NOT require DDL — column is unconstrained
-- plain text (no CHECK constraint, no DB enum). Only TypeScript union updated.
--
-- IMPORTANT: The partial unique index "uniq_income_per_payment" (step 9)
-- REQUIRES the pre-migration blocking audit to pass first.
-- Run db/scripts/audit-uniq-income-per-payment.ts and confirm exit code 0
-- before applying this migration.
--
-- DO NOT apply this migration without explicit approval.
-- =============================================================================

-- Step 1: invoices.schedule_kind
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "schedule_kind" text;--> statement-breakpoint
-- Step 2: invoices.schedule_sequence
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "schedule_sequence" integer;--> statement-breakpoint
-- Step 3: invoices.schedule_label
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "schedule_label" text;--> statement-breakpoint
-- Step 4: Composite index for schedule identity & lookup
CREATE INDEX IF NOT EXISTS "idx_invoices_booking_schedule" ON "invoices" ("booking_id", "schedule_kind", "schedule_sequence");--> statement-breakpoint
-- Step 5: transactions.reversal_of_payment_id
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "reversal_of_payment_id" text;--> statement-breakpoint
-- Step 6: FK constraint for reversal_of_payment_id -> payments.id
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_reversal_of_payment_id_payments_id_fk" FOREIGN KEY ("reversal_of_payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Step 7: payments.uploaded_by
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "uploaded_by" text;--> statement-breakpoint
-- Step 8: FK constraint for uploaded_by -> user.id
ALTER TABLE "payments" ADD CONSTRAINT "payments_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Step 9: Partial unique index — idempotency income non-reversal per payment
-- ⚠️  REQUIRES pre-migration audit to pass: db/scripts/audit-uniq-income-per-payment.ts
--     must exit 0 (zero violations) BEFORE this index is created.
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_income_per_payment" ON "transactions" ("payment_id") WHERE "payment_id" IS NOT NULL AND "type" = 'income' AND "reversal_of_payment_id" IS NULL;
