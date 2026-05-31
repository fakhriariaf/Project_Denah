export type UnitStatus =
  | "available"
  | "belum_siap"
  | "booking"
  | "kpr_process"
  | "payment_pending"
  | "sold"
  | "construction"
  | "construction_done"
  | "overdue"
  | "cancelled"
  | "menunggu_serah_terima"
  | "handover_complete";

/**
 * STATUS_COLORS — single source of truth for all kavling/unit status colors.
 * Aligned with the E2E Simulation Table (e2e_simulation_table.md):
 *   🟢 available       → Sage Green   (#DDE8D8 / #4F6F52)
 *   🟢 available_ready_stock → Dark Green (#3F5941 / #243525)
 *   🟡 booking         → Amber Yellow (#FFF0A0 / #8A6D1D)
 *   🔵 kpr_process     → Cyan Blue    (#C7E8F7 / #1C6080)
 *   @@ payment_pending   → Orange/Peach (#FBE4C9 / #9A5C21)
 *   🟣 construction    → Muted Purple (#E9DDF7 / #5D4382)
 *   🟣 construction_ready_stock → Dark Purple (#4B286D / #2C1445)
 *   🟩 construction_done → Mint Green (#C8EFE0 / #2E7A5E)
 *   🔴 sold            → Coral Red   (#FFD6D6 / #C0392B)
 */
export const STATUS_COLORS: Record<
  UnitStatus | "available_ready_stock" | "construction_ready_stock",
  { fill: string; stroke: string; text: string; label: string; dot: string }
> = {
  available:         { fill: "#DDE8D8", stroke: "#4F6F52", text: "#2D4A30", dot: "#4F6F52",  label: "Tersedia" },
  available_ready_stock: { fill: "#3F5941", stroke: "#243525", text: "#FFFFFF", dot: "#3F5941", label: "Tersedia - Ready Stock" },
  belum_siap:        { fill: "#FFFFFF", stroke: "#D6DED2", text: "#66736A", dot: "#AAB5AF",  label: "Belum Siap" },
  booking:           { fill: "#FFF0A0", stroke: "#A07C00", text: "#6B4F00", dot: "#D4A017",  label: "Booking" },
  kpr_process:       { fill: "#C7E8F7", stroke: "#1C6080", text: "#0E3F57", dot: "#2196C4",  label: "Proses KPR" },
  payment_pending:   { fill: "#FBE4C9", stroke: "#9A5C21", text: "#7A3D0E", dot: "#D47A2E",  label: "Pending Bayar" },
  construction:      { fill: "#E9DDF7", stroke: "#5D4382", text: "#3D2060", dot: "#7B5EA7",  label: "Proses Bangun" },
  construction_ready_stock: { fill: "#4B286D", stroke: "#2C1445", text: "#FFFFFF", dot: "#4B286D", label: "Bangun - Ready Stock" },
  construction_done: { fill: "#C8EFE0", stroke: "#2E7A5E", text: "#1A5240", dot: "#3DAA7E",  label: "Bangunan Selesai" },
  sold:              { fill: "#FFD6D6", stroke: "#C0392B", text: "#8B1A1A", dot: "#E53E3E",  label: "Terjual" },
  overdue:           { fill: "#F8D4DA", stroke: "#8B3443", text: "#6A1B2A", dot: "#C04060",  label: "Overdue" },
  cancelled:         { fill: "#E7E9E7", stroke: "#5F6861", text: "#3D4840", dot: "#7A8880",  label: "Batal" },
  // Status serah terima — Frontend mengatur warna, backend hanya mengembalikan string status
  menunggu_serah_terima: { fill: "#EDE9FE", stroke: "#7C3AED", text: "#4C1D95", dot: "#7C3AED", label: "Menunggu Serah Terima" },
  handover_complete:     { fill: "#CCFBF1", stroke: "#0F766E", text: "#134E4A", dot: "#0F766E", label: "Serah Terima Selesai" },
};

/**
 * Badge className map for Tailwind-based Badge components (units page, etc.)
 * Mirrors STATUS_COLORS — update both together if you change a color.
 */
export const UNIT_STATUS_BADGE: Record<
  UnitStatus | "available_ready_stock" | "construction_ready_stock",
  { label: string; badgeClass: string; dotColor: string }
