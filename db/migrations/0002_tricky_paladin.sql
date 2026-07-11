CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"recipient_id" text NOT NULL,
	"content" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_presence" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"last_heartbeat" timestamp NOT NULL,
	"status" text DEFAULT 'offline' NOT NULL,
	CONSTRAINT "user_presence_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "endpoint" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "level" text DEFAULT 'log' NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "status" text DEFAULT 'success' NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "response_code" integer DEFAULT 200;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "duration_ms" integer;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_recipient_id_user_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_presence" ADD CONSTRAINT "user_presence_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_messages_conversation_id" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_messages_created_at" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_messages_recipient_unread" ON "messages" USING btree ("recipient_id","is_read");--> statement-breakpoint
CREATE INDEX "idx_user_presence_user_id" ON "user_presence" USING btree ("user_id");