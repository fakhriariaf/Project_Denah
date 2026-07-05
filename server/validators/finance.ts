import { z } from "zod";

export const invoiceSchema = z.object({
  projectId: z.string().min(1, "val.finance_project"),
  unitId: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  bookingId: z.string().optional().nullable(),
  type: z.enum(["booking_fee", "dp", "installment", "other"]),
  amount: z.coerce.number().min(0.01, "val.finance_invoice_amount"),
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
  projectId: z.string().min(1, "val.finance_project"),
  unitId: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  amount: z.coerce.number().min(0.01, "val.finance_payment_amount"),
  paymentDate: z.coerce.date(),
  paymentMethod: z.enum(["cash", "transfer", "giro", "other"]),
  proofAttachmentId: z.string().optional().nullable(),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

export const expenseRequestSchema = z.object({
  projectId: z.string().min(1, "val.finance_project"),
  accountId: z.string().min(1, "val.finance_expense_account"),
  categoryId: z.string().min(1, "val.finance_expense_category"),
  amount: z.coerce.number().min(0.01, "val.finance_expense_amount"),
  description: z.string().min(1, "val.finance_expense_desc"),
  transactionDate: z.coerce.date(),
  paymentMethod: z.enum(["cash", "transfer", "giro", "other"]),
  attachmentId: z.string().optional().nullable(),
});
export type ExpenseRequestInput = z.infer<typeof expenseRequestSchema>;

export const budgetLineSchema = z.object({
  categoryId: z.string().min(1, "val.finance_budget_category"),
  allocatedAmount: z.coerce.number().min(0, "val.finance_budget_alloc"),
});

export const budgetSchema = z.object({
  projectId: z.string().min(1, "val.finance_project"),
  name: z.string().min(1, "val.finance_budget_name"),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  totalAmount: z.coerce.number().min(0.01, "val.finance_budget_total"),
  lines: z.array(budgetLineSchema).min(1, "val.finance_budget_lines"),
});
export type BudgetInput = z.infer<typeof budgetSchema>;
