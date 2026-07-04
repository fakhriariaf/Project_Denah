import { pgTable, text, timestamp, doublePrecision, integer, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth";
import { projects, units, customers, financeAccounts } from "./master";
import { attachments } from "./system";

const defaultCreatedAt = () => timestamp("created_at", { mode: "date" }).defaultNow().notNull();
const defaultUpdatedAt = () => timestamp("updated_at", { mode: "date" }).defaultNow().notNull();

export const leads = pgTable("leads", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  source: text("source").notNull(), // walk_in, ads, referral, social_media, website, other
  interestedProjectId: text("interested_project_id").references(() => projects.id, { onDelete: "set null" }),
  interestedUnitId: text("interested_unit_id").references(() => units.id, { onDelete: "set null" }),
  status: text("status").default("new").notNull().$type<"new" | "contacted" | "follow_up" | "converted" | "lost">(), // 'new', 'contacted', etc.
  assignedMarketingId: text("assigned_marketing_id").references(() => user.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: defaultCreatedAt(),
});

export const customerFollowups = pgTable("customer_followups", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").references(() => customers.id, { onDelete: "cascade" }),
  leadId: text("lead_id").references(() => leads.id, { onDelete: "cascade" }),
  followupDate: timestamp("followup_date", { mode: "date" }).notNull(),
  method: text("method").notNull().$type<"call" | "whatsapp" | "meeting" | "email" | "site_visit">(), // 'call', 'whatsapp', etc.
  result: text("result").notNull(),
  nextFollowupAt: timestamp("next_followup_at", { mode: "date" }),
  createdBy: text("created_by").references(() => user.id).notNull(),
  createdAt: defaultCreatedAt(),
});

export const bookings = pgTable("bookings", {
  id: text("id").primaryKey(),
  bookingNumber: text("booking_number").unique().notNull(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  unitId: text("unit_id").references(() => units.id, { onDelete: "cascade" }).notNull(),
  customerId: text("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  marketingId: text("marketing_id").references(() => user.id).notNull(),
  bookingDate: timestamp("booking_date", { mode: "date" }).notNull(),
  bookingFee: doublePrecision("booking_fee").notNull(),
  dpAmount: doublePrecision("dp_amount").notNull(),
  paymentScheme: text("payment_scheme").notNull().$type<"cash" | "kpr" | "installment">(), // 'cash', 'kpr', 'installment'
  status: text("status").default("active").notNull().$type<"active" | "cancelled" | "akad" | "completed">(), // 'active', 'cancelled', 'akad', 'completed'
  cancellationReason: text("cancellation_reason"),
  termin: integer("termin"),
  createdAt: defaultCreatedAt(),
  updatedAt: defaultUpdatedAt(),
}, (table) => ({
  statusIdx: index("idx_bookings_status").on(table.status),
  bookingDateIdx: index("idx_bookings_booking_date").on(table.bookingDate),
}));

export const bookingStatusHistories = pgTable("booking_status_histories", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").references(() => bookings.id, { onDelete: "cascade" }).notNull(),
  previousStatus: text("previous_status"),
  newStatus: text("new_status").notNull(),
  notes: text("notes"),
  changedBy: text("changed_by").references(() => user.id).notNull(),
  changedAt: defaultCreatedAt(),
});

export const kprProcesses = pgTable("kpr_processes", {
  id: text("id").primaryKey(),
  bookingId: text("booking_id").references(() => bookings.id, { onDelete: "cascade" }).notNull(),
  status: text("status").default("bi_checking").notNull().$type<"bi_checking" | "pemberkasan" | "proses_bank" | "offering" | "approved" | "rejected" | "akad" | "realisasi">(), // 'bi_checking', 'pemberkasan', etc.
  biCheckStatus: text("bi_check_status").default("pending").notNull().$type<"pending" | "partial" | "approved" | "rejected_refund" | "rejected_no_refund">(), // 'pending', 'partial', etc.
  documentStatus: text("document_status").default("incomplete").notNull().$type<"incomplete" | "complete">(), // 'incomplete', 'complete'
  slaStartAt: timestamp("sla_start_at", { mode: "date" }),
  slaDeadlineAt: timestamp("sla_deadline_at", { mode: "date" }), // SLA 5 hari
  bankNotes: text("bank_notes"),
  akadDate: timestamp("akad_date", { mode: "date" }),
  realizedDate: timestamp("realized_date", { mode: "date" }),
  plafondApproved: doublePrecision("plafond_approved"),
  realizedNetReceived: doublePrecision("realized_net_received"),
  realizedBankFees: doublePrecision("realized_bank_fees"),
  realizedInsuranceFees: doublePrecision("realized_insurance_fees"),
  realizedWithheldAmount: doublePrecision("realized_withheld_amount"),
  realizedAccountId: text("realized_account_id").references(() => financeAccounts.id, { onDelete: "set null" }),
  realizedAttachmentId: text("realized_attachment_id").references(() => attachments.id, { onDelete: "set null" }),
  realizedNotes: text("realized_notes"),
  createdAt: defaultCreatedAt(),
  updatedAt: defaultUpdatedAt(),
});

export const bankPartners = pgTable("bank_partners", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  status: text("status").default("active").notNull().$type<"active" | "inactive">(), // 'active', 'inactive'
  createdAt: defaultCreatedAt(),
});

