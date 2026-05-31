import { pgTable, text, timestamp, boolean, doublePrecision, integer, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth";

const defaultCreatedAt = () => timestamp("created_at", { mode: "date" }).defaultNow().notNull();
const defaultUpdatedAt = () => timestamp("updated_at", { mode: "date" }).defaultNow().notNull();

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  code: text("code").unique().notNull(),
  name: text("name").notNull(),
  location: text("location"),
  description: text("description"),
  status: text("status").default("active").notNull().$type<"active" | "inactive" | "completed">(), // 'active', 'inactive', 'completed'
  startDate: timestamp("start_date", { mode: "date" }),
  targetEndDate: timestamp("target_end_date", { mode: "date" }),
  createdBy: text("created_by").references(() => user.id).notNull(),
  createdAt: defaultCreatedAt(),
  updatedAt: defaultUpdatedAt(),
});

export const projectUsers = pgTable("project_users", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }).notNull(),
  roleInProject: text("role_in_project"), // PIC, viewer, manager
  createdAt: defaultCreatedAt(),
});

export const siteplans = pgTable("siteplans", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  imageUrl: text("image_url"),
  svgData: text("svg_data"),
  width: integer("width"),
  height: integer("height"),
  version: integer("version").default(1).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: defaultCreatedAt(),
});

export const units = pgTable("units", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }).notNull(),
  code: text("code").notNull(),
  cluster: text("cluster"),
  typeName: text("type_name"),
  landArea: doublePrecision("land_area").notNull(), 
  buildingArea: doublePrecision("building_area").notNull(), 
  price: doublePrecision("price").notNull(), 
  status: text("status").default("available").notNull().$type<"available" | "belum_siap" | "booking" | "kpr_process" | "payment_pending" | "sold" | "construction" | "construction_done" | "overdue" | "cancelled" | "menunggu_serah_terima" | "handover_complete">(), // 'available', 'belum_siap', 'booking', 'kpr_process', etc.
  isReadyStock: boolean("is_ready_stock").default(false).notNull(),
  readyStockSource: text("ready_stock_source").default("construction_flow").notNull().$type<"construction_flow" | "legacy_ready_stock" | "manual_ready_stock">(), // 'construction_flow', 'legacy_ready_stock', 'manual_ready_stock'
  constructionProgress: integer("construction_progress").default(0).notNull(),
  currentCustomerId: text("current_customer_id").references(() => customers.id, { onDelete: "set null" }), 
  currentBookingId: text("current_booking_id"), 
  currentSpkId: text("current_spk_id"), 
  notes: text("notes"),
  createdAt: defaultCreatedAt(),
  updatedAt: defaultUpdatedAt(),
});

export const siteplanShapes = pgTable("siteplan_shapes", {
  id: text("id").primaryKey(),
  siteplanId: text("siteplan_id").references(() => siteplans.id, { onDelete: "cascade" }).notNull(),
  unitId: text("unit_id").references(() => units.id, { onDelete: "set null" }),
  shapeType: text("shape_type").notNull().$type<"polygon" | "rect" | "path">(), // 'polygon', 'rect', 'path'
  coordinates: jsonb("coordinates").notNull(),
  label: text("label"),
  colorOverride: text("color_override"),
  createdAt: defaultCreatedAt(),
});

export const unitStatusHistories = pgTable("unit_status_histories", {
  id: text("id").primaryKey(),
  unitId: text("unit_id").references(() => units.id, { onDelete: "cascade" }).notNull(),
  previousStatus: text("previous_status"),
  newStatus: text("new_status").notNull(),
  reason: text("reason"),
  changedBy: text("changed_by").references(() => user.id).notNull(),
  changedAt: timestamp("changed_at", { mode: "date" }).defaultNow().notNull(),
});

export const customers = pgTable("customers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  nik: text("nik"),
  phone: text("phone").notNull(),
  email: text("email"),
  address: text("address"),
  source: text("source").default("other").notNull().$type<"walk_in" | "ads" | "referral" | "social_media" | "website" | "other">(), // 'walk_in', 'ads', 'referral', etc.
  status: text("status").default("prospect").notNull().$type<"prospect" | "booking" | "kpr_process" | "akad" | "buyer" | "cancelled">(), // 'prospect', 'booking', etc.
  assignedMarketingId: text("assigned_marketing_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: defaultCreatedAt(),
  updatedAt: defaultUpdatedAt(),
});

export const vendors = pgTable("vendors", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  legalDocNumber: text("legal_doc_number"),
  status: text("status").default("active").notNull().$type<"active" | "inactive">(), // 'active', 'inactive'
  notes: text("notes"),
  createdAt: defaultCreatedAt(),
});

export const financeAccounts = pgTable("finance_accounts", {
  id: text("id").primaryKey(),
  code: text("code").unique().notNull(),
  name: text("name").notNull(),
  type: text("type").notNull().$type<"cash" | "bank" | "receivable" | "payable" | "income" | "expense">(), // 'cash', 'bank', etc.
  openingBalance: doublePrecision("opening_balance").default(0).notNull(),
  status: text("status").default("active").notNull().$type<"active" | "inactive">(), // 'active', 'inactive'
  createdAt: defaultCreatedAt(),
});

export const financeCategories = pgTable("finance_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().$type<"income" | "expense">(), // 'income', 'expense'
  parentId: text("parent_id").references((): any => financeCategories.id, { onDelete: "cascade" }), // self-reference
  status: text("status").default("active").notNull().$type<"active" | "inactive">(), // 'active', 'inactive'
  createdAt: defaultCreatedAt(),
});
