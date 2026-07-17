import { z } from "zod";
import { sanitizeInput } from "@/server/middleware/sanitizer";

// Helper: trim + sanitize string fields in schemas
const safeString = z.string().transform(sanitizeInput);
const safeStringOpt = z.string().optional().transform(v => v ? sanitizeInput(v) : v);
const safeStringNullOpt = z.string().nullable().optional().transform(v => (v ? sanitizeInput(v) : v));

export const leadSchema = z.object({
  customerId: safeStringNullOpt,
  name: safeString.pipe(z.string().min(2, "Nama minimal 2 karakter")),
  phone: safeString.pipe(
    z.string()
      .min(8, "Nomor HP minimal 8 karakter")
      .regex(/^[0-9+\-\s()]{8,20}$/, "Format nomor HP tidak valid. Gunakan angka (08xx atau +62xx)")
  ),
  source: safeString.pipe(z.string().min(1, "Sumber lead wajib dipilih")),
  interestedProjectId: safeStringNullOpt,
  interestedUnitId: safeStringNullOpt,
  status: z.enum(["new", "contacted", "follow_up", "converted", "lost"]).default("new"),
  assignedMarketingId: safeStringNullOpt,
  notes: safeStringNullOpt,
});

export const followupSchema = z.object({
  id: z.string().optional(),
  customerId: safeStringNullOpt,
  leadId: safeStringNullOpt,
  followupDate: z.coerce.date(),
  method: z.enum(["call", "whatsapp", "meeting", "email", "site_visit"]),
  result: safeString.pipe(z.string().min(3, "Hasil follow-up minimal 3 karakter")),
  nextFollowupAt: z.preprocess(
    (val) => {
      if (!val) return null;
      const d = new Date(val as string | number | Date);
      if (isNaN(d.getTime())) return null;
      return d;
    },
    z.coerce.date().nullable().optional()
  ),
});

export const bookingSchema = z.object({
  id: z.string().optional(),
  bookingNumber: z.string().optional(),
  projectId: z.string().min(1, "Project wajib dipilih"),
  unitId: z.string().min(1, "Unit wajib dipilih"),
  customerId: z.string().min(1, "Customer wajib dipilih"),
  marketingId: z.string().min(1, "Marketing PIC wajib dipilih"),
  bookingDate: z.coerce.date(),
  bookingFee: z.coerce.number().gt(0, "Booking fee harus lebih besar dari 0"),
  dpAmount: z.coerce.number().gt(0, "Uang muka (DP) harus lebih besar dari 0"),
  paymentScheme: z.enum(["cash", "kpr", "installment"]),
  status: z.enum(["active", "cancelled", "akad", "completed"]).default("active"),
  nik: z.string().optional(),
  isLead: z.boolean().optional(),
  termin: z.coerce.number().optional().nullable(),
});

/**
 * Schema untuk edit booking.
 *
 * Project, kavling, dan konsumen adalah data terkunci setelah booking dibuat.
 * Field tersebut diambil dari record booking yang sudah ada di server, bukan
 * dari payload client, supaya edit tidak gagal ketika UI hanya menampilkan
 * nama/kode tetapi tidak mengirim ID terkunci.
 */
export const bookingUpdateSchema = bookingSchema.omit({
  projectId: true,
  unitId: true,
  customerId: true,
  nik: true,
  isLead: true,
});

export const kprProcessSchema = z.object({
  id: z.string().optional(),
  bookingId: z.string().min(1),
  status: z.enum(["bi_checking", "pemberkasan", "proses_bank", "offering", "approved", "rejected", "akad"]),
  biCheckStatus: z.enum(["pending", "partial", "approved", "rejected_refund", "rejected_no_refund"]),
  documentStatus: z.enum(["incomplete", "complete"]),
  bankNotes: z.string().nullable().optional(),
  akadDate: z.preprocess(
    (val) => {
      if (!val) return null;
      const d = new Date(val as string | number | Date);
      if (isNaN(d.getTime())) return null;
      return d;
    },
    z.coerce.date().nullable().optional()
  ),
});

/**
 * Schema for UPDATING an existing KPR process.
 * bookingId is resolved server-side from the kprProcess record — not required in the payload.
 */
export const kprUpdateSchema = z.object({
  status: z.enum(["bi_checking", "pemberkasan", "proses_bank", "offering", "approved", "rejected", "akad"]),
  biCheckStatus: z.enum(["pending", "partial", "approved", "rejected_refund", "rejected_no_refund"]),
  documentStatus: z.enum(["incomplete", "complete"]),
  bankNotes: z.string().nullable().optional(),
  akadDate: z.preprocess(
    (val) => {
      if (!val) return null;
      const d = new Date(val as string | number | Date);
      if (isNaN(d.getTime())) return null;
      return d;
    },
    z.coerce.date().nullable().optional()
  ),
  approvedBankPartnerId: z.string().nullable().optional(),
  approvedPlafond: z.coerce.number().nullable().optional(),
  approvedTenor: z.coerce.number().nullable().optional(),
});

export type KprUpdateInput = z.infer<typeof kprUpdateSchema>;


export const bankPartnerSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Nama bank minimal 2 karakter"),
  contactPerson: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const bankSubmissionSchema = z.object({
  id: z.string().optional(),
  kprProcessId: z.string().min(1),
  bankPartnerId: z.string().min(1, "Bank partner wajib dipilih"),
  submissionDate: z.coerce.date(),
  status: z.enum(["submitted", "verified", "offering", "approved", "rejected"]),
  plafondAmount: z.number().nullable().optional(),
  interestRate: z.number().nullable().optional(),
  tenorYear: z.number().nullable().optional(),
  rejectionReason: z.string().nullable().optional(),
});

export const realizeKprSchema = z.object({
  kprProcessId: z.string().min(1, "ID Proses KPR wajib diisi"),
  realizedDate: z.coerce.date({ message: "Tanggal realisasi wajib diisi" }),
  plafondApproved: z.coerce.number().positive("Plafond harus lebih dari 0"),
  realizedBankFees: z.coerce.number().min(0, "Biaya bank tidak boleh negatif").default(0),
  realizedInsuranceFees: z.coerce.number().min(0, "Premi asuransi tidak boleh negatif").default(0),
  realizedWithheldAmount: z.coerce.number().min(0, "Dana ditahan tidak boleh negatif").default(0),
  realizedAccountId: z.string().min(1, "Rekening tujuan wajib dipilih"),
  realizedAttachmentId: z.string().min(1, "Memo pencairan bank wajib diunggah"),
  realizedNotes: z.string().optional().nullable(),
}).refine(
  (data) => {
    const net = data.plafondApproved - data.realizedBankFees - data.realizedInsuranceFees - data.realizedWithheldAmount;
    return net >= 0;
  },
  { message: "Dana penerimaan bersih tidak boleh kurang dari nol. Periksa rincian potongan biaya.", path: ["plafondApproved"] }
);

