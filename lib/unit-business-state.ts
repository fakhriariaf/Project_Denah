export type UnitBusinessStatus =
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
  | "handover_complete"
  | string;

export type UnitReadyStockSource = "construction_flow" | "manual_ready_stock" | "legacy_ready_stock" | string | null | undefined;

export type UnitFlowType =
  | "not_marketable"
  | "indent_available"
  | "ready_stock_build"
  | "ready_stock_available"
  | "booking_indent"
  | "booking_ready_stock"
  | "kpr_indent"
  | "kpr_ready_stock"
  | "consumer_construction"
  | "consumer_construction_done"
  | "ready_stock_construction_done"
  | "handover_waiting"
  | "handover_complete"
  | "terminal"
  | "unknown";

export type UnitAllowedAction =
  | "create_booking"
  | "create_ready_stock_booking"
  | "update_progress"
  | "mark_ready_stock_available"
  | "start_consumer_construction"
  | "process_akad_ppjb"
  | "process_kpr_akad"
  | "process_customer_handover";

export interface UnitBusinessStateInput {
  status?: UnitBusinessStatus | null;
  isReadyStock?: boolean | null;
  readyStockSource?: UnitReadyStockSource;
  currentBookingId?: string | null;
  currentCustomerId?: string | null;
  constructionProgress?: number | null;
  paymentScheme?: string | null;
}

export interface UnitBusinessState {
  status: string;
  isReadyStock: boolean;
  hasBookingOrCustomer: boolean;
  readyStockSource: UnitReadyStockSource;
  flowType: UnitFlowType;
  physicalStatusLabel: string;
  salesStatusLabel: string;
  displayLabel: string;
  allowedActions: UnitAllowedAction[];
}

export function isReadyStockUnit(unit: UnitBusinessStateInput | null | undefined): boolean {
  if (!unit) return false;
  return (
    !!unit.isReadyStock ||
    unit.readyStockSource === "manual_ready_stock" ||
    unit.readyStockSource === "legacy_ready_stock"
  );
}

export function hasUnitBuyerContext(unit: UnitBusinessStateInput | null | undefined): boolean {
  if (!unit) return false;
  return !!unit.currentBookingId || !!unit.currentCustomerId;
}

