import { z } from "zod";

export const spkWorkItemWeightSchema = z.object({
  workItemId: z.string().min(1, "Item pekerjaan wajib dipilih"),
  weightPct: z.coerce.number().min(1, "Bobot minimal 1%").max(100, "Bobot maksimal 100%"),
});

export const spkSchema = z.object({
  projectId: z.string().min(1, "Project wajib dipilih"),
  unitId: z.string().min(1, "Unit wajib dipilih"),
  vendorId: z.string().min(1, "Kontraktor/Vendor wajib dipilih"),
  title: z.string().trim().min(3, "Judul pekerjaan minimal 3 karakter"),
  workDescription: z.string().trim().min(5, "Deskripsi pekerjaan minimal 5 karakter"),
  specification: z.string().trim().optional().nullable(),
  rabAmount: z.coerce.number().min(1000, "Nilai RAB minimal Rp 1.000"),
  startDate: z.coerce.date(),
  targetEndDate: z.coerce.date(),
  customWeights: z.array(spkWorkItemWeightSchema).optional().nullable(),
});
export type SpkInput = z.infer<typeof spkSchema>;

// BUG 13 FIX: Typed update schema for updateSpk — replaces `data: any` parameter
export const spkUpdateSchema = z.object({
  vendorId: z.string().min(1, "Kontraktor/Vendor wajib dipilih"),
  title: z.string().trim().min(3, "Judul pekerjaan minimal 3 karakter"),
  workDescription: z.string().trim().min(5, "Deskripsi pekerjaan minimal 5 karakter"),
  specification: z.string().trim().optional().nullable(),
  rabAmount: z.coerce.number().min(0, "Nilai RAB tidak boleh negatif"),
  startDate: z.coerce.date(),
  targetEndDate: z.coerce.date(),
  customWeights: z.array(spkWorkItemWeightSchema).optional().nullable(),
});
export type SpkUpdateInput = z.infer<typeof spkUpdateSchema>;

export const spmbSchema = z.object({
  spkId: z.string().min(1, "SPK wajib dipilih"),
  issueDate: z.coerce.date(),
  startWorkDate: z.coerce.date(),
  targetEndDate: z.coerce.date(),
  notes: z.string().trim().optional().nullable(),
});
export type SpmbInput = z.infer<typeof spmbSchema>;

export const progressInputSchema = z.object({
  spkId: z.string().min(1, "SPK wajib dipilih"),
  workItemId: z.string().min(1, "Item pekerjaan wajib dipilih"),
  percentageAdded: z.coerce.number().min(1, "Progress minimal 1%").max(100, "Progress maksimal 100%"),
  progressDate: z.coerce.date(),
  photoAttachmentId: z.string().trim().optional().nullable(),
  photoAttachmentIds: z.array(z.string()).optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});
export type ProgressInput = z.infer<typeof progressInputSchema>;

export const materialRequestSchema = z.object({
  spkId: z.string().min(1, "SPK wajib dipilih"),
  projectId: z.string().min(1, "Project wajib dipilih"),
  unitId: z.string().min(1, "Unit wajib dipilih"),
  vendorId: z.string().optional().nullable(),
  description: z.string().trim().min(5, "Deskripsi kebutuhan material minimal 5 karakter"),
  estimatedAmount: z.coerce.number().min(1000, "Estimasi biaya minimal Rp 1.000"),
});
export type MaterialRequestInput = z.infer<typeof materialRequestSchema>;

export const handoverEstimationSchema = z.object({
  unitId: z.string().min(1, "Unit wajib dipilih"),
  spkId: z.string().min(1, "SPK wajib dipilih"),
  handoverType: z.enum(["vendor_to_developer", "developer_to_customer"]),
  estimatedHandoverDate: z.coerce.date(),
  calculationNote: z.string().trim().optional().nullable(),
});
export type HandoverEstimationInput = z.infer<typeof handoverEstimationSchema>;

/** @deprecated Use vendorComplaintSchema or customerComplaintSchema */
export const complaintSchema = z.object({
  customerId: z.string().min(1, "Konsumen wajib dipilih"),
  unitId: z.string().min(1, "Unit wajib dipilih"),
  category: z.enum(["quality", "delay", "document", "payment", "other"]),
  description: z.string().trim().min(5, "Deskripsi komplain minimal 5 karakter"),
});
export type ComplaintInput = z.infer<typeof complaintSchema>;

