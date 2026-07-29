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
  other: "Lainnya",
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

/** Customer/KPR document type labels. Kept separate from verification status. */
const CUSTOMER_DOCUMENT_TYPE_LABELS: LabelMap = {
  ktp: "Kartu Tanda Penduduk (KTP)",
  npwp: "Nomor Pokok Wajib Pajak (NPWP)",
  slip_gaji: "Slip Gaji / Penghasilan",
  kk: "Kartu Keluarga (KK)",
  spjb: "SPJB Konsumen",
  kpr_doc: "Dokumen KPR Lainnya",
  bast: "BAST",
  other: "Berkas Pendukung",
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

/**
 * Measured KPR stage labels — KPR Stage SLA Master Data, Req 1.7.
 *
 * Dedicated map (not merged into KPR_STATUS_LABELS) because the Indonesian
 * final wording for the global SLA stage label diverges from the existing
 * bank-submission-status label for `offering` ("Offering" here vs.
 * "Penawaran" for `getKprStatusLabel`/`getBankSubmissionStatusLabel`).
 * Only the 5 measured stages are defined here; `akad`, `rejected`, and
 * `realisasi` intentionally have no entry and fall through to the shared
 * fallback/em-dash contract via `lookupLabel`.
 */
const MEASURED_STAGE_LABELS: LabelMap = {
  bi_checking: "BI Checking",
  pemberkasan: "Pemberkasan",
  proses_bank: "Proses Bank",
  offering: "Offering",
  approved: "Disetujui",
};

/** Status_SLA labels — KPR Stage SLA Master Data, design.md Section 5. */
const SLA_STATUS_LABELS: LabelMap = {
  belum_dimulai: "Belum Dimulai",
  tepat_waktu: "Tepat Waktu",
  perlu_dicek: "Perlu Dicek",
  jatuh_tempo_hari_ini: "Jatuh Tempo Hari Ini",
  terlambat: "Terlambat",
  selesai_tepat_waktu: "Selesai Tepat Waktu",
  selesai_terlambat: "Selesai Terlambat",
  tidak_berlaku: "Tidak Berlaku",
};

/** Sumber_SLA labels — KPR Stage SLA Master Data, design.md Section 5. */
const SLA_SOURCE_LABELS: LabelMap = {
  perumahan: "SLA Perumahan",
  global: "SLA Global",
  legacy: "SLA Legacy",
};

/** Lingkup (SLA config scope) labels — KPR Stage SLA Master Data. */
const SLA_SCOPE_LABELS: LabelMap = {
  global: "Global",
  perumahan: "Per Perumahan",
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
  not_required: "Tidak Perlu Approval",
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
  dp: "Uang Muka/DP",
  cash_settlement: "Pelunasan Cash",
  // Payment-specific
  voided: "Dibatalkan/Void",
  // Account / budget status
  active: "Aktif",
  inactive: "Nonaktif",
  closed: "Ditutup",
};

/** Account type labels use account terminology, not payment-scheme wording. */
const ACCOUNT_TYPE_LABELS: LabelMap = {
  cash: "Kas / Tunai",
  bank: "Rekening Bank",
  receivable: "Piutang",
  payable: "Utang",
  income: "Pendapatan",
  expense: "Pengeluaran",
};

/**
 * Invoice type labels — Req 14.1
 * Dedicated map for invoice type context to avoid collision with general finance.
 */
const INVOICE_TYPE_LABELS: LabelMap = {
  booking_fee: "Booking Fee",
  dp: "Uang Muka/DP",
  installment: "Termin",
  cash_settlement: "Pelunasan Cash",
  other: "Lainnya",
};

/**
 * Invoice type labels for expense/internal context — Req 14.1
 * When the invoice is classified as internal/expense, `other` maps to
 * "Pengeluaran Internal" instead of "Lainnya".
 */
const INVOICE_TYPE_EXPENSE_LABELS: LabelMap = {
  ...INVOICE_TYPE_LABELS,
  other: "Pengeluaran Internal",
};

/**
 * Approval status labels — Req 14.2
 * Dedicated map for approval context.
 */
const APPROVAL_STATUS_LABELS: LabelMap = {
  not_required: "Tidak Perlu Approval",
  insufficient_balance: "Saldo Tidak Cukup",
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
};

/**
 * Payment status labels — Req 14.3
 * Dedicated map for payment verification status context.
 */
const PAYMENT_STATUS_LABELS: LabelMap = {
  pending: "Menunggu Verifikasi",
  verified: "Terverifikasi",
  rejected: "Ditolak",
  voided: "Dibatalkan/Void",
};

/**
 * Transaction type labels — Req 14.4
 * Dedicated map for transaction type context.
 */
const TRANSACTION_TYPE_LABELS: LabelMap = {
  income: "Pemasukan",
  expense: "Pengeluaran",
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
  in_review: "Dalam Peninjauan",
  waiting_customer_confirmation: "Menunggu Konfirmasi Konsumen",
  follow_up_required: "Perlu Tindak Lanjut",
  approved_extension: "Perpanjangan Disetujui",
  need_revision: "Perlu Revisi",
  resolved: "Selesai Ditangani",
  rejected: "Ditolak",
  closed: "Ditutup",
  cancelled: "Dibatalkan",
  // Complaint actions
  no_physical_repair: "Tidak Ada Perbaikan Fisik",
  minor_repair: "Perbaikan Ringan",
  major_repair: "Perbaikan Mayor",
  forwarded_to_supervisor: "Diteruskan ke Pengawas",
  forwarded_to_vendor: "Diteruskan ke Vendor",
};

/** Vendor and customer complaint categories, including legacy values. */
const COMPLAINT_CATEGORY_LABELS: LabelMap = {
  // Vendor complaint categories
  material: "Kekurangan Material",
  cuaca: "Cuaca Buruk",
  tenaga_kerja: "Kekurangan Pekerja",
  akses_lokasi: "Akses Lokasi Terhambat",
  revisi_desain: "Revisi Gambar / Desain",
  menunggu_instruksi: "Menunggu Instruksi",
  kendala_teknis: "Kendala Teknis Lapangan",
  // Customer complaint categories
  bangunan: "Fisik Bangunan / Dinding / Atap",
  serah_terima: "Proses Serah Terima (BAST)",
  listrik_air: "Instalasi Listrik / Air Bersih",
  legalitas: "Legalitas / SHM / PBB",
  fasilitas: "Fasilitas Umum / Lingkungan",
  pelayanan: "Pelayanan Staf / Marketing",
  after_sales: "Garansi / Layanan Purnajual",
  // Legacy complaint categories
  quality: "Kualitas",
  delay: "Keterlambatan",
  document: "Dokumen",
  payment: "Pembayaran",
  other: "Lainnya",
  lainnya: "Lain-lain",
};

const WAITING_LIST_STATUS_LABELS: LabelMap = {
  waiting: "Menunggu",
  offered: "Ditawarkan",
  converted: "Terealisasi",
  cancelled: "Dibatalkan",
};

/** Audit labels shared by the dashboard summary and the full audit page. */
const AUDIT_ACTION_LABELS: LabelMap = {
  create: "Buat Baru",
  update: "Perbarui",
  delete: "Hapus",
  approve: "Setujui",
  reject: "Tolak",
  login: "Masuk",
  logout: "Keluar",
  cancel: "Batalkan",
  bulk_delete: "Hapus Massal",
  update_access: "Ubah Hak Akses",
  kpr_realization: "Realisasi KPR",
  upgrade_to_akad: "Naik ke Tahap Akad",
  blocked_transition: "Transisi Diblokir",
  cancelbooking_blocked_paid_invoice: "Batal Booking Diblokir (Invoice Lunas)",
  cancelbooking_blocked_verified_payment: "Batal Booking Diblokir (Pembayaran Terverifikasi)",
  completeconstruction_blocked_manual_ready_stock: "Selesai Bangun Diblokir (Ready Stock Manual)",
  completeconstruction_blocked_missing_bast: "Selesai Bangun Diblokir (BAST Belum Ada)",
  updatekprprocess_blocked_transition: "Update KPR Diblokir",
  updatekprstatusdirect_blocked_transition: "Update Status KPR Diblokir",
  updateunit_blocked_edit_trans_unit: "Edit Unit Diblokir (Ada Transaksi)",
  updateunit_blocked_trans_status: "Ubah Status Diblokir (Ada Transaksi)",
};

const AUDIT_MODULE_LABELS: LabelMap = {
  auth: "Autentikasi",
  master: "Master Data",
  marketing: "Pemasaran",
  finance: "Keuangan",
  production: "Produksi",
  system: "Sistem",
  access: "Hak Akses",
  profile: "Profil",
  employment: "Kepegawaian",
  vendor_profile: "Profil Vendor",
};

const AUDIT_ENTITY_TYPE_LABELS: LabelMap = {
  bank_partner: "Bank Rekanan",
  bank_submission: "Pengajuan Bank",
  finance_account: "Rekening Keuangan",
  finance_category: "Kategori Keuangan",
  transaction: "Transaksi",
  approval: "Persetujuan",
  work_item: "Item Pekerjaan",
  project: "Proyek",
  unit: "Unit / Kavling",
  customer: "Konsumen",
  customer_document: "Dokumen Konsumen",
  vendor: "Vendor",
  lead: "Prospek",
  booking: "Booking",
  invoice: "Invoice",
  payment: "Pembayaran",
  spk: "SPK",
  spmb: "SPMB",
  complaint: "Komplain",
  user: "Pengguna",
  role: "Peran",
  notification: "Notifikasi",
  budget: "Anggaran",
  siteplan: "Siteplan",
  app_settings: "Pengaturan Sistem",
  progress_log: "Log Progres",
  attachment: "Lampiran",
  material_request: "Permintaan Material",
  material_estimation: "Estimasi Material",
  waiting_list: "Daftar Tunggu",
  target: "Target Penjualan",
  permission: "Izin Akses",
  kpr_process: "Proses KPR",
  kpr_sla_config: "Konfigurasi SLA KPR",
  kpr_sla_reconciliation: "Rekonsiliasi SLA KPR",
  unit_handover_wait: "Menunggu Serah Terima Unit",
  backfill_schedule: "Backfill Jadwal Invoice",
};

const AUDIT_STATUS_LABELS: LabelMap = {
  success: "Berhasil",
  failed: "Gagal",
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

/**
 * Measured KPR stage label — KPR Stage SLA Master Data, Req 1.7, 12.11.
 *
 * Covers only the 5 Tahap_Terukur (`bi_checking`, `pemberkasan`,
 * `proses_bank`, `offering`, `approved`). `bi_checking`, `pemberkasan`,
 * `proses_bank`, and `approved` resolve to the same label as
 * `getKprStatusLabel`; `offering` intentionally uses the Requirement 1.7
 * wording "Offering" instead of the existing bank-submission label
 * "Penawaran" to avoid redefining `getKprStatusLabel`'s contract.
 * Terminal SLA stages (`akad`, `rejected`, `realisasi`) and any unknown
 * value fall through to the shared fallback/em-dash contract.
 */
export function getMeasuredStageLabel(value: string | null | undefined): string {
  return lookupLabel(value, MEASURED_STAGE_LABELS);
}

/** Status_SLA label — KPR Stage SLA Master Data, Req 12.11. */
export function getSlaStatusLabel(value: string | null | undefined): string {
  return lookupLabel(value, SLA_STATUS_LABELS);
}

/** Sumber_SLA label — KPR Stage SLA Master Data (perumahan/global/legacy). */
export function getSlaSourceLabel(value: string | null | undefined): string {
  return lookupLabel(value, SLA_SOURCE_LABELS);
}

/** Lingkup (SLA config scope) label — KPR Stage SLA Master Data (global/perumahan). */
export function getSlaScopeLabel(value: string | null | undefined): string {
  return lookupLabel(value, SLA_SCOPE_LABELS);
}

/** Bank submission status label */
export function getBankSubmissionStatusLabel(value: string | null | undefined): string {
  return lookupLabel(value, KPR_STATUS_LABELS, GENERAL_STATUS_LABELS);
}

/** Document verification status label */
export function getDocumentVerificationStatusLabel(value: string | null | undefined): string {
  return lookupLabel(value, KPR_STATUS_LABELS);
}

/** Customer/KPR document type label */
export function getCustomerDocumentTypeLabel(value: string | null | undefined): string {
  return lookupLabel(value, CUSTOMER_DOCUMENT_TYPE_LABELS);
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

/** Vendor/customer complaint category label */
export function getComplaintCategoryLabel(value: string | null | undefined): string {
  return lookupLabel(value, COMPLAINT_CATEGORY_LABELS);
}

/** Waiting-list status label */
export function getWaitingListStatusLabel(value: string | null | undefined): string {
  return lookupLabel(value, WAITING_LIST_STATUS_LABELS, GENERAL_STATUS_LABELS);
}

/** Invoice status label */
export function getInvoiceStatusLabel(value: string | null | undefined): string {
  return lookupLabel(value, FINANCE_LABELS, GENERAL_STATUS_LABELS);
}

/**
 * Invoice type label — Req 14.1
 * Optionally accepts `context` to distinguish expense/internal invoices
 * where `other` should render as "Pengeluaran Internal".
 */
export function getInvoiceTypeLabel(
  value: string | null | undefined,
  options?: { context?: "expense" | "customer" | "neutral" }
): string {
  if (options?.context === "expense") {
    return lookupLabel(value, INVOICE_TYPE_EXPENSE_LABELS, FINANCE_LABELS);
  }
  return lookupLabel(value, INVOICE_TYPE_LABELS, FINANCE_LABELS);
}

/** Payment status label — Req 14.3 */
export function getPaymentStatusLabel(value: string | null | undefined): string {
  return lookupLabel(value, PAYMENT_STATUS_LABELS, FINANCE_LABELS, GENERAL_STATUS_LABELS);
}

/** Payment scheme label (cash, kpr, installment) */
export function getPaymentSchemeLabel(value: string | null | undefined): string {
  return lookupLabel(value, FINANCE_LABELS);
}

/** Transaction type label — Req 14.4 (income, expense, transfer) */
export function getTransactionTypeLabel(value: string | null | undefined): string {
  return lookupLabel(value, TRANSACTION_TYPE_LABELS, FINANCE_LABELS);
}

/** Approval status label — Req 14.2 */
export function getApprovalStatusLabel(value: string | null | undefined): string {
  return lookupLabel(value, APPROVAL_STATUS_LABELS, FINANCE_LABELS, GENERAL_STATUS_LABELS);
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
  return lookupLabel(value, ACCOUNT_TYPE_LABELS);
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

/** System audit-log action label */
export function getAuditActionLabel(value: string | null | undefined): string {
  return lookupLabel(value, AUDIT_ACTION_LABELS);
}

/** System audit-log module label */
export function getAuditModuleLabel(value: string | null | undefined): string {
  return lookupLabel(value, AUDIT_MODULE_LABELS);
}

/** System audit-log entity type label */
export function getAuditEntityTypeLabel(value: string | null | undefined): string {
  return lookupLabel(value, AUDIT_ENTITY_TYPE_LABELS);
}

/** System audit-log result label */
export function getAuditStatusLabel(value: string | null | undefined): string {
  return lookupLabel(value, AUDIT_STATUS_LABELS, GENERAL_STATUS_LABELS);
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
