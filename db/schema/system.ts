import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, boolean, integer, jsonb, index } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  action: text("action").notNull(), // 'login','logout','create','update','delete','approve','reject'
  module: text("module").notNull(), // 'auth','master','marketing','finance','production'
  entityId: text("entity_id"),
  entityType: text("entity_type"),
  details: jsonb("details"), // JSONB details
  ipAddress: text("ip_address"),
  endpoint: text("endpoint"), // URL path that was hit (e.g. '/api/auth/sign-in/email', '/marketing/bookings')
  level: text("level").default("log").notNull(), // 'log', 'info', 'error'
  status: text("status").default("success").notNull(), // 'success', 'failed'
  responseCode: integer("response_code").default(200),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => ({
  createdAtIdx: index("idx_audit_logs_created_at").on(table.createdAt),
}));

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(), // 'approval_pending','kpr_sla','spk_overdue','progress_done'
  title: text("title").notNull(),
  message: text("message").notNull(),
  entityId: text("entity_id"),
  entityType: text("entity_type"),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (table) => ({
  userReadIdx: index("idx_notifications_user_read").on(table.userId, table.isRead),
  entityIdx: index("idx_notifications_entity").on(table.entityId, table.entityType),
}));

export const attachments = pgTable("attachments", {
  id: text("id").primaryKey(),
  entityId: text("entity_id").notNull(),
  entityType: text("entity_type").notNull(), // 'unit','customer','vendor','spk','booking'
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(), // Supabase Storage URL
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  uploadedBy: text("uploaded_by").references(() => user.id),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const appSettings = pgTable("app_settings", {
  id: text("id").primaryKey(),
  key: text("key").unique().notNull(),
  value: text("value"),
  description: text("description"),
  updatedBy: text("updated_by").references(() => user.id),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});
