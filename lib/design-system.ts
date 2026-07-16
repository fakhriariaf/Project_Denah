export const denahDesignTokens = {
  color: {
    primarySage: "#8FAF9A",
    primaryDark: "#4F6F52",
    primaryLight: "#DDE8D8",
    background: "#F7F8F3",
    surface: "#FFFFFF",
    border: "#D6DED2",
    textPrimary: "#243028",
    textSecondary: "#66736A",
    success: "#7AA874",
    warning: "#E9C46A",
    danger: "#D77A7A",
    info: "#8FB8D8",
    purple: "#B8A4D9",
    rose: "#E8A0A8",
    gray: "#A8B0AA",
  },
  radius: {
    card: "16px",
    button: "12px",
    badge: "999px",
  },
  shadow: {
    sage: "0 4px 20px -2px rgba(79, 111, 82, 0.08), 0 2px 8px -1px rgba(79, 111, 82, 0.04)",
    sageLg: "0 12px 30px -4px rgba(79, 111, 82, 0.12), 0 4px 12px -2px rgba(79, 111, 82, 0.06)",
  },
  typography: {
    fontSans: '"Inter", "Segoe UI", Roboto, Arial, sans-serif',
    fontMono: '"Roboto Mono", "Courier New", monospace',
    pageTitle: "24px",
    sectionTitle: "18px",
    cardTitle: "16px",
    body: "14px",
    table: "13px",
    caption: "12px",
  },
} as const;

export const unitStatusColorMap = {
  available: {
    label: "Tersedia (Indent)",
    bg: "#DDE8D8",
    text: "#4F6F52",
  },
  booking: {
    label: "Booking",
    bg: "#FFF2C2",
    text: "#8A6D1D",
  },
  kpr_process: {
    label: "Proses KPR",
    bg: "#DCECF7",
    text: "#33627A",
  },
  payment_pending: {
    label: "Pending Pembayaran",
    bg: "#FBE4C9",
    text: "#9A5C21",
  },
  sold: {
    label: "Terjual",
    bg: "#F3D1D1",
    text: "#8A3030",
  },
  construction: {
    label: "Pembangunan Unit Konsumen",
    bg: "#E9DDF7",
    text: "#5D4382",
  },
  construction_done: {
    label: "Selesai Bangun - Siap Akad/Serah Terima",
    bg: "#D4EEE7",
    text: "#3F7568",
  },
  overdue: {
    label: "Overdue",
    bg: "#F8D4DA",
    text: "#8B3443",
  },
  cancelled: {
    label: "Batal",
    bg: "#E7E9E7",
    text: "#5F6861",
  },
} as const;
