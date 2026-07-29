/**
 * KPR Stage SLA — Stage Domain (Source of Truth)
 *
 * SATU-SATUNYA definisi tahap terukur & terminal SLA untuk seluruh fitur ini.
 * Lihat "Stage Domain — Source of Truth" pada `.kiro/specs/kpr-stage-sla-master-data/design.md`.
 *
 * Setiap validator, seed, query, UI, dan scanner WAJIB mengimpor daftar tahap
 * dari modul ini. Jangan mendeklarasikan ulang daftar tahap SLA di tempat lain.
 *
 * Aturan yang mengikat (design.md > Stage Domain — Source of Truth):
 * 1. `approved` adalah tahap terukur. KPR pada `approved` tetap dihitung SLA,
 *    tetap ikut KPI overdue, dan tetap boleh dinotifikasi scanner legacy.
 *    `approved` TIDAK boleh dimasukkan ke daftar terminal SLA di mana pun.
 * 2. `akad` adalah terminal SLA, BUKAN terminal proses bisnis. Masuk `akad`
 *    menutup kunjungan aktif tanpa membuka kunjungan baru, namun proses bisnis
 *    masih dapat berlanjut `akad -> realisasi` melalui Realisasi Dana berjalan.
 * 3. `realisasi` adalah terminal SLA sekaligus terminal jalur KPR.
 * 4. `rejected` adalah terminal SLA.
 * 5. Master_SLA hanya dapat dikonfigurasi untuk 5 tahap terukur. Tidak ada
 *    konfigurasi, seed, atau pilihan UI untuk `akad`, `rejected`, `realisasi`.
 *
 * **Validates: Requirements 26.1, 26.2, 26.3, 26.4, 26.7**
 */

/**
 * Tahap yang MEMILIKI target SLA aktif dan membuka Kunjungan_Tahap.
 * `approved` selalu measurable — bukan terminal SLA.
 */
export const MEASURED_SLA_STAGES = [
  "bi_checking",
  "pemberkasan",
  "proses_bank",
  "offering",
  "approved",
] as const;

/**
 * Tahap yang MENUTUP SLA aktif dan TIDAK membuka snapshot baru.
 * `akad` terminal untuk pengukuran SLA, tetapi bukan terminal proses bisnis
 * (proses bisnis masih dapat berlanjut `akad -> realisasi`).
 */
export const SLA_TERMINAL_STAGES = ["rejected", "akad", "realisasi"] as const;

export type MeasuredStage = (typeof MEASURED_SLA_STAGES)[number];
export type SlaTerminalStage = (typeof SLA_TERMINAL_STAGES)[number];

/** Union seluruh Tahap_KPR yang dikenal domain SLA (measured + terminal). */
export type SlaStage = MeasuredStage | SlaTerminalStage;

/**
 * Type guard total: menentukan apakah `value` adalah salah satu
 * `MEASURED_SLA_STAGES`. Aman dipakai untuk input `unknown`/string bebas.
 */
export function isMeasuredStage(value: unknown): value is MeasuredStage {
  return (
    typeof value === "string" &&
    (MEASURED_SLA_STAGES as readonly string[]).includes(value)
  );
}

/**
 * Type guard total: menentukan apakah `value` adalah salah satu
 * `SLA_TERMINAL_STAGES`. Aman dipakai untuk input `unknown`/string bebas.
 */
export function isSlaTerminalStage(value: unknown): value is SlaTerminalStage {
  return (
    typeof value === "string" &&
    (SLA_TERMINAL_STAGES as readonly string[]).includes(value)
  );
}

/**
 * KPR Stage SLA — Resolver Konfigurasi Efektif
 *
 * Fungsi murni untuk menentukan Konfigurasi_Efektif SLA per (projectId, stage)
 * dan untuk menormalisasi nilai legacy `kpr_sla_days`. Lihat design.md bagian
 * "1. Service Layer — server/services/kpr-sla/ > resolver.ts" untuk kontrak
 * lengkap dan requirements.md Requirement 3 untuk acceptance criteria.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 19.7**
 */

/** Asal Snapshot_SLA / Konfigurasi_Efektif. */
export type SlaSource = "perumahan" | "global" | "legacy";

/**
 * Bentuk minimal Master_SLA yang dibutuhkan resolver untuk menentukan
 * Konfigurasi_Efektif. Konsumen (query layer) bertanggung jawab memetakan
 * row database ke bentuk ini.
 */
export interface SlaConfigLike {
  scope: "global" | "perumahan";
  projectId: string | null;
  stage: MeasuredStage;
  workingDays: number;
  isActive: boolean;
}

