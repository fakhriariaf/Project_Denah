export type PublicUnitStatus =
  | "Tersedia"
  | "Dalam Pemesanan"
  | "Terjual"
  | "Sedang Dibangun"
  | "Siap Huni"
  | "Tidak Tersedia";

export interface PublicSiteplanShape {
  id: string;
  unitId: string | null;
  shapeType: "polygon" | "rect" | "path";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  coordinates: any;
  label: string | null;
  colorOverride: string | null;
  unit: {
    code: string;
    cluster: string | null;
    typeName: string | null;
    landArea: number;
    buildingArea: number;
    status: string;
    constructionProgress: number;
    publicStatus: PublicUnitStatus;
    publicColors: {
      fill: string;
      stroke: string;
      text: string;
      dot: string;
    };
  } | null;
}

export interface PublicSiteplanData {
  project: {
    id: string;
    name: string;
    code: string;
  } | null;
  siteplan: {
    id: string;
    name: string;
    imageUrl: string | null;
    svgData: string | null;
    width: number | null;
    height: number | null;
  } | null;
  shapes: PublicSiteplanShape[];
  projects: {
    id: string;
    name: string;
    code: string;
  }[];
}

export const PUBLIC_STATUS_COLORS: Record<
  PublicUnitStatus,
  { fill: string; stroke: string; text: string; dot: string; label: string }
> = {
  "Tersedia": {
    fill: "#DDE8D8",
    stroke: "#4F6F52",
    text: "#2D4A30",
    dot: "#4F6F52",
    label: "Tersedia",
  },
  "Dalam Pemesanan": {
    fill: "#FFF0A0",
    stroke: "#A07C00",
    text: "#6B4F00",
    dot: "#D4A017",
    label: "Dalam Pemesanan",
  },
  "Terjual": {
    fill: "#FFD6D6",
    stroke: "#C0392B",
    text: "#8B1A1A",
    dot: "#E53E3E",
    label: "Terjual",
  },
  "Sedang Dibangun": {
    fill: "#E9DDF7",
    stroke: "#5D4382",
    text: "#3D2060",
    dot: "#7B5EA7",
    label: "Sedang Dibangun",
  },
  "Siap Huni": {
    fill: "#C8EFE0",
    stroke: "#2E7A5E",
    text: "#1A5240",
    dot: "#3DAA7E",
    label: "Siap Huni",
  },
  "Tidak Tersedia": {
    fill: "#E7E9E7",
    stroke: "#5F6861",
    text: "#3D4840",
    dot: "#7A8880",
    label: "Tidak Tersedia",
  },
};

export function mapUnitStatusToPublicStatus(
  status: string | null | undefined,
  progress: number = 0
): PublicUnitStatus {
  if (!status) return "Tidak Tersedia";

  switch (status) {
    case "available":
      return "Tersedia";
    case "booking":
      return "Dalam Pemesanan";
    case "construction":
    case "overdue":
      return progress >= 100 ? "Siap Huni" : "Sedang Dibangun";
    case "construction_done":
      return "Siap Huni";
    case "kpr_process":
    case "payment_pending":
    case "sold":
    case "menunggu_serah_terima":
    case "handover_complete":
      return "Terjual";
    case "belum_siap":
    case "cancelled":
    default:
      return "Tidak Tersedia";
  }
}

export function getPublicStatusColor(publicStatus: PublicUnitStatus) {
  return PUBLIC_STATUS_COLORS[publicStatus] || {
    fill: "#F0F0F0",
    stroke: "#AAAAAA",
    text: "#333333",
    dot: "#AAAAAA",
    label: publicStatus,
  };
}
