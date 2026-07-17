import { z } from "zod";

export const invoiceSchema = z.object({
  projectId: z.string().min(1, "Project wajib dipilih"),
  unitId: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  bookingId: z.string().optional().nullable(),
  type: z.enum(["booking_fee", "dp", "installment", "other"]),
  amount: z.coerce.number().min(0.01, "Nilai tagihan harus lebih dari 0"),
  dueDate: z.preprocess(
    (val) => {
      if (!val) return null;
      const d = new Date(val as string | number | Date);
      if (isNaN(d.getTime())) return null;
      return d;
    },
    z.coerce.date().optional().nullable()
  ),
  notes: z.string().optional().nullable(),
});
export type InvoiceInput = z.infer<typeof invoiceSchema>;

export const paymentSchema = z.object({
  invoiceId: z.string().optional().nullable(),
  projectId: z.string().min(1, "Project wajib dipilih"),
  unitId: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  amount: z.coerce.number().min(0.01, "Nilai pembayaran harus lebih dari 0"),
  paymentDate: z.coerce.date(),
  paymentMethod: z.enum(["cash", "transfer", "giro", "other"]),
  proofAttachmentId: z.string().optional().nullable(),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

// Reusable rejection reason: non-empty, capped at 500 chars (Requirement 13.4).
export const rejectionReasonSchema = z
  .string()
  .trim()
  .min(1, "Alasan wajib diisi")
  .max(500, "Alasan maksimal 500 karakter");

// Payment void/reversal reason: wajib diisi, minimal 10 karakter dan maksimal
// 500 karakter (Requirement 4.6). Nilai di-trim terlebih dahulu sebelum
// validasi panjang sehingga input berisi spasi saja tetap ditolak.
export const reversalReasonSchema = z
  .string()
  .trim()
  .min(10, "Alasan wajib diisi minimal 10 karakter")
  .max(500, "Alasan maksimal 500 karakter");
export type ReversalReasonInput = z.infer<typeof reversalReasonSchema>;

// Payment revision (resubmit) input. Restricted to fields that ACTUALLY exist on
// the `payments` table: amount, paymentDate, paymentMethod, proofAttachmentId.
// Payment revision does NOT require account/category fields — those do not exist
// on `payments` (Requirements 4.3, 4.4). Any `reason` provided is capped at 500
// chars (Requirement 13.4).
export const paymentRevisionSchema = z.object({
  amount: z.coerce.number().min(0.01, "Nilai pembayaran harus lebih dari 0"),
  paymentDate: z.coerce.date(),
  paymentMethod: z.enum(["cash", "transfer", "giro", "other"]),
  proofAttachmentId: z.string().optional().nullable(),
  reason: z.string().trim().max(500, "Alasan maksimal 500 karakter").optional().nullable(),
});
export type PaymentRevisionInput = z.infer<typeof paymentRevisionSchema>;

export const expenseRequestSchema = z.object({
  projectId: z.string().min(1, "Proyek wajib dipilih"),
  accountId: z.string().min(1, "Akun kas wajib dipilih"),
  categoryId: z.string().min(1, "Kategori wajib dipilih"),
  amount: z.coerce
    .number()
    .min(0.01, "Nilai pengeluaran minimal Rp 0,01")
    .max(999_999_999.99, "Nilai pengeluaran maksimal Rp 999.999.999,99"),
  description: z
    .string()
    .transform((val) => val.trim())
    .pipe(
      z
        .string()
        .min(1, "Uraian deskripsi wajib diisi (tidak boleh hanya spasi)")
        .max(500, "Uraian deskripsi maksimal 500 karakter")
    ),
  transactionDate: z.coerce.date().refine(
    (date) => {
      const now = new Date();
      const minDate = new Date(now);
      minDate.setDate(minDate.getDate() - 365);
      minDate.setHours(0, 0, 0, 0);
      return date >= minDate;
    },
    { message: "Tanggal transaksi tidak boleh lebih dari 365 hari ke belakang" }
  ).refine(
    (date) => {
      const now = new Date();
      const maxDate = new Date(now);
      maxDate.setDate(maxDate.getDate() + 1);
      maxDate.setHours(23, 59, 59, 999);
      return date <= maxDate;
    },
    { message: "Tanggal transaksi tidak boleh lebih dari 1 hari ke depan" }
  ),
  paymentMethod: z.enum(["cash", "transfer", "giro", "other"]),
  attachmentId: z.string().optional().nullable(),
});
export type ExpenseRequestInput = z.infer<typeof expenseRequestSchema>;

// Expense-approval revision (resubmit) input. Restricted to the fields that ACTUALLY
// exist on the `transactions` table and are editable during an expense-approval
// revision: amount, accountId, categoryId, description, attachmentId (Requirements
// 4.6, 4.7, 8.1). Unlike payment revision, expense-approval revision DOES require
// account + category. Document number and creation date remain read-only and are
// intentionally excluded. Any `reason` provided is capped at 500 chars (Req 13.4).
export const expenseApprovalRevisionSchema = z.object({
  amount: z.coerce.number().min(0.01, "Nilai pengeluaran harus lebih dari 0"),
  accountId: z.string().min(1, "Akun kas wajib dipilih"),
  categoryId: z.string().min(1, "Kategori wajib dipilih"),
  description: z.string().min(1, "Uraian deskripsi wajib diisi"),
  attachmentId: z.string().optional().nullable(),
  reason: z.string().trim().max(500, "Alasan maksimal 500 karakter").optional().nullable(),
});
export type ExpenseApprovalRevisionInput = z.infer<typeof expenseApprovalRevisionSchema>;

// Ledger correction (replacement) input for `correctTransaction` (Phase 4,
// Task 10.2). A correction reverses the original finalized transaction AND
// inserts a corrected REPLACEMENT transaction with these values. All fields
// exist on the `transactions` table. `reason` is required, non-empty, capped at
// 500 chars (Requirements 7.6, 12.4, 13.4). projectId/unitId/customerId are NOT
// editable here — the replacement inherits them from the original so a
// correction never silently moves a ledger entry to a different project.
export const transactionCorrectionSchema = z.object({
  amount: z.coerce.number().min(0.01, "Nilai pengeluaran harus lebih dari 0"),
  accountId: z.string().min(1, "Akun kas wajib dipilih"),
  categoryId: z.string().min(1, "Kategori wajib dipilih"),
  description: z.string().min(1, "Uraian deskripsi wajib diisi"),
  transactionDate: z.coerce.date(),
  paymentMethod: z.enum(["cash", "transfer", "giro", "other"]),
  reason: rejectionReasonSchema,
});
export type TransactionCorrectionInput = z.infer<typeof transactionCorrectionSchema>;

export const budgetLineSchema = z.object({
  categoryId: z.string().min(1, "Kategori wajib dipilih"),
  allocatedAmount: z.coerce.number().min(0, "Alokasi anggaran tidak boleh negatif"),
});

export const budgetSchema = z.object({
  projectId: z.string().min(1, "Project wajib dipilih"),
  name: z.string().min(1, "Nama budget wajib diisi"),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  totalAmount: z.coerce.number().min(0.01, "Total budget harus lebih dari 0"),
  lines: z.array(budgetLineSchema).min(1, "Minimal harus ada satu kategori alokasi"),
});
export type BudgetInput = z.infer<typeof budgetSchema>;
