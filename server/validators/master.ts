import { z } from "zod";
import { sanitizeInput } from "@/server/middleware/sanitizer";

const safeStr = (s: string) => sanitizeInput(s);

export const projectSchema = z.object({
  code: z.string().trim().min(1, "Kode wajib diisi").transform(safeStr),
  name: z.string().trim().min(1, "Nama project wajib diisi").transform(safeStr),
  location: z.string().trim().optional().transform(v => v ? safeStr(v) : v),
  description: z.string().trim().optional().transform(v => v ? safeStr(v) : v),
  status: z.enum(["active", "inactive", "completed"]).default("active"),
  startDate: z.date().optional(),
  targetEndDate: z.date().optional(),
  publicEnabled: z.boolean().default(false),
  isFeaturedPublic: z.boolean().default(false),
});
export type ProjectInput = z.infer<typeof projectSchema>;

export const unitSchema = z.object({
  projectId: z.string().min(1, "Project wajib dipilih"),
  code: z.string().trim().min(1, "Kode/Nomor unit wajib diisi").transform(safeStr),
  cluster: z.string().trim().nullish().transform(v => (v ? safeStr(v) : v ?? undefined)),
  typeName: z.string().trim().nullish().transform(v => (v ? safeStr(v) : v ?? undefined)),
  landArea: z.coerce.number().min(0, "Luas tanah tidak valid"),
  buildingArea: z.coerce.number().min(0, "Luas bangunan tidak valid"),
  price: z.coerce.number().min(0, "Harga tidak valid"),
  // P1 BUGFIX: enum must mirror db/schema/master.ts units.status. The two handover
  // states were missing, so editing a unit that had already reached serah terima
  // failed validation on its own current status.
  status: z.enum(["available", "belum_siap", "booking", "kpr_process", "payment_pending", "sold", "construction", "construction_done", "overdue", "cancelled", "menunggu_serah_terima", "handover_complete"]).default("available"),
  isReadyStock: z.boolean().default(false),
  readyStockSource: z.enum(["construction_flow", "legacy_ready_stock", "manual_ready_stock"]).default("construction_flow"),
  readyStockVendorId: z.string().optional(),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.isReadyStock && (!data.readyStockVendorId || data.readyStockVendorId.trim() === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Vendor Pelaksana wajib dipilih",
      path: ["readyStockVendorId"],
    });
  }
});
export type UnitInput = z.infer<typeof unitSchema>;

export const customerSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").transform(safeStr),
  nik: z.string().trim().optional().transform(v => v ? safeStr(v) : v),
  phone: z.string().trim().min(1, "Nomor HP wajib diisi").transform(safeStr),
  email: z.string().trim().email("Email tidak valid").optional().or(z.literal("")),
  address: z.string().trim().optional().transform(v => v ? safeStr(v) : v),
  source: z.enum(["walk_in", "ads", "referral", "social_media", "website", "other"]).default("other"),
  status: z.enum(["prospect", "booking", "kpr_process", "akad", "buyer", "cancelled"]).default("prospect"),
  assignedMarketingId: z.string().optional(),
});
export type CustomerInput = z.infer<typeof customerSchema>;

export const vendorSchema = z.object({
  name: z.string().trim().min(1, "Nama vendor wajib diisi").transform(safeStr),
  phone: z.string().trim().optional().transform(v => v ? safeStr(v) : v),
  email: z.string().trim().email("Email tidak valid").optional().or(z.literal("")),
  address: z.string().trim().optional().transform(v => v ? safeStr(v) : v),
  legalDocNumber: z.string().trim().optional().transform(v => v ? safeStr(v) : v),
  status: z.enum(["active", "inactive"]).default("active"),
  notes: z.string().optional().transform(v => v ? safeStr(v) : v),
});
export type VendorInput = z.infer<typeof vendorSchema>;

export const financeCategorySchema = z.object({
  name: z.string().trim().min(1, "Nama kategori wajib diisi"),
  type: z.enum(["income", "expense"]),
  parentId: z.string().optional().nullable(),
});
export type FinanceCategoryInput = z.infer<typeof financeCategorySchema>;

export const financeAccountSchema = z.object({
  code: z.string().trim().min(1, "Kode akun wajib diisi").max(20, "Kode akun maksimal 20 karakter"),
  name: z.string().trim().min(1, "Nama rekening wajib diisi"),
  type: z.enum(["cash", "bank", "receivable", "payable", "income", "expense"]),
  openingBalance: z.coerce.number().min(0, "Saldo awal tidak boleh negatif").default(0),
  status: z.enum(["active", "inactive"]).default("active"),
});
export type FinanceAccountInput = z.infer<typeof financeAccountSchema>;
