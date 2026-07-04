CREATE INDEX "idx_transactions_created_at" ON "transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_bookings_status" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_bookings_booking_date" ON "bookings" USING btree ("booking_date");--> statement-breakpoint
CREATE INDEX "idx_units_status" ON "units" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_units_project_id" ON "units" USING btree ("project_id");
