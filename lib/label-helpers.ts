/**
 * Centralized Label Helpers — lib/label-helpers.ts
 *
 * Pure utility module that transforms raw enum/technical values
 * into consistent Indonesian UI labels for the Denah Property ERP.
 *
 * Contract:
 * - All helpers accept `string | null | undefined`.
 * - `null`, `undefined`, and empty string after trim return "—".
 * - Known values use explicit map; never rely on fallback.
 * - Unknown values use fallback: replace `_`/`-` with space, title-case.
 * - Helpers do NOT mutate internal values (form/query/database/API).
 * - No React, database, server action, browser API, or hook imports.
 */

import { getUnitDisplayLabel } from "@/lib/unit-business-state";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LabelMap = Record<string, string>;

// ---------------------------------------------------------------------------
// Internal Utilities
// ---------------------------------------------------------------------------

/** Normalize value for case-insensitive lookup: lowercase + trim */
function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Fallback for unknown values: replace `_` and `-` with space, title-case each word.
 * If normalization yields an empty string (e.g. punctuation-only input like "_"),
 * return the em dash "—" so helpers never render a blank or raw value (Req 11.7/11.8).
 */
export function fallbackLabel(value: string): string {
  const result = value
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
  return result === "" ? "\u2014" : result;
}

// ---------------------------------------------------------------------------
// Domain Maps
// ---------------------------------------------------------------------------

const COMMON_OPTION_LABELS: LabelMap = {
  all: "Semua",
  none: "Tidak ada",
  custom: "Kustom",
  empty: "Kosong",
  unknown: "Tidak diketahui",
};

const GENERAL_STATUS_LABELS: LabelMap = {
  active: "Aktif",
  inactive: "Nonaktif",
  suspended: "Ditangguhkan",
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
  verified: "Terverifikasi",
  submitted: "Diajukan",
  offering: "Penawaran",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  closed: "Ditutup",
  open: "Terbuka",
  in_progress: "Dalam Proses",
};

const UNIT_STATUS_LABELS: LabelMap = {
  available: "Tersedia (Indent)",
  available_ready_stock: "Tersedia Siap Huni",
  belum_siap: "Belum Siap",
  booking: "Booking",
  kpr_process: "Proses KPR",
  payment_pending: "Menunggu Pembayaran",
  construction: "Pembangunan Unit Konsumen",
  construction_ready_stock: "Sedang Dibangun untuk Ready Stock",
  construction_done: "Selesai Bangun - Siap Akad/Serah Terima",
  menunggu_serah_terima: "Menunggu Serah Terima",
  handover_complete: "Serah Terima Selesai",
  sold: "Terjual",
  overdue: "Terlambat",
  cancelled: "Dibatalkan",
};

const PROJECT_STATUS_LABELS: LabelMap = {
  active: "Aktif",
  inactive: "Nonaktif",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  draft: "Draft",
  in_progress: "Dalam Proses",
};

const MARKETING_LABELS: LabelMap = {
  // Lead statuses
  new: "Baru",
  contacted: "Sudah Dihubungi",
  follow_up: "Tindak Lanjut",
  converted: "Terkonversi",
  lost: "Tidak Lanjut",
  // Lead sources
  walk_in: "Walk-in",
  ads: "Iklan",
  referral: "Referensi",
  social_media: "Media Sosial",
  website: "Website",
  site_visit: "Kunjungan Site",
  call: "Telepon",
  meeting: "Pertemuan",
  email: "Email",
  whatsapp: "WhatsApp",
  // Booking statuses
  booking: "Booking",
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
  cancelled: "Dibatalkan",
  rejected_refund: "Ditolak — Refund",
  rejected_no_refund: "Ditolak — Tanpa Refund",
  // Customer statuses
  active: "Aktif",
  inactive: "Nonaktif",
};

