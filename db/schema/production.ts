import { pgTable, text, timestamp, doublePrecision, integer } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { projects, units, customers, vendors } from "./master";
import { user } from "./auth";
import { transactions } from "./finance";
import { attachments } from "./system";
import { bookings } from "./marketing";

const defaultCreatedAt = () => timestamp("created_at", { mode: "date" }).defaultNow().notNull();
const defaultUpdatedAt = () => timestamp("updated_at", { mode: "date" }).defaultNow().notNull();

// Master Work Items (e.g. Pondasi, Struktur, Atap, Finishing)
export const workItems = pgTable("work_items", {
  id: text("id").primaryKey(),
  code: text("code").unique().notNull(), // Mono Font: e.g. WRK-001
  name: text("name").notNull(),
  description: text("description"),
  defaultWeightPct: integer("default_weight_pct").notNull(), // e.g. 20 (for 20%)
  status: text("status").default("active").notNull().$type<"active" | "inactive">(), // 'active', 'inactive'
  createdAt: defaultCreatedAt(),
});

// Surat Perintah Kerja (SPK)
export const spks = pgTable("spks", {
  id: text("id").primaryKey(),
  spkNumber: text("spk_number").unique().notNull(), // Mono Font: e.g. SPK-20260517-001
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  unitId: text("unit_id").references(() => units.id, { onDelete: "cascade" }).notNull(),
  vendorId: text("vendor_id").references(() => vendors.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  workDescription: text("work_description").notNull(),
  specification: text("specification"),
  rabAmount: doublePrecision("rab_amount").notNull(),
  startDate: timestamp("start_date", { mode: "date" }).notNull(),
  targetEndDate: timestamp("target_end_date", { mode: "date" }).notNull(),
  actualEndDate: timestamp("actual_end_date", { mode: "date" }),
  status: text("status").default("active").notNull().$type<"draft" | "active" | "proses_konstruksi" | "selesai_konstruksi" | "completed" | "overdue" | "cancelled">(), // 'draft', 'active', 'proses_konstruksi', 'selesai_konstruksi', 'completed', 'overdue', 'cancelled'
  progressPct: integer("progress_pct").default(0).notNull(), // 0-100% total progress
  createdBy: text("created_by").references(() => user.id).notNull(),
  createdAt: defaultCreatedAt(),
  updatedAt: defaultUpdatedAt(),
});

// Surat Perintah Mulai Bangun (SPMB)
export const spmbs = pgTable("spmbs", {
  id: text("id").primaryKey(),
  spmbNumber: text("spmb_number").unique().notNull(), // Mono Font: e.g. SPMB-20260517-001
  spkId: text("spk_id").references(() => spks.id, { onDelete: "cascade" }).notNull(),
  issueDate: timestamp("issue_date", { mode: "date" }).notNull(),
  startWorkDate: timestamp("start_work_date", { mode: "date" }).notNull(),
  targetEndDate: timestamp("target_end_date", { mode: "date" }).notNull(),
  status: text("status").default("issued").notNull().$type<"issued" | "active" | "completed" | "cancelled">(), // 'issued', 'active', 'completed', 'cancelled'
  notes: text("notes"),
  createdBy: text("created_by").references(() => user.id).notNull(),
  createdAt: defaultCreatedAt(),
});

// Custom weights for work items inside specific SPKs
export const spkWorkItemWeights = pgTable("spk_work_item_weights", {
  id: text("id").primaryKey(),
  spkId: text("spk_id").references(() => spks.id, { onDelete: "cascade" }).notNull(),
  workItemId: text("work_item_id").references(() => workItems.id, { onDelete: "cascade" }).notNull(),
  weightPct: integer("weight_pct").notNull(), // custom weight assigned to this SPK
  createdAt: defaultCreatedAt(),
});

// Progress logging per work item inside SPK
export const spkProgressLogs = pgTable("spk_progress_logs", {
  id: text("id").primaryKey(),
  spkId: text("spk_id").references(() => spks.id, { onDelete: "cascade" }).notNull(),
  workItemId: text("work_item_id").references(() => workItems.id, { onDelete: "cascade" }).notNull(),
  percentageAdded: integer("percentage_added").notNull(), // 0-100 value input by supervisor for this work item
  currentTotalPct: integer("current_total_pct").notNull(), // calculated total percentage of this work item (0-100)
  progressDate: timestamp("progress_date", { mode: "date" }).notNull(),
  photoAttachmentId: text("photo_attachment_id").references(() => attachments.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdBy: text("created_by").references(() => user.id).notNull(),
  createdAt: defaultCreatedAt(),
});

// Material request from field, linking to finance expense
export const materialRequests = pgTable("material_requests", {
  id: text("id").primaryKey(),
  requestNumber: text("request_number").unique().notNull(), // Mono Font: e.g. MTR-20260517-001
  spkId: text("spk_id").references(() => spks.id, { onDelete: "cascade" }).notNull(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  unitId: text("unit_id").references(() => units.id, { onDelete: "cascade" }).notNull(),
  vendorId: text("vendor_id").references(() => vendors.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  estimatedAmount: doublePrecision("estimated_amount").notNull(),
  status: text("status").default("draft").notNull().$type<"draft" | "submitted" | "finance_pending" | "approved" | "rejected" | "purchased">(), // 'draft', 'submitted', etc.
  transactionId: text("transaction_id").references(() => transactions.id, { onDelete: "set null" }),
  requestedBy: text("requested_by").references(() => user.id).notNull(),
  createdAt: defaultCreatedAt(),
});

// Handover Estimation dates
export const handoverEstimations = pgTable("handover_estimations", {
  id: text("id").primaryKey(),
  unitId: text("unit_id").references(() => units.id, { onDelete: "cascade" }).notNull(),
  spkId: text("spk_id").references(() => spks.id, { onDelete: "cascade" }).notNull(),
  handoverType: text("handover_type").default("vendor_to_developer").notNull().$type<"vendor_to_developer" | "developer_to_customer">(), // 'vendor_to_developer', etc.
  estimatedHandoverDate: timestamp("estimated_handover_date", { mode: "date" }).notNull(),
  calculationNote: text("calculation_note"),
  createdAt: defaultCreatedAt(),
});

// Customer construction complaints
export const complaints = pgTable("complaints", {
  id: text("id").primaryKey(),
  complaintNumber: text("complaint_number").unique().notNull(), // Mono Font: e.g. CMP-20260517-001 or VCP-... or CCP-...
  complaintType: text("complaint_type").default("customer_to_developer").notNull().$type<"vendor_to_supervisor" | "customer_to_developer">(), // 'vendor_to_supervisor', etc.
  customerId: text("customer_id").references(() => customers.id, { onDelete: "cascade" }),
  unitId: text("unit_id").references(() => units.id, { onDelete: "cascade" }),
  spkId: text("spk_id").references(() => spks.id, { onDelete: "set null" }),
  vendorId: text("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
  projectId: text("project_id").references(() => projects.id, { onDelete: "set null" }),
  bookingId: text("booking_id").references(() => bookings.id, { onDelete: "set null" }),
  title: text("title"),
  category: text("category").notNull(),
  description: text("description").notNull(),
  status: text("status").default("open").notNull().$type<"open" | "in_progress" | "in_review" | "need_revision" | "approved_extension" | "follow_up_required" | "waiting_customer_confirmation" | "resolved" | "rejected" | "closed">(), // 'open', 'in_progress', etc.
  assignedTo: text("assigned_to").references(() => user.id, { onDelete: "set null" }),
  assignedToRole: text("assigned_to_role"),
  assignedToUserId: text("assigned_to_user_id").references(() => user.id, { onDelete: "set null" }),
  reviewedBy: text("reviewed_by").references(() => user.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { mode: "date" }),
  resolvedAt: timestamp("resolved_at", { mode: "date" }),
  
  // Vendor-specific fields
  supervisorNote: text("supervisor_note"),
  extensionDays: integer("extension_days"),
  extensionReason: text("extension_reason"),
  
  // Customer-specific fields
  developerNote: text("developer_note"),
  customerMessage: text("customer_message"),
  repairAction: text("repair_action"),
  followUpTargetDate: timestamp("follow_up_target_date", { mode: "date" }),
  
  createdAt: defaultCreatedAt(),
});