export function getUnitBusinessState(unit: UnitBusinessStateInput | null | undefined): UnitBusinessState {
  const status = unit?.status ?? "unknown";
  const readyStock = isReadyStockUnit(unit);
  const hasBuyer = hasUnitBuyerContext(unit);
  const progress = unit?.constructionProgress ?? 0;

  let flowType: UnitFlowType = "unknown";
  let physicalStatusLabel = "Status fisik tidak diketahui";
  let salesStatusLabel = "Status penjualan tidak diketahui";
  let displayLabel = "Status tidak diketahui";
  let allowedActions: UnitAllowedAction[] = [];

  switch (status) {
    case "available_ready_stock":
      flowType = "ready_stock_available";
      physicalStatusLabel = "Fisik Siap Huni";
      salesStatusLabel = "Tersedia untuk Dijual";
      displayLabel = "Tersedia Siap Huni";
      allowedActions = ["create_ready_stock_booking"];
      break;

    case "construction_ready_stock":
      flowType = "ready_stock_build";
      physicalStatusLabel = "Sedang Dibangun untuk Stok";
      salesStatusLabel = "Belum Dipasarkan";
      displayLabel = "Sedang Dibangun untuk Ready Stock";
      allowedActions = ["update_progress"];
      break;

    case "belum_siap":
      flowType = "not_marketable";
      physicalStatusLabel = "Belum Siap";
      salesStatusLabel = "Belum Dipasarkan";
      displayLabel = "Belum Siap";
      break;

    case "available":
      if (readyStock) {
        flowType = "ready_stock_available";
        physicalStatusLabel = "Fisik Siap Huni";
        salesStatusLabel = "Tersedia untuk Dijual";
        displayLabel = "Tersedia Siap Huni";
        allowedActions = ["create_ready_stock_booking"];
      } else {
        flowType = "indent_available";
        physicalStatusLabel = "Fisik Belum Ready Stock";
        salesStatusLabel = "Tersedia untuk Booking";
        displayLabel = "Tersedia (Indent)";
        allowedActions = ["create_booking"];
      }
      break;

    case "booking":
      flowType = readyStock ? "booking_ready_stock" : "booking_indent";
      physicalStatusLabel = readyStock ? "Fisik Siap Huni" : "Fisik Belum Ready Stock";
      salesStatusLabel = "Booking";
      displayLabel = "Booking";
      if (!readyStock) allowedActions = ["start_consumer_construction"];
      break;

    case "kpr_process":
      flowType = readyStock ? "kpr_ready_stock" : "kpr_indent";
      physicalStatusLabel = readyStock ? "Fisik Siap Huni" : "Fisik Belum Ready Stock";
      salesStatusLabel = "Proses KPR";
      displayLabel = "Proses KPR";
      if (!readyStock) allowedActions = ["start_consumer_construction"];
      if (readyStock || progress >= 100) allowedActions.push("process_kpr_akad");
      break;

    case "construction":
      if (readyStock && !hasBuyer) {
        flowType = "ready_stock_build";
        physicalStatusLabel = "Sedang Dibangun untuk Stok";
        salesStatusLabel = "Belum Dipasarkan";
        displayLabel = "Sedang Dibangun untuk Ready Stock";
        allowedActions = ["update_progress"];
      } else {
        flowType = "consumer_construction";
        physicalStatusLabel = "Pembangunan Unit Konsumen";
        salesStatusLabel = hasBuyer ? "Terikat Konsumen" : "Belum Terikat";
        displayLabel = "Pembangunan Unit Konsumen";
        allowedActions = ["update_progress"];
      }
      break;

    case "overdue":
      flowType = readyStock && !hasBuyer ? "ready_stock_build" : "consumer_construction";
      physicalStatusLabel = readyStock && !hasBuyer ? "Sedang Dibangun untuk Stok" : "Pembangunan Unit Konsumen";
      salesStatusLabel = "Terlambat";
      displayLabel = "Terlambat";
      allowedActions = ["update_progress"];
      break;

    case "construction_done":
      if (readyStock && !hasBuyer) {
        flowType = "ready_stock_construction_done";
        physicalStatusLabel = "Selesai Bangun";
        salesStatusLabel = "Menunggu Verifikasi Siap Huni";
        displayLabel = "Selesai Bangun - Siap Ready Stock";
        allowedActions = ["mark_ready_stock_available"];
      } else {
        flowType = "consumer_construction_done";
        physicalStatusLabel = "Selesai Bangun";
        salesStatusLabel = hasBuyer ? "Siap Akad / Serah Terima" : "Belum Terikat";
        displayLabel = "Selesai Bangun - Siap Akad/Serah Terima";
        allowedActions = ["process_akad_ppjb"];
      }
      break;

    case "menunggu_serah_terima":
      flowType = "handover_waiting";
      physicalStatusLabel = "Fisik Siap Diserahterimakan";
      salesStatusLabel = "Menunggu Serah Terima";
      displayLabel = "Menunggu Serah Terima";
      allowedActions = ["process_customer_handover"];
      break;

    case "handover_complete":
      flowType = "handover_complete";
      physicalStatusLabel = "Diserahterimakan";
      salesStatusLabel = "Serah Terima Selesai";
      displayLabel = "Serah Terima Selesai";
      break;

    case "payment_pending":
      flowType = "terminal";
      physicalStatusLabel = readyStock ? "Fisik Siap Huni" : "Fisik Belum Ready Stock";
      salesStatusLabel = "Menunggu Pembayaran";
      displayLabel = "Menunggu Pembayaran";
      break;

    case "sold":
      flowType = "terminal";
      physicalStatusLabel = readyStock ? "Fisik Siap Huni" : "Fisik Selesai";
      salesStatusLabel = "Terjual";
      displayLabel = "Terjual";
      break;

    case "cancelled":
      flowType = "terminal";
      physicalStatusLabel = "Tidak Aktif";
      salesStatusLabel = "Dibatalkan";
      displayLabel = "Dibatalkan";
      break;

    default:
      flowType = "unknown";
      physicalStatusLabel = status;
      salesStatusLabel = status;
      displayLabel = status;
      break;
  }

  return {
    status,
    isReadyStock: readyStock,
    hasBookingOrCustomer: hasBuyer,
    readyStockSource: unit?.readyStockSource,
    flowType,
    physicalStatusLabel,
    salesStatusLabel,
    displayLabel,
    allowedActions,
  };
}

export function getUnitDisplayLabel(
  status: string | null | undefined,
  options?: Omit<UnitBusinessStateInput, "status"> | boolean
): string {
  if (!status) return "—";
  const normalizedOptions =
    typeof options === "boolean"
      ? { isReadyStock: options }
      : options ?? {};
  return getUnitBusinessState({ ...normalizedOptions, status }).displayLabel;
}