> = {
  available:         { label: "Tersedia",          dotColor: "#4F6F52",  badgeClass: "bg-[#DDE8D8] text-[#2D4A30] border-[#4F6F52]/30" },
  available_ready_stock: { label: "Tersedia - Ready Stock", dotColor: "#3F5941", badgeClass: "bg-[#3F5941] text-white border-[#243525]/30" },
  belum_siap:        { label: "Belum Siap",        dotColor: "#AAB5AF",  badgeClass: "bg-[#FFFFFF] text-[#66736A] border-[#D6DED2]" },
  booking:           { label: "Booking",            dotColor: "#D4A017",  badgeClass: "bg-[#FFF0A0] text-[#6B4F00] border-[#A07C00]/30" },
  kpr_process:       { label: "Proses KPR",         dotColor: "#2196C4",  badgeClass: "bg-[#C7E8F7] text-[#0E3F57] border-[#1C6080]/30" },
  payment_pending:   { label: "Pending Bayar",      dotColor: "#D47A2E",  badgeClass: "bg-[#FBE4C9] text-[#7A3D0E] border-[#9A5C21]/30" },
  construction:      { label: "Proses Bangun",      dotColor: "#7B5EA7",  badgeClass: "bg-[#E9DDF7] text-[#3D2060] border-[#5D4382]/30" },
  construction_ready_stock: { label: "Bangun - Ready Stock", dotColor: "#4B286D", badgeClass: "bg-[#4B286D] text-white border-[#2C1445]/30" },
  construction_done: { label: "Bangunan Selesai",   dotColor: "#3DAA7E",  badgeClass: "bg-[#C8EFE0] text-[#1A5240] border-[#2E7A5E]/30" },
  sold:              { label: "Terjual",             dotColor: "#E53E3E",  badgeClass: "bg-[#FFD6D6] text-[#8B1A1A] border-[#C0392B]/30" },
  overdue:           { label: "Overdue",             dotColor: "#C04060",  badgeClass: "bg-[#F8D4DA] text-[#6A1B2A] border-[#8B3443]/30" },
  cancelled:         { label: "Batal",               dotColor: "#7A8880",  badgeClass: "bg-[#E7E9E7] text-[#3D4840] border-[#5F6861]/30" },
  // Status serah terima — frontend mengatur warna
  menunggu_serah_terima: { label: "Menunggu Serah Terima", dotColor: "#7C3AED", badgeClass: "bg-[#EDE9FE] text-[#4C1D95] border-[#7C3AED]/30" },
  handover_complete:     { label: "Serah Terima Selesai",  dotColor: "#0F766E", badgeClass: "bg-[#CCFBF1] text-[#134E4A] border-[#0F766E]/30" },
};

export const DEFAULT_SHAPE_COLOR = { fill: "#F0F0F0", stroke: "#AAAAAA", text: "#333333" };

export function getStatusColor(status: string | null | undefined, isReadyStock: boolean = false) {
  if (!status) return DEFAULT_SHAPE_COLOR;
  let key = status;
  if (isReadyStock) {
    if (status === "available") key = "available_ready_stock";
    else if (status === "construction") key = "construction_ready_stock";
  }
  return STATUS_COLORS[key as keyof typeof STATUS_COLORS] ?? DEFAULT_SHAPE_COLOR;
}

export function getUnitStatusLabel(status: string | null | undefined, isReadyStock: boolean = false, t?: any) {
  if (!status) return "—";
  let key = status;
  if (isReadyStock) {
    if (status === "available") key = "available_ready_stock";
    else if (status === "construction") key = "construction_ready_stock";
  }
  const baseKey = `timeline.${key}`;
  return t ? t(baseKey) : (STATUS_COLORS[key as keyof typeof STATUS_COLORS]?.label ?? status);
}

export function getStatusBadge(status: string | null | undefined, isReadyStock: boolean = false, t?: any) {
  if (!status) return { label: "—", badgeClass: "", dotColor: "#AAAAAA" };
  let key = status;
  if (isReadyStock) {
    if (status === "available") key = "available_ready_stock";
    else if (status === "construction") key = "construction_ready_stock";
  }
  const base = UNIT_STATUS_BADGE[key as keyof typeof UNIT_STATUS_BADGE] ?? { label: status, badgeClass: "", dotColor: "#AAAAAA" };
  const baseKey = `timeline.${key}`;
  const labelTranslated = t ? t(baseKey) : base.label;
  return {
    ...base,
    label: labelTranslated,
  };
}

export function coordsToPolygonPoints(coords: { x: number; y: number }[]): string {
  return coords.map(c => `${c.x},${c.y}`).join(" ");
}
