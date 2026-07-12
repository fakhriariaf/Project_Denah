CREATE INDEX IF NOT EXISTS "idx_invoices_project_created" ON "invoices" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payments_project_created" ON "payments" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_payments_invoice_status" ON "payments" USING btree ("invoice_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_created_at" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_user_read" ON "notifications" USING btree ("user_id","is_read");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notifications_entity" ON "notifications" USING btree ("entity_id","entity_type");