/**
 * KPR Stage SLA — Validator Master SLA (Zod)
 *
 * Validasi input untuk create/update Master_SLA. Import tahap terukur dan
 * terminal dari resolver sebagai satu-satunya sumber kebenaran domain tahap.
 *
 * Strategi validasi stage: menggunakan `z.string()` lalu refine untuk
 * memberikan pesan berbeda antara tahap terminal (pesan spesifik Indonesia)
 * dan string tidak dikenal (pesan generik).
 *
 * **Validates: Requirements 1.2, 1.3, 2.2, 2.3, 26.5**
 */
import { z } from "zod";
import {
  MEASURED_SLA_STAGES,
  SLA_TERMINAL_STAGES,
} from "@/server/services/kpr-sla/resolver";

/**
 * Schema validasi untuk create/update Master_SLA.
 *
 * - scope: "global" | "perumahan"
 * - projectId: null untuk global, wajib ada untuk perumahan
 * - stage: hanya 5 tahap terukur; tahap terminal ditolak dengan pesan khusus
 * - workingDays: integer 1..60
 * - isActive: default true
 */
export const kprSlaConfigSchema = z
  .object({
    scope: z.enum(["global", "perumahan"]),
    projectId: z.string().min(1).nullable(),
    stage: z.string().min(1, "Tahap KPR wajib dipilih"),
    workingDays: z
      .number({ error: "Target SLA (Hari Kerja) wajib diisi" })
      .int("Target SLA harus bilangan bulat")
      .min(1, "Target SLA minimal 1 Hari Kerja")
      .max(60, "Target SLA maksimal 60 Hari Kerja"),
    isActive: z.boolean().default(true),
  })
  .superRefine((val, ctx) => {
    // Check stage: terminal stages get specific message, unknown stages get generic
    const stage = val.stage;

    if (
      (SLA_TERMINAL_STAGES as readonly string[]).includes(stage)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tahap ini tidak memiliki target SLA",
        path: ["stage"],
      });
      return; // No need to check further
    }

    if (
      !(MEASURED_SLA_STAGES as readonly string[]).includes(stage)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tahap KPR tidak valid",
        path: ["stage"],
      });
      return;
    }

    // Check projectId constraint based on scope
    if (val.scope === "global" && val.projectId !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Global scope tidak memerlukan perumahan",
        path: ["projectId"],
      });
    }

    if (val.scope === "perumahan" && !val.projectId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Perumahan wajib dipilih",
        path: ["projectId"],
      });
    }
  });

export type KprSlaConfigInput = z.infer<typeof kprSlaConfigSchema>;