// New Vendor Complaint Validators
export const vendorComplaintSchema = z.object({
  spkId: z.string().min(1, "SPK wajib dipilih"),
  vendorId: z.string().optional().nullable(),
  unitId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  title: z.string().trim().min(3, "Judul komplain minimal 3 karakter"),
  category: z.enum(["material", "cuaca", "tenaga_kerja", "akses_lokasi", "revisi_desain", "menunggu_instruksi", "kendala_teknis", "lainnya"]),
  description: z.string().trim().min(5, "Deskripsi komplain minimal 5 karakter"),
});
export type VendorComplaintInput = z.infer<typeof vendorComplaintSchema>;

export const reviewVendorComplaintSchema = z.object({
  complaintId: z.string().min(1, "ID komplain wajib diisi"),
  decision: z.enum(["resolved", "approved_extension", "need_revision", "rejected"]),
  supervisorNote: z.string().trim().min(5, "Catatan pengawas wajib diisi (minimal 5 karakter)"),
  extensionDays: z.coerce.number().optional().nullable(),
  extensionReason: z.string().trim().optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.decision === "approved_extension") {
    if (!data.extensionDays || data.extensionDays <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["extensionDays"],
        message: "Tambahan waktu wajib diisi dan lebih dari 0 hari jika pengajuan perpanjangan disetujui",
      });
    }
    if (!data.extensionReason || data.extensionReason.trim().length < 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["extensionReason"],
        message: "Alasan tambahan waktu wajib diisi (minimal 5 karakter)",
      });
    }
  }
});
export type ReviewVendorComplaintInput = z.infer<typeof reviewVendorComplaintSchema>;

// New Customer Complaint Validators
export const customerComplaintSchema = z.object({
  customerId: z.string().optional().nullable(),
  bookingId: z.string().optional().nullable(),
  unitId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  title: z.string().trim().min(3, "Judul komplain minimal 3 karakter"),
  category: z.enum(["bangunan", "serah_terima", "listrik_air", "legalitas", "fasilitas", "pelayanan", "after_sales", "lainnya"]),
  description: z.string().trim().min(5, "Deskripsi komplain minimal 5 karakter"),
  assignedToRole: z.string().optional().nullable(),
  assignedToUserId: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  if (!data.customerId && !data.bookingId && !data.unitId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["customerId"],
      message: "Konsumen, Booking, atau Unit wajib dipilih salah satu",
    });
  }
});
export type CustomerComplaintInput = z.infer<typeof customerComplaintSchema>;

export const resolveCustomerComplaintSchema = z.object({
  complaintId: z.string().min(1, "ID komplain wajib diisi"),
  resolutionStatus: z.enum(["resolved", "waiting_customer_confirmation", "follow_up_required", "rejected"]),
  developerNote: z.string().trim().min(5, "Catatan internal developer wajib diisi (minimal 5 karakter)"),
  repairAction: z.enum(["no_physical_repair", "minor_repair", "major_repair", "forwarded_to_supervisor", "forwarded_to_vendor"]),
  assignedToRole: z.string().optional().nullable(),
  assignedToUserId: z.string().optional().nullable(),
  followUpDays: z.coerce.number().optional().nullable(),
  customerMessage: z.string().trim().optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.resolutionStatus === "follow_up_required") {
    if (!data.followUpDays || data.followUpDays <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["followUpDays"],
        message: "Estimasi hari tindak lanjut wajib diisi dan lebih besar dari 0 hari",
      });
    }
  }
  
  if (data.repairAction === "forwarded_to_supervisor") {
    if (!data.assignedToRole || data.assignedToRole !== "Pengawas Lapangan") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assignedToRole"],
        message: "Role penugasan wajib 'Pengawas Lapangan' jika diteruskan ke Pengawas",
      });
    }
  }

  if (data.repairAction === "forwarded_to_vendor") {
    if (!data.assignedToRole || data.assignedToRole !== "Vendor") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assignedToRole"],
        message: "Role penugasan wajib 'Vendor' jika diteruskan ke Vendor",
      });
    }
  }
});
export type ResolveCustomerComplaintInput = z.infer<typeof resolveCustomerComplaintSchema>;