const KPR_STATUS_LABELS: LabelMap = {
  // KPR process stages
  bi_checking: "BI Checking",
  pemberkasan: "Pemberkasan",
  proses_bank: "Proses Bank",
  akad: "Akad",
  realisasi: "Realisasi Dana",
  // Bank submission statuses
  submitted: "Diajukan",
  verified: "Terverifikasi",
  offering: "Penawaran",
  approved: "Disetujui",
  rejected: "Ditolak",
  pending: "Menunggu",
  cancelled: "Dibatalkan",
  // BI Check statuses
  partial: "Partial",
  rejected_refund: "Ditolak — Refund",
  rejected_no_refund: "Ditolak — Tanpa Refund",
  // Document verification
  complete: "Lengkap",
  incomplete: "Belum Lengkap",
  // Document types
  spjb: "SPJB",
  kpr_doc: "Dokumen KPR",
  ktp: "KTP",
  npwp: "NPWP",
  slip_gaji: "Slip Gaji",
  kk: "Kartu Keluarga",
  bast: "BAST",
  other: "Lainnya",
};

const PRODUCTION_LABELS: LabelMap = {
  // SPK statuses
  draft: "Draft",
  active: "Aktif",
  in_progress: "Dalam Proses",
  proses_konstruksi: "Proses Konstruksi",
  selesai_konstruksi: "Selesai Konstruksi",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  overdue: "Terlambat",
  // BAST types
  vendor_to_developer: "BAST Vendor ke Developer",
  developer_to_customer: "BAST Developer ke Konsumen",
  // Delay reasons
  material: "Kekurangan Material",
  cuaca: "Cuaca Buruk",
  tenaga_kerja: "Kekurangan Pekerja",
  akses_lokasi: "Akses Lokasi Terhambat",
  revisi_desain: "Revisi Desain",
  menunggu_instruksi: "Menunggu Instruksi",
  kendala_teknis: "Kendala Teknis",
  lainnya: "Lainnya",
};

const FINANCE_LABELS: LabelMap = {
  // Payment/invoice status
  paid: "Lunas",
  unpaid: "Belum Dibayar",
  partial: "Dibayar Sebagian",
  overdue: "Terlambat",
  cancelled: "Dibatalkan",
  draft: "Draft",
  // Approval / verification
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
  verified: "Terverifikasi",
  not_required: "Tidak Perlu Persetujuan",
  insufficient_balance: "Saldo Tidak Cukup",
  // Payment schemes
  cash: "Tunai",
  kpr: "KPR",
  installment: "Cicilan",
  // Transaction types
  income: "Pemasukan",
  expense: "Pengeluaran",
  transfer: "Transfer",
  // Payment methods
  giro: "Giro",
  other: "Lainnya",
  bank: "Bank",
  // Account types
  receivable: "Piutang",
  payable: "Utang",
  // Invoice types
  booking_fee: "Booking Fee",
  dp: "DP",
  // Account / budget status
  active: "Aktif",
  inactive: "Nonaktif",
  closed: "Ditutup",
};

const ACTIVITY_ACTION_LABELS: LabelMap = {
  // finance_activity_history action values (15 total, Req 3.7)
  created: "Dibuat",
  submitted: "Diajukan",
  approved: "Disetujui",
  verified: "Terverifikasi",
  rejected: "Ditolak",
  revised: "Direvisi",
  resubmitted: "Diajukan Ulang",
  cancelled: "Dibatalkan",
  reversed: "Dibalik",
  corrected: "Dikoreksi",
  updated: "Diperbarui",
  activated: "Diaktifkan",
  closed: "Ditutup",
  paid_partial: "Dibayar Sebagian",
  paid_full: "Lunas",
};

const COMPLAINT_LABELS: LabelMap = {
  // Complaint statuses
  open: "Terbuka",
  in_progress: "Dalam Proses",
  waiting_customer_confirmation: "Menunggu Konfirmasi Konsumen",
  follow_up_required: "Perlu Tindak Lanjut",
  approved_extension: "Perpanjangan Disetujui",
  need_revision: "Perlu Revisi",
  resolved: "Selesai Ditangani",
  closed: "Ditutup",
  cancelled: "Dibatalkan",
  // Complaint actions
  no_physical_repair: "Tidak Ada Perbaikan Fisik",
  minor_repair: "Perbaikan Ringan",
  major_repair: "Perbaikan Mayor",
  forwarded_to_supervisor: "Diteruskan ke Pengawas",
  forwarded_to_vendor: "Diteruskan ke Vendor",
};