export const bankSubmissions = pgTable("bank_submissions", {
  id: text("id").primaryKey(),
  kprProcessId: text("kpr_process_id").references(() => kprProcesses.id, { onDelete: "cascade" }).notNull(),
  bankPartnerId: text("bank_partner_id").references(() => bankPartners.id, { onDelete: "cascade" }).notNull(),
  submissionDate: timestamp("submission_date", { mode: "date" }).notNull(),
  status: text("status").default("submitted").notNull().$type<"submitted" | "verified" | "offering" | "approved" | "rejected">(), // 'submitted', 'verified', etc.
  plafondAmount: doublePrecision("plafond_amount"),
  interestRate: doublePrecision("interest_rate"),
  tenorYear: integer("tenor_year"),
  rejectionReason: text("rejection_reason"),
  createdAt: defaultCreatedAt(),
});

export const customerDocuments = pgTable("customer_documents", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  bookingId: text("booking_id").references(() => bookings.id, { onDelete: "cascade" }),
  attachmentId: text("attachment_id").references(() => attachments.id, { onDelete: "cascade" }).notNull(),
  documentType: text("document_type").notNull().$type<"ktp" | "npwp" | "slip_gaji" | "kk" | "spjb" | "kpr_doc" | "bast" | "other">(), // 'ktp', 'npwp', slip_gaji, kk, spjb, kpr_doc, bast, other
  status: text("status").default("uploaded").notNull().$type<"uploaded" | "verified" | "rejected">(), // 'uploaded', 'verified', 'rejected'
  notes: text("notes"),
  uploadedBy: text("uploaded_by").references(() => user.id).notNull(),
  uploadedAt: defaultCreatedAt(),
});

export const waitingLists = pgTable("waiting_lists", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").references(() => customers.id, { onDelete: "cascade" }).notNull(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  preferredType: text("preferred_type"),
  budgetMin: doublePrecision("budget_min"),
  budgetMax: doublePrecision("budget_max"),
  priority: integer("priority").default(1).notNull(),
  status: text("status").default("waiting").notNull().$type<"waiting" | "offered" | "converted" | "cancelled">(), // 'waiting', 'offered', etc.
  createdAt: defaultCreatedAt(),
});

export const marketingTargets = pgTable("marketing_targets", {
  id: text("id").primaryKey(),
  marketingId: text("marketing_id").references(() => user.id, { onDelete: "cascade" }).notNull(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  periodMonth: integer("period_month").notNull(),
  periodYear: integer("period_year").notNull(),
  targetUnits: integer("target_units").default(0).notNull(),
  targetAmount: doublePrecision("target_amount").default(0).notNull(),
  achievedUnits: integer("achieved_units").default(0).notNull(),
  achievedAmount: doublePrecision("achieved_amount").default(0).notNull(),
  createdAt: defaultCreatedAt(),
});