/** Hasil resolusi Konfigurasi_Efektif — selalu tepat satu hasil. */
export interface ResolvedSla {
  workingDays: number;
  source: SlaSource;
  configId: string | null;
}

/** Fallback Legacy_SLA absolut ketika `kpr_sla_days` tidak tersedia/valid. */
const LEGACY_FALLBACK_DAYS = 5;

/** Batas domain kalkulasi/normalisasi Legacy_SLA (Requirement 3.4/3.9). */
const LEGACY_MIN_DAYS = 1;
const LEGACY_MAX_DAYS = 365;

/** Hanya digit base-10, tanpa tanda, tanpa desimal, tanpa teks/satuan. */
const DIGITS_ONLY_PATTERN = /^[0-9]+$/;

/**
 * Menormalisasi nilai mentah `kpr_sla_days` menjadi target Legacy_SLA yang
 * valid. Total: menerima `unknown` apa pun dan selalu mengembalikan integer.
 *
 * Valid hanya jika, setelah representasi string di-trim: non-kosong, berisi
 * HANYA digit base-10 (tanpa `+`/`-`, tanpa desimal, tanpa teks/satuan), hasil
 * parse adalah safe integer, dan berada pada rentang inklusif 1..365.
 * Selain itu (termasuk null/undefined/whitespace/"0"/"366"/"-1"/"+5"/"5.5"/
 * "5 hari") mengembalikan fallback 5.
 *
 * Deterministik: input yang sama selalu menghasilkan output yang sama.
 *
 * **Validates: Requirements 3.4, 3.5, 3.8, 3.9, 3.10**
 */
export function normalizeLegacyDays(raw: unknown): number {
  if (raw === null || raw === undefined) {
    return LEGACY_FALLBACK_DAYS;
  }

  // Hanya number dan string yang dipertimbangkan; tipe lain (boolean, object,
  // array, dll.) langsung fallback tanpa mencoba konversi implisit.
  let candidate: string;
  if (typeof raw === "number") {
    // Number non-integer (misal 5.5) atau non-finite ditolak lebih dulu;
    // representasi string dari integer finite tidak akan pernah memuat
    // tanda/desimal sehingga tetap aman diperiksa dengan pola digit-only.
    if (!Number.isFinite(raw)) {
      return LEGACY_FALLBACK_DAYS;
    }
    candidate = String(raw);
  } else if (typeof raw === "string") {
    candidate = raw.trim();
  } else {
    return LEGACY_FALLBACK_DAYS;
  }

  if (candidate.length === 0 || !DIGITS_ONLY_PATTERN.test(candidate)) {
    return LEGACY_FALLBACK_DAYS;
  }

  const parsed = Number.parseInt(candidate, 10);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < LEGACY_MIN_DAYS ||
    parsed > LEGACY_MAX_DAYS
  ) {
    return LEGACY_FALLBACK_DAYS;
  }

  return parsed;
}

/**
 * Menentukan Konfigurasi_Efektif untuk satu (projectId, stage) berdasarkan
 * prioritas resolusi: override perumahan aktif → global aktif → legacy
 * (`kpr_sla_days` dinormalisasi) → fallback 5.
 *
 * Murni dan deterministik: tidak melakukan query DB, tidak membaca waktu
 * sistem, dan tidak memutasi `input.activeConfigs`. `activeConfigs` idealnya
 * sudah difilter `isActive=true` oleh caller, namun fungsi ini tetap
 * memfilter ulang `isActive` sebagai safety net sehingga config nonaktif
 * tidak pernah terpilih meskipun lolos ke dalam array.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.6, 3.7, 2.6, 19.7**
 */
export function resolveEffectiveSla(input: {
  projectId: string;
  stage: MeasuredStage;
  activeConfigs: Array<SlaConfigLike & { id: string }>;
  legacyDays: number | string | null | undefined;
}): ResolvedSla {
  const { projectId, stage, activeConfigs, legacyDays } = input;

  const perumahanConfig = activeConfigs.find(
    (config) =>
      config.isActive &&
      config.scope === "perumahan" &&
      config.projectId === projectId &&
      config.stage === stage,
  );

  if (perumahanConfig) {
    return {
      workingDays: perumahanConfig.workingDays,
      source: "perumahan",
      configId: perumahanConfig.id,
    };
  }

  const globalConfig = activeConfigs.find(
    (config) =>
      config.isActive &&
      config.scope === "global" &&
      config.stage === stage,
  );

  if (globalConfig) {
    return {
      workingDays: globalConfig.workingDays,
      source: "global",
      configId: globalConfig.id,
    };
  }

  return {
    workingDays: normalizeLegacyDays(legacyDays),
    source: "legacy",
    configId: null,
  };
}