// ---------------------------------------------------------------------------
// Generic lookup helper
// ---------------------------------------------------------------------------

const EM_DASH = "\u2014";

function lookupLabel(
  value: string | null | undefined,
  ...maps: LabelMap[]
): string {
  if (value == null) return EM_DASH;
  const trimmed = value.trim();
  if (trimmed === "") return EM_DASH;
  const key = normalize(trimmed);
  for (const map of maps) {
    if (Object.hasOwn(map, key)) return map[key];
  }
  return fallbackLabel(trimmed);
}

// ---------------------------------------------------------------------------
// Exported Getter Functions
// ---------------------------------------------------------------------------

/** General status label — searches general status + common options */
export function getStatusLabel(value: string | null | undefined): string {
  return lookupLabel(value, GENERAL_STATUS_LABELS, COMMON_OPTION_LABELS);
}

/** Common option labels: all, none, custom, empty, unknown */
export function getCommonOptionLabel(value: string | null | undefined): string {
  return lookupLabel(value, COMMON_OPTION_LABELS);
}

/** Filter option labels (alias for common options in filter context) */
export function getFilterOptionLabel(value: string | null | undefined): string {
  return lookupLabel(value, COMMON_OPTION_LABELS, GENERAL_STATUS_LABELS);
}

/** Unit status label with optional ready stock variant */
export function getUnitStatusLabel(
  value: string | null | undefined,
  options?: { isReadyStock?: boolean }
): string {
  if (value == null) return EM_DASH;
  const trimmed = value.trim();
  if (trimmed === "") return EM_DASH;
  let key = normalize(trimmed);
  if (options?.isReadyStock) {
    if (key === "available") key = "available_ready_stock";
    else if (key === "construction") key = "construction_ready_stock";
  }
  if (key in UNIT_STATUS_LABELS) return getUnitDisplayLabel(key, options);
  if (key in GENERAL_STATUS_LABELS) return GENERAL_STATUS_LABELS[key];
  return fallbackLabel(trimmed);
}

/** Project status label */
export function getProjectStatusLabel(value: string | null | undefined): string {
  return lookupLabel(value, PROJECT_STATUS_LABELS, GENERAL_STATUS_LABELS);
}

/** Booking status label */
export function getBookingStatusLabel(value: string | null | undefined): string {
  return lookupLabel(value, MARKETING_LABELS, GENERAL_STATUS_LABELS);
}

/** Lead status label */
export function getLeadStatusLabel(value: string | null | undefined): string {
  return lookupLabel(value, MARKETING_LABELS, GENERAL_STATUS_LABELS);
}

/** Lead source label */
export function getLeadSourceLabel(value: string | null | undefined): string {
  return lookupLabel(value, MARKETING_LABELS);
}

/** Customer status label */
export function getCustomerStatusLabel(value: string | null | undefined): string {
  return lookupLabel(value, MARKETING_LABELS, GENERAL_STATUS_LABELS);
}

/** KPR process status label */
export function getKprStatusLabel(value: string | null | undefined): string {
  return lookupLabel(value, KPR_STATUS_LABELS, GENERAL_STATUS_LABELS);
}

/** Bank submission status label */
export function getBankSubmissionStatusLabel(value: string | null | undefined): string {
  return lookupLabel(value, KPR_STATUS_LABELS, GENERAL_STATUS_LABELS);
}

/** Document verification status label */
export function getDocumentVerificationStatusLabel(value: string | null | undefined): string {
  return lookupLabel(value, KPR_STATUS_LABELS);
}

/** SPK (construction work order) status label */
export function getSpkStatusLabel(value: string | null | undefined): string {
  return lookupLabel(value, PRODUCTION_LABELS, GENERAL_STATUS_LABELS);
}

/** Complaint status label */
export function getComplaintStatusLabel(value: string | null | undefined): string {
  return lookupLabel(value, COMPLAINT_LABELS, GENERAL_STATUS_LABELS);
}

/** Complaint action label */
export function getComplaintActionLabel(value: string | null | undefined): string {
  return lookupLabel(value, COMPLAINT_LABELS, PRODUCTION_LABELS);
}

