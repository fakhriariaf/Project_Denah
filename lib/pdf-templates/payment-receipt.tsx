import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import {
  sharedStyles,
  COMPANY_INFO,
  COLORS,
  formatCurrency,
  formatDate,
} from "./shared-styles";
import { getPaymentMethodLabel, getInvoiceTypeLabel } from "@/lib/label-helpers";

const receiptStyles = StyleSheet.create({
  receiptBox: {
    border: `2px solid ${COLORS.primary}`,
    borderWidth: 2,
    borderColor: COLORS.primary,
    padding: 20,
    marginTop: 10,
  },
  amountBox: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginVertical: 12,
    alignItems: "center",
  },
  amountLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: COLORS.primary,
  },
});

export interface PaymentReceiptData {
  paymentNumber: string;
  amount: number;
  paymentDate: Date | string;
  paymentMethod: string;
  status: string;
  customer: {
    name: string;
    phone: string;
    address: string | null;
  };
  invoice: {
    invoiceNumber: string;
    type: string;
  } | null;
  unit: {
    code: string;
  } | null;
  project: {
    name: string;
  };
  verifiedBy: {
    name: string;
  } | null;
}

export function PaymentReceiptTemplate({ data }: { data: PaymentReceiptData }) {
  const description = data.invoice
    ? `Pembayaran ${getInvoiceTypeLabel(data.invoice.type)}${data.unit ? ` Unit ${data.unit.code}` : ""}`
    : `Pembayaran${data.unit ? ` Unit ${data.unit.code}` : ""} - ${data.project.name}`;

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
        <Text style={sharedStyles.title}>KWITANSI PEMBAYARAN</Text>

        {/* Receipt Box */}
        <View style={receiptStyles.receiptBox}>
          {/* Receipt Number & Date */}
          <View style={sharedStyles.row}>
            <Text style={sharedStyles.label}>No. Kwitansi</Text>
            <Text style={sharedStyles.value}>: {data.paymentNumber}</Text>
          </View>
          <View style={sharedStyles.row}>
            <Text style={sharedStyles.label}>Tanggal</Text>
            <Text style={sharedStyles.value}>: {formatDate(data.paymentDate)}</Text>
          </View>

          <View style={sharedStyles.separator} />

          {/* Received From */}
          <View style={sharedStyles.row}>
            <Text style={sharedStyles.label}>Diterima dari</Text>
            <Text style={sharedStyles.value}>: {data.customer.name}</Text>
          </View>
          <View style={sharedStyles.row}>
            <Text style={sharedStyles.label}>Alamat</Text>
            <Text style={sharedStyles.value}>: {data.customer.address || "-"}</Text>
          </View>

          {/* Amount */}
          <View style={receiptStyles.amountBox}>
            <Text style={receiptStyles.amountLabel}>Jumlah Pembayaran</Text>
            <Text style={receiptStyles.amountValue}>{formatCurrency(data.amount)}</Text>
          </View>

          {/* For */}
          <View style={sharedStyles.row}>
            <Text style={sharedStyles.label}>Untuk Pembayaran</Text>
            <Text style={sharedStyles.value}>: {description}</Text>
          </View>
          {data.invoice && (
            <View style={sharedStyles.row}>
              <Text style={sharedStyles.label}>No. Invoice</Text>
              <Text style={sharedStyles.value}>: {data.invoice.invoiceNumber}</Text>
            </View>
          )}
          <View style={sharedStyles.row}>
            <Text style={sharedStyles.label}>Metode Pembayaran</Text>
            <Text style={sharedStyles.value}>: {getPaymentMethodLabel(data.paymentMethod)}</Text>
          </View>
          <View style={sharedStyles.row}>
            <Text style={sharedStyles.label}>Proyek</Text>
            <Text style={sharedStyles.value}>: {data.project.name}</Text>
          </View>
        </View>

        {/* Signatures */}
        <View style={sharedStyles.signatureContainer}>
          <View style={sharedStyles.signatureBox}>
            <Text style={sharedStyles.signatureLabel}>Penyetor</Text>
            <View style={sharedStyles.signatureLine} />
            <Text style={sharedStyles.signatureName}>{data.customer.name}</Text>
          </View>
          <View style={sharedStyles.signatureBox}>
            <Text style={sharedStyles.signatureLabel}>Diterima oleh</Text>
            <View style={sharedStyles.signatureLine} />
            <Text style={sharedStyles.signatureName}>
              {data.verifiedBy ? data.verifiedBy.name : "________________"}
            </Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={sharedStyles.footer}>
          {COMPANY_INFO.name} — {COMPANY_INFO.address} — {COMPANY_INFO.phone}
        </Text>
      </Page>
    </Document>
  );
}
