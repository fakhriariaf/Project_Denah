import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import {
  sharedStyles,
  COMPANY_INFO,
  COLORS,
  formatCurrency,
  formatDate,
  formatInvoiceType,
} from "./shared-styles";

const invoiceStyles = StyleSheet.create({
  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.primary,
    padding: 6,
    marginTop: 8,
  },
  tableHeaderText: {
    color: "#ffffff",
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  tableRow: {
    flexDirection: "row",
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  colNo: { width: 30 },
  colType: { width: 100 },
  colDescription: { flex: 1 },
  colAmount: { width: 120, textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    padding: 8,
    backgroundColor: COLORS.background,
    marginTop: 2,
  },
  totalLabel: {
    flex: 1,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    paddingRight: 10,
  },
  totalValue: {
    width: 120,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
  },
  statusBadge: {
    marginTop: 8,
    padding: 4,
    alignSelf: "flex-end",
    borderRadius: 3,
  },
  bankInfo: {
    marginTop: 16,
    padding: 10,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
  },
});

export interface InvoiceData {
  invoiceNumber: string;
  type: string;
  amount: number;
  dueDate: Date | string | null;
  status: string;
  notes: string | null;
  createdAt: Date | string;
  customer: {
    name: string;
    phone: string;
    address: string | null;
  };
  unit: {
    code: string;
  } | null;
  project: {
    name: string;
  };
  booking: {
    bookingNumber: string;
  } | null;
}

export function InvoiceTemplate({ data }: { data: InvoiceData }) {
  const statusLabel: Record<string, string> = {
    unpaid: "BELUM LUNAS",
    partial: "SEBAGIAN",
    paid: "LUNAS",
    cancelled: "DIBATALKAN",
  };

  return (
    <Document>
      <Page size="A4" style={sharedStyles.page}>
        {/* Header */}
        <View style={sharedStyles.header}>
          <View>
            <Text style={sharedStyles.companyName}>{COMPANY_INFO.name}</Text>
            <Text style={sharedStyles.companyDetail}>{COMPANY_INFO.address}</Text>
            <Text style={sharedStyles.companyDetail}>
              Telp: {COMPANY_INFO.phone} | Email: {COMPANY_INFO.email}
            </Text>
          </View>
        </View>

        {/* Title */}
        <Text style={sharedStyles.title}>INVOICE</Text>

        {/* Invoice Info */}
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View>
            <View style={sharedStyles.row}>
              <Text style={sharedStyles.label}>No. Invoice</Text>
              <Text style={sharedStyles.value}>: {data.invoiceNumber}</Text>
            </View>
            <View style={sharedStyles.row}>
              <Text style={sharedStyles.label}>Tanggal Terbit</Text>
              <Text style={sharedStyles.value}>: {formatDate(data.createdAt)}</Text>
            </View>
            <View style={sharedStyles.row}>
              <Text style={sharedStyles.label}>Jatuh Tempo</Text>
              <Text style={sharedStyles.value}>: {formatDate(data.dueDate)}</Text>
            </View>
            {data.booking && (
              <View style={sharedStyles.row}>
                <Text style={sharedStyles.label}>No. Booking</Text>
                <Text style={sharedStyles.value}>: {data.booking.bookingNumber}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={sharedStyles.separator} />

        {/* Customer */}
        <Text style={sharedStyles.sectionTitle}>Ditagihkan Kepada</Text>
        <View style={sharedStyles.row}>
          <Text style={sharedStyles.label}>Nama</Text>
          <Text style={sharedStyles.value}>: {data.customer.name}</Text>
        </View>
        <View style={sharedStyles.row}>
          <Text style={sharedStyles.label}>No. Telepon</Text>
          <Text style={sharedStyles.value}>: {data.customer.phone}</Text>
        </View>
        <View style={sharedStyles.row}>
          <Text style={sharedStyles.label}>Alamat</Text>
          <Text style={sharedStyles.value}>: {data.customer.address || "-"}</Text>
        </View>

        {/* Table */}
        <View style={invoiceStyles.tableHeader}>
          <Text style={[invoiceStyles.tableHeaderText, invoiceStyles.colNo]}>No</Text>
          <Text style={[invoiceStyles.tableHeaderText, invoiceStyles.colType]}>Jenis</Text>
          <Text style={[invoiceStyles.tableHeaderText, invoiceStyles.colDescription]}>Keterangan</Text>
          <Text style={[invoiceStyles.tableHeaderText, invoiceStyles.colAmount]}>Jumlah</Text>
        </View>

        <View style={invoiceStyles.tableRow}>
          <Text style={invoiceStyles.colNo}>1</Text>
          <Text style={invoiceStyles.colType}>{formatInvoiceType(data.type)}</Text>
          <Text style={invoiceStyles.colDescription}>
            {data.unit ? `Unit ${data.unit.code} - ${data.project.name}` : data.project.name}
            {data.notes ? ` (${data.notes})` : ""}
          </Text>
          <Text style={invoiceStyles.colAmount}>{formatCurrency(data.amount)}</Text>
        </View>

        {/* Total */}
        <View style={invoiceStyles.totalRow}>
          <Text style={invoiceStyles.totalLabel}>TOTAL</Text>
          <Text style={invoiceStyles.totalValue}>{formatCurrency(data.amount)}</Text>
        </View>

        {/* Status */}
        <View style={[invoiceStyles.statusBadge, {
          backgroundColor: data.status === "paid" ? "#dcfce7" : data.status === "cancelled" ? "#fee2e2" : "#fef9c3",
        }]}>
          <Text style={{
            fontSize: 9,
            fontFamily: "Helvetica-Bold",
            color: data.status === "paid" ? "#166534" : data.status === "cancelled" ? "#991b1b" : "#854d0e",
          }}>
            Status: {statusLabel[data.status] || data.status.toUpperCase()}
          </Text>
        </View>

        {/* Bank Info */}
        {data.status !== "paid" && data.status !== "cancelled" && (
          <View style={invoiceStyles.bankInfo}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 4 }}>
              Informasi Pembayaran:
            </Text>
            <Text style={{ fontSize: 9, marginBottom: 2 }}>
              Bank: BCA
            </Text>
            <Text style={{ fontSize: 9, marginBottom: 2 }}>
              No. Rekening: 123-456-7890
            </Text>
            <Text style={{ fontSize: 9, marginBottom: 2 }}>
              Atas Nama: PT. Denah Property Indonesia
            </Text>
            <Text style={{ fontSize: 9, marginTop: 6, color: COLORS.textMuted }}>
              * Mohon cantumkan nomor invoice pada berita transfer
            </Text>
          </View>
        )}

        {/* Footer */}
        <Text style={sharedStyles.footer}>
          {COMPANY_INFO.name} — {COMPANY_INFO.address} — {COMPANY_INFO.phone}
        </Text>
      </Page>
    </Document>
  );
}