/** Invoice status label */
export function getInvoiceStatusLabel(value: string | null | undefined): string {
  return lookupLabel(value, FINANCE_LABELS, GENERAL_STATUS_LABELS);
}

/** Invoice type label */
export function getInvoiceTypeLabel(value: string | null | undefined): string {
  return lookupLabel(value, FINANCE_LABELS);
}

/** Payment status label */
export function getPaymentStatusLabel(value: string | null | undefined): string {
  return lookupLabel(value, FINANCE_LABELS, GENERAL_STATUS_LABELS);
}

/** Payment scheme label (cash, kpr, installment) */
export function getPaymentSchemeLabel(value: string | null | undefined): string {
  return lookupLabel(value, FINANCE_LABELS);
}

/** Transaction type label (income, expense, transfer) */
export function getTransactionTypeLabel(value: string | null | undefined): string {
  return lookupLabel(value, FINANCE_LABELS);
}

/** Approval status label */
export function getApprovalStatusLabel(value: string | null | undefined): string {
  return lookupLabel(value, FINANCE_LABELS, GENERAL_STATUS_LABELS);
}

/** Payment method label (transfer, giro, bank, other) */
export function getPaymentMethodLabel(value: string | null | undefined): string {
  return lookupLabel(value, FINANCE_LABELS);
}

/** Account status label */
export function getAccountStatusLabel(value: string | null | undefined): string {
  return lookupLabel(value, FINANCE_LABELS, GENERAL_STATUS_LABELS);
}

/** Account type label (receivable, payable) */
export function getAccountTypeLabel(value: string | null | undefined): string {
  return lookupLabel(value, FINANCE_LABELS);
}

/** Budget status label */
export function getBudgetStatusLabel(value: string | null | undefined): string {
  return lookupLabel(value, FINANCE_LABELS, GENERAL_STATUS_LABELS);
}

/**
 * Finance activity/timeline action label — covers all 15
 * `finance_activity_history` action values with explicit Bahasa Indonesia
 * labels; falls back to FINANCE_LABELS then defensive fallback for safety.
 */
export function getActivityActionLabel(value: string | null | undefined): string {
  return lookupLabel(value, ACTIVITY_ACTION_LABELS, FINANCE_LABELS);
}

/**
 * Invoice schedule label — pure helper shared by UI & report.
 *
 * Resolves the human-facing schedule label for an invoice from its schedule
 * identity (`scheduleKind` + `scheduleSequence`) with an explicit override
 * (`scheduleLabel`) and a legacy-safe fallback by `type`.
 *
 * Resolution order:
 * 1. `scheduleLabel` present → return it verbatim (explicit override).
 * 2. `scheduleKind === "cash_settlement"` → "Pelunasan Cash".
 * 3. `scheduleKind === "installment"` with a truthy `scheduleSequence` →
 *    `Termin ${scheduleSequence}`.
 * 4. Fallback by `type`: booking_fee → "Booking Fee"; dp → "Uang Muka (DP)";
 *    installment → "Cicilan / Pelunasan"; anything else → "Lainnya".
 *
 * Total and legacy-safe: never throws, and null schedule fields (legacy rows)
 * fall through to the `type`-based fallback.
 *
 * _Requirements: 1.7, 1.17, 13.1, 13.3_
 */
export function invoiceScheduleLabel(inv: {
  type: string;
  scheduleKind: string | null;
  scheduleSequence: number | null;
  scheduleLabel: string | null;
}): string {
  if (inv.scheduleLabel) return inv.scheduleLabel;
  if (inv.scheduleKind === "cash_settlement") return "Pelunasan Cash";
  if (inv.scheduleKind === "installment" && inv.scheduleSequence)
    return `Termin ${inv.scheduleSequence}`;
  // Fallback legacy: resolve by invoice type.
  switch (inv.type) {
    case "booking_fee":
      return "Booking Fee";
    case "dp":
      return "Uang Muka (DP)";
    case "installment":
      return "Cicilan / Pelunasan";
    default:
      return "Lainnya";
  }
}
