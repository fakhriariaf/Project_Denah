CREATE TABLE "finance_activity_history" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"from_status" text,
	"to_status" text,
	"reason" text,
	"snapshot_before" jsonb,
	"snapshot_after" jsonb,
	"actor_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "finance_activity_history" ADD CONSTRAINT "finance_activity_history_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_fin_activity_entity" ON "finance_activity_history" USING btree ("entity_type","entity_id");