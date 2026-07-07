import { StyleSheet } from "@react-pdf/renderer";

export const COMPANY_INFO = {
  name: "PT. Denah Property Indonesia",
  address: "Jl. Raya Utama No. 123, Kota Baru, Jawa Barat 40123",
  phone: "(022) 1234567",
  email: "info@denahproperty.co.id",
};

export const COLORS = {
  primary: "#4F6F52",
  primaryLight: "#8FAF9A",
  text: "#1a1a1a",
  textMuted: "#555555",
  border: "#cccccc",
  background: "#f9fafb",
};

export const sharedStyles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: COLORS.text,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  companyName: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: COLORS.primary,
  },
  companyDetail: {
    fontSize: 8,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  title: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 16,
    color: COLORS.primary,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    marginTop: 12,
    marginBottom: 6,
    color: COLORS.primary,
  },
  row: {
    flexDirection: "row",
    marginBottom: 4,
  },
  label: {
    width: 140,
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  value: {
    flex: 1,
    fontSize: 10,
  },
  separator: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginVertical: 10,
  },
  signatureContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 40,
  },
  signatureBox: {
    width: 200,
    alignItems: "center",
  },
  signatureLabel: {
    fontSize: 10,
    marginBottom: 50,
    fontFamily: "Helvetica-Bold",
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.text,
    width: 150,
    marginBottom: 4,
  },
  signatureName: {
    fontSize: 9,
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: COLORS.textMuted,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
  },
});

export function formatCurrency(amount: number): string {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatPaymentScheme(scheme: string): string {
  const map: Record<string, string> = {
    cash: "Cash/Tunai",
    kpr: "KPR",
    installment: "Cicilan/Installment",
  };
  return map[scheme] || scheme;
}

export function formatPaymentMethod(method: string): string {
  const map: Record<string, string> = {
    cash: "Tunai",
    transfer: "Transfer Bank",
    giro: "Giro",
    other: "Lainnya",
  };
  return map[method] || method;
}

export function formatInvoiceType(type: string): string {
  const map: Record<string, string> = {
    booking_fee: "Booking Fee",
    dp: "Uang Muka (DP)",
    installment: "Cicilan",
    other: "Lainnya",
  };
  return map[type] || type;
}
