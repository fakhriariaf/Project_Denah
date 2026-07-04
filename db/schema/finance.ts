import { pgTable, text, timestamp, doublePrecision, integer, index } from "drizzle-orm/pg-core";
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
  createdAt: defaultCreatedAt(),
  updatedAt: defaultUpdatedAt(),
});

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
  status: text("status").default("pending").notNull().$type<"pending" | "verified" | "rejected">(), // 'pending', 'verified', etc.
  verifiedBy: text("verified_by").references(() => user.id, { onDelete: "set null" }),
  verifiedAt: timestamp("verified_at", { mode: "date" }),
  createdAt: defaultCreatedAt(),
});

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
