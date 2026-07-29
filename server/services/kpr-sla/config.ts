/**
 * KPR Stage SLA — Configuration & Cutover Flag
 *
 * Centralized cutover configuration. The cutover flag is stored in
 * `app_settings` as key `kpr_sla_cutover_active`. When truthy ("true"/"1"),
 * the system runs in post-cutover mode:
 * - Tracking_SLA is the sole source of truth for active SLA display
 * - Legacy sync in orchestrator is disabled (fields become read-only archive)
 * - Legacy fallback is NOT used for non-terminal KPR display
 * - SLA read failures show error state, not silent legacy fallback
 * - Tracking write failures roll back status mutations (already the case)
 *
 * When the flag is absent or falsy, the system operates in dual-read
 * (pre-cutover) mode with full legacy fallback.
 *
 * **Validates: Requirements 25.5, 25.6, 25.9, 25.11**
 */

import { db } from "@/db";
import { appSettings } from "@/db/schema/system";
import { eq } from "drizzle-orm";

/**
 * The app_settings key controlling the cutover state.
 * Present and truthy ("true" or "1") = cutover active (post-cutover mode).
 * Absent or falsy = pre-cutover dual-read mode.
 */
export const KPR_SLA_CUTOVER_SETTING_KEY = "kpr_sla_cutover_active";

/**
 * Pesan Indonesia yang dipakai sisi write ketika status cutover tidak dapat
 * dibaca. Mutasi status KPR dibatalkan (bukan fallback ke legacy sync) agar
 * tracking dan legacy tidak pernah menyimpang secara diam-diam.
 */
export const KPR_SLA_CUTOVER_UNAVAILABLE_WRITE_MESSAGE =
  "Konfigurasi SLA tidak dapat dibaca. Perubahan status KPR dibatalkan untuk menjaga konsistensi data.";

/**
 * Pesan Indonesia yang dipakai sisi read ketika status cutover tidak dapat
 * dibaca. Data KPR dasar tetap ditampilkan; hanya indikator SLA yang
 * dinonaktifkan agar tidak menampilkan badge yang menyesatkan.
 */
export const KPR_SLA_CUTOVER_UNAVAILABLE_READ_MESSAGE =
  "Status konfigurasi SLA tidak dapat dibaca. Data KPR tetap tersedia, tetapi informasi SLA sementara tidak dapat ditampilkan.";

/**
 * Tri-state cutover resolution result.
 *
 * - `active`   : setting ada dan bernilai truthy ("true"/"1")
 * - `inactive` : setting tidak ada, bernilai null/kosong, atau falsy ("false"/"0")
 * - `unavailable`: pembacaan `app_settings` gagal (DB/connection error).
 *   Status ini TIDAK boleh diperlakukan sebagai `inactive` — memperlakukannya
 *   sebagai false akan menghidupkan kembali legacy fallback + legacy sync
 *   secara diam-diam setelah cutover (pelanggaran Req 25.11).
 */
export type CutoverState =
  | { status: "active"; active: true }
  | { status: "inactive"; active: false }
  | { status: "unavailable"; active: null; error: string };

/**
 * Resolves the KPR SLA cutover state from `app_settings` without ever
 * collapsing a read failure into "pre-cutover".
 *
 * This is the single source of truth for cutover state across the entire
 * SLA system. All modules (dual-read mapper caller, orchestrator caller,
 * Kanban/Detail pages) must use this and handle `unavailable` explicitly:
 * - read side  : tampilkan error state SLA non-destruktif, data KPR tetap jalan
 * - write side : batalkan mutasi status KPR (fail-closed)
 *
 * @returns Promise<CutoverState>
 */
export async function resolveCutoverState(): Promise<CutoverState> {
  let row: { value: string | null } | null;

  try {
    row = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, KPR_SLA_CUTOVER_SETTING_KEY))
      .then((rows) => rows[0] ?? null);
  } catch (err) {
    // JANGAN ubah error menjadi `false`. Laporkan sebagai unavailable.
    const message = err instanceof Error ? err.message : String(err);
    return { status: "unavailable", active: null, error: message };
  }

  // Key absent, null value, empty string, "false", "0" → inactive (valid falsy)
  if (interpretCutoverValue(row?.value)) {
    return { status: "active", active: true };
  }
  return { status: "inactive", active: false };
}

/**
 * Synchronous/pure version for use in contexts where the cutover flag has
 * already been fetched (e.g., passed as a parameter from the page/action level).
 *
 * Interprets a raw setting value as cutover active or not.
 */
export function interpretCutoverValue(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed === "true" || trimmed === "1";
}
