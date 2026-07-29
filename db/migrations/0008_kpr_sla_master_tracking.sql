-- 0008_kpr_sla_master_tracking.sql
-- Drizzle migration. Apply only through `npx.cmd drizzle-kit migrate` after
-- the mandatory pre-migration audit passes. Do not run this file manually with
-- psql: doing so would make Drizzle's migration history diverge from the DB.
--
-- PRE-MIGRATION AUDIT REQUIRED:
-- Run `npx.cmd tsx db/scripts/audit-kpr-sla-pre-migration.ts` before applying.
-- The audit verifies that referenced tables (kpr_processes, projects, user)
-- exist and that the new table names are not already taken.
--
-- This migration is ADDITIVE ONLY:
-- - No DROP, RENAME, ALTER TYPE, or data cleanup.
-- - Two new tables: kpr_sla_configs, kpr_stage_visits.
-- - CHECK constraints, partial unique indexes, and query indexes.

-- ─── Table: kpr_sla_configs ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "kpr_sla_configs" (
  "id" text PRIMARY KEY NOT NULL,
  "scope" text NOT NULL,
  "project_id" text,
  "stage" text NOT NULL,
  "working_days" integer NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_by" text,
  "updated_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Foreign keys for kpr_sla_configs
ALTER TABLE "kpr_sla_configs" ADD CONSTRAINT "kpr_sla_configs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION;--> statement-breakpoint
ALTER TABLE "kpr_sla_configs" ADD CONSTRAINT "kpr_sla_configs_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;--> statement-breakpoint
ALTER TABLE "kpr_sla_configs" ADD CONSTRAINT "kpr_sla_configs_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;--> statement-breakpoint

-- CHECK constraints for kpr_sla_configs
ALTER TABLE "kpr_sla_configs" ADD CONSTRAINT "chk_kpr_sla_working_days" CHECK ("working_days" BETWEEN 1 AND 60);--> statement-breakpoint
ALTER TABLE "kpr_sla_configs" ADD CONSTRAINT "chk_kpr_sla_scope_project" CHECK (("scope" = 'global' AND "project_id" IS NULL) OR ("scope" = 'perumahan' AND "project_id" IS NOT NULL));--> statement-breakpoint

-- Partial unique indexes for kpr_sla_configs (active config uniqueness)
CREATE UNIQUE INDEX IF NOT EXISTS "uq_kpr_sla_active_global" ON "kpr_sla_configs" ("stage") WHERE "is_active" = true AND "scope" = 'global';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_kpr_sla_active_perumahan" ON "kpr_sla_configs" ("project_id", "stage") WHERE "is_active" = true AND "scope" = 'perumahan';--> statement-breakpoint

-- Resolver index for kpr_sla_configs
CREATE INDEX IF NOT EXISTS "idx_kpr_sla_resolve" ON "kpr_sla_configs" ("project_id", "stage", "is_active");--> statement-breakpoint

-- ─── Table: kpr_stage_visits ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "kpr_stage_visits" (
  "id" text PRIMARY KEY NOT NULL,
  "kpr_process_id" text NOT NULL,
  "project_id" text NOT NULL,
  "stage" text NOT NULL,
  "visit_seq" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "previous_stage" text,
  "next_stage" text,
  "entered_at" timestamp NOT NULL,
  "exited_at" timestamp,
  "target_working_days" integer NOT NULL,
  "sla_source" text NOT NULL,
  "config_id" text,
  "sla_start_at" timestamp NOT NULL,
  "sla_deadline_at" timestamp NOT NULL,
  "sla_result" text,
  "transition_actor_id" text,
  "revision_notes" text,
  "data_quality" text NOT NULL DEFAULT 'normal',
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Foreign keys for kpr_stage_visits
ALTER TABLE "kpr_stage_visits" ADD CONSTRAINT "kpr_stage_visits_kpr_process_id_kpr_processes_id_fk" FOREIGN KEY ("kpr_process_id") REFERENCES "kpr_processes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;--> statement-breakpoint
ALTER TABLE "kpr_stage_visits" ADD CONSTRAINT "kpr_stage_visits_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION;--> statement-breakpoint
ALTER TABLE "kpr_stage_visits" ADD CONSTRAINT "kpr_stage_visits_config_id_kpr_sla_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "kpr_sla_configs"("id") ON DELETE SET NULL ON UPDATE NO ACTION;--> statement-breakpoint
ALTER TABLE "kpr_stage_visits" ADD CONSTRAINT "kpr_stage_visits_transition_actor_id_user_id_fk" FOREIGN KEY ("transition_actor_id") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;--> statement-breakpoint

-- Partial unique index: satu kunjungan aktif per KPR (Req 5.7/19.4)
CREATE UNIQUE INDEX IF NOT EXISTS "uq_kpr_stage_visit_active" ON "kpr_stage_visits" ("kpr_process_id") WHERE "status" = 'active';--> statement-breakpoint

-- Unique index: visit sequence per KPR (Req 8.2/19.6)
CREATE UNIQUE INDEX IF NOT EXISTS "uq_kpr_stage_visit_seq" ON "kpr_stage_visits" ("kpr_process_id", "visit_seq");--> statement-breakpoint

-- Timeline index
CREATE INDEX IF NOT EXISTS "idx_kpr_stage_visit_timeline" ON "kpr_stage_visits" ("kpr_process_id", "entered_at");--> statement-breakpoint

-- KPI index
CREATE INDEX IF NOT EXISTS "idx_kpr_stage_visit_kpi" ON "kpr_stage_visits" ("project_id", "status", "stage");
