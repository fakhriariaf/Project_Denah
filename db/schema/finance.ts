import { pgTable, text, timestamp, doublePrecision, integer, index, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { projects, units, customers, financeAccounts, financeCategories } from "./master";
import { bookings } from "./marketing";
import { attachments } from "./system";
import { user } from "./auth";

const defaultCreatedAt = () => timestamp("created_at", { mode: "date" }).defaultNow().notNull();
const defaultUpdatedAt = () => timestamp("updated_at", { mode: "date" }).defaultNow().notNull();

export const invoices = pgTable("invoices", {
  id: text("id").primaryKey(),
  invoiceNumber: text("invoice_number").unique().notNull(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  unitId: text("unit_id").references(() => units.id, { onDelete: "set null" }),
  customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
  bookingId: text("booking_id").references(() => bookings.id, { onDelete: "set null" }),
  type: text("type").notNull().$type<"booking_fee" | "dp" | "installment" | "other">(), // 'booking_fee', 'dp', etc.
  amount: doublePrecision("amount").notNull(),
  dueDate: timestamp("due_date", { mode: "date" }),
  status: text("status").default("unpaid").notNull().$type<"unpaid" | "partial" | "paid" | "cancelled">(), // 'unpaid', 'partial', etc.
  notes: text("notes"),
  // Schedule identity (Phase — installment schedule, additive & nullable). Stable
  // schedule identity for idempotent duplicate detection; legacy invoices have all
  // three columns NULL and rely on label-helper fallback to `type`.
  scheduleKind: text("schedule_kind")
    .$type<"booking_fee" | "dp" | "cash_settlement" | "installment">(), // nullable
  scheduleSequence: integer("schedule_sequence"), // nullable; termin ke-i (1..N), null untuk non-termin
  scheduleLabel: text("schedule_label"), // nullable; "Pelunasan Cash", "Termin 1".."Termin N"
  createdAt: defaultCreatedAt(),
  updatedAt: defaultUpdatedAt(),
}, (table) => ({
  projectCreatedIdx: index("idx_invoices_project_created").on(table.projectId, table.createdAt),
  scheduleIdentityIdx: index("idx_invoices_booking_schedule").on(table.bookingId, table.scheduleKind, table.scheduleSequence),
}));

export const payments = pgTable("payments", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
  paymentNumber: text("payment_number").unique().notNull(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  unitId: text("unit_id").references(() => units.id, { onDelete: "set null" }),
  customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
  amount: doublePrecision("amount").notNull(),
  paymentDate: timestamp("payment_date", { mode: "date" }).notNull(),
  paymentMethod: text("payment_method").notNull().$type<"cash" | "transfer" | "giro" | "other">(), // 'cash', 'transfer', etc.
  proofAttachmentId: text("proof_attachment_id").references(() => attachments.id, { onDelete: "set null" }),
  // Uploader identity (additive & nullable) — primary source for the self-verify
  // guard (Req 11.7): a user must not verify a payment they uploaded. Legacy
  // payments have this NULL and fall back to attachment uploader / audit history.
  uploadedBy: text("uploaded_by").references(() => user.id, { onDelete: "set null" }),
  status: text("status").default("pending").notNull().$type<"pending" | "verified" | "rejected" | "voided">(), // 'pending', 'verified', etc.
  verifiedBy: text("verified_by").references(() => user.id, { onDelete: "set null" }),
  verifiedAt: timestamp("verified_at", { mode: "date" }),
  createdAt: defaultCreatedAt(),
}, (table) => ({
  projectCreatedIdx: index("idx_payments_project_created").on(table.projectId, table.createdAt),
  invoiceStatusIdx: index("idx_payments_invoice_status").on(table.invoiceId, table.status),
}));

export const transactions = pgTable("transactions", {
  id: text("id").primaryKey(),
  transactionNumber: text("transaction_number").unique().notNull(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  unitId: text("unit_id").references(() => units.id, { onDelete: "set null" }),
  customerId: text("customer_id").references(() => customers.id, { onDelete: "set null" }),
  paymentId: text("payment_id").references(() => payments.id, { onDelete: "set null" }),
  materialRequestId: text("material_request_id"),
  kprProcessId: text("kpr_process_id"),
  accountId: text("account_id").references(() => financeAccounts.id).notNull(),
  categoryId: text("category_id").references(() => financeCategories.id).notNull(),
  type: text("type").notNull().$type<"income" | "expense">(), // 'income', 'expense'
  description: text("description").notNull(),
  amount: doublePrecision("amount").notNull(),
  transactionDate: timestamp("transaction_date", { mode: "date" }).notNull(),
  paymentMethod: text("payment_method").notNull().$type<"cash" | "transfer" | "giro" | "other">(), // 'cash', 'transfer', etc.
  approvalStatus: text("approval_status").default("not_required").notNull().$type<"not_required" | "pending" | "approved" | "rejected" | "insufficient_balance">(), // 'not_required', 'pending', etc.
  approvedBy: text("approved_by").references(() => user.id, { onDelete: "set null" }),
  approvalNotes: text("approval_notes"),
  attachmentId: text("attachment_id").references(() => attachments.id, { onDelete: "set null" }),
  createdBy: text("created_by").references(() => user.id).notNull(),
  // Correction/reversal linkage (Phase 4, additive & nullable) — links an inverse
  // adjustment transaction back to the original it reverses. Normal transactions
  // leave both null.
  reversalOfTransactionId: text("reversal_of_transaction_id")
    .references((): any => transactions.id, { onDelete: "set null" }),
  // Payment-scoped reversal linkage (additive & nullable) — links an inverse
  // adjustment transaction back to the original payment it reverses. Normal
  // transactions leave this null.
  reversalOfPaymentId: text("reversal_of_payment_id")
    .references(() => payments.id, { onDelete: "set null" }),
  reversalReason: text("reversal_reason"),
  createdAt: defaultCreatedAt(),
  updatedAt: defaultUpdatedAt(),
}, (table) => ({
  createdAtIdx: index("idx_transactions_created_at").on(table.createdAt),
}));

export const transactionApprovals = pgTable("transaction_approvals", {
  id: text("id").primaryKey(),
  transactionId: text("transaction_id").references(() => transactions.id, { onDelete: "cascade" }).notNull(),
  approverId: text("approver_id").references(() => user.id).notNull(),
  level: integer("level").default(1).notNull(),
  status: text("status").default("pending").notNull().$type<"pending" | "approved" | "rejected">(), // 'pending', 'approved', etc.
  notes: text("notes"),
  actedAt: timestamp("acted_at", { mode: "date" }),
  createdAt: defaultCreatedAt(),
});

export const budgets = pgTable("budgets", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  periodStart: timestamp("period_start", { mode: "date" }).notNull(),
  periodEnd: timestamp("period_end", { mode: "date" }).notNull(),
  totalAmount: doublePrecision("total_amount").notNull(),
  status: text("status").default("draft").notNull().$type<"draft" | "active" | "closed">(), // 'draft', 'active', 'closed'
  createdBy: text("created_by").references(() => user.id).notNull(),
  createdAt: defaultCreatedAt(),
});

export const budgetLines = pgTable("budget_lines", {
  id: text("id").primaryKey(),
  budgetId: text("budget_id").references(() => budgets.id, { onDelete: "cascade" }).notNull(),
  categoryId: text("category_id").references(() => financeCategories.id).notNull(),
  allocatedAmount: doublePrecision("allocated_amount").notNull(),
  usedAmount: doublePrecision("used_amount").default(0).notNull(),
  remainingAmount: doublePrecision("remaining_amount").notNull(),
  createdAt: defaultCreatedAt(),
});

export const financeActivityHistory = pgTable("finance_activity_history", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull()
    .$type<"invoice" | "payment" | "transaction" | "approval" | "budget">(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull()
    .$type<
      | "created" | "submitted" | "approved" | "verified" | "rejected"
      | "revised" | "resubmitted" | "cancelled" | "reversed" | "corrected"
      | "updated" | "activated" | "closed" | "paid_partial" | "paid_full"
    >(),
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  reason: text("reason"), // enforced max 500 chars at the validator layer
  snapshotBefore: jsonb("snapshot_before"),
  snapshotAfter: jsonb("snapshot_after"),
  actorId: text("actor_id").references(() => user.id).notNull(),
  createdAt: defaultCreatedAt(),
}, (table) => ({
  entityIdx: index("idx_fin_activity_entity").on(table.entityType, table.entityId),
}));
