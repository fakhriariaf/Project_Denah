import React from "react";
import { Document, Page, View, Text } from "@react-pdf/renderer";
import {
  sharedStyles,
  COMPANY_INFO,
  formatCurrency,
  formatDate,
  formatPaymentScheme,
} from "./shared-styles";

export interface BookingLetterData {
  bookingNumber: string;
  bookingDate: Date | string;
  bookingFee: number;
  dpAmount: number;
  paymentScheme: string;
  termin: number | null;
  customer: {
    name: string;
    phone: string;
    address: string | null;
    nik: string | null;
  };
  unit: {
    code: string;
    cluster: string | null;
    typeName: string | null;
    landArea: number;
    buildingArea: number;
    price: number;
  };
  project: {
    name: string;
    location: string | null;
  };
  marketing: {
    name: string;
  };
}

export function BookingLetterTemplate({ data }: { data: BookingLetterData }) {
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
        <Text style={sharedStyles.title}>SURAT BOOKING</Text>

        {/* Document Info */}
        <View style={sharedStyles.row}>
          <Text style={sharedStyles.label}>Nomor Booking</Text>
          <Text style={sharedStyles.value}>: {data.bookingNumber}</Text>
        </View>
        <View style={sharedStyles.row}>
          <Text style={sharedStyles.label}>Tanggal</Text>
          <Text style={sharedStyles.value}>: {formatDate(data.bookingDate)}</Text>
        </View>

        <View style={sharedStyles.separator} />

        {/* Customer Info */}
        <Text style={sharedStyles.sectionTitle}>Data Customer</Text>
        <View style={sharedStyles.row}>
          <Text style={sharedStyles.label}>Nama</Text>
          <Text style={sharedStyles.value}>: {data.customer.name}</Text>
        </View>
        {data.customer.nik && (
          <View style={sharedStyles.row}>
            <Text style={sharedStyles.label}>NIK</Text>
            <Text style={sharedStyles.value}>: {data.customer.nik}</Text>
          </View>
        )}
        <View style={sharedStyles.row}>
          <Text style={sharedStyles.label}>No. Telepon</Text>
          <Text style={sharedStyles.value}>: {data.customer.phone}</Text>
        </View>
        <View style={sharedStyles.row}>
          <Text style={sharedStyles.label}>Alamat</Text>
          <Text style={sharedStyles.value}>: {data.customer.address || "-"}</Text>
        </View>

        <View style={sharedStyles.separator} />

        {/* Unit Info */}
        <Text style={sharedStyles.sectionTitle}>Data Unit</Text>
        <View style={sharedStyles.row}>
          <Text style={sharedStyles.label}>Proyek</Text>
          <Text style={sharedStyles.value}>: {data.project.name}</Text>
        </View>
        <View style={sharedStyles.row}>
          <Text style={sharedStyles.label}>Lokasi</Text>
          <Text style={sharedStyles.value}>: {data.project.location || "-"}</Text>
        </View>
        <View style={sharedStyles.row}>
          <Text style={sharedStyles.label}>Kode Unit</Text>
          <Text style={sharedStyles.value}>: {data.unit.code}</Text>
        </View>
        {data.unit.cluster && (
          <View style={sharedStyles.row}>
            <Text style={sharedStyles.label}>Cluster</Text>
            <Text style={sharedStyles.value}>: {data.unit.cluster}</Text>
          </View>
        )}
        {data.unit.typeName && (
          <View style={sharedStyles.row}>
            <Text style={sharedStyles.label}>Tipe</Text>
            <Text style={sharedStyles.value}>: {data.unit.typeName}</Text>
          </View>
        )}
        <View style={sharedStyles.row}>
          <Text style={sharedStyles.label}>Luas Tanah</Text>
          <Text style={sharedStyles.value}>: {data.unit.landArea} m²</Text>
        </View>
        <View style={sharedStyles.row}>
          <Text style={sharedStyles.label}>Luas Bangunan</Text>
          <Text style={sharedStyles.value}>: {data.unit.buildingArea} m²</Text>
        </View>
        <View style={sharedStyles.row}>
          <Text style={sharedStyles.label}>Harga Unit</Text>
          <Text style={sharedStyles.value}>: {formatCurrency(data.unit.price)}</Text>
        </View>

        <View style={sharedStyles.separator} />

        {/* Payment Info */}
        <Text style={sharedStyles.sectionTitle}>Informasi Pembayaran</Text>
        <View style={sharedStyles.row}>
          <Text style={sharedStyles.label}>Skema Pembayaran</Text>
          <Text style={sharedStyles.value}>: {formatPaymentScheme(data.paymentScheme)}</Text>
        </View>
        <View style={sharedStyles.row}>
          <Text style={sharedStyles.label}>Booking Fee</Text>
          <Text style={sharedStyles.value}>: {formatCurrency(data.bookingFee)}</Text>
        </View>
        <View style={sharedStyles.row}>
          <Text style={sharedStyles.label}>Uang Muka (DP)</Text>
          <Text style={sharedStyles.value}>: {formatCurrency(data.dpAmount)}</Text>
        </View>
        {data.termin && (
          <View style={sharedStyles.row}>
            <Text style={sharedStyles.label}>Termin</Text>
            <Text style={sharedStyles.value}>: {data.termin}x</Text>
          </View>
        )}

        <View style={sharedStyles.separator} />

        {/* Terms */}
        <Text style={sharedStyles.sectionTitle}>Syarat & Ketentuan</Text>
        <Text style={{ fontSize: 9, marginBottom: 3 }}>
          1. Booking fee bersifat non-refundable kecuali pembatalan dari pihak developer.
        </Text>
        <Text style={{ fontSize: 9, marginBottom: 3 }}>
          2. Pembayaran DP harus dilunasi sesuai jadwal yang telah disepakati.
        </Text>
        <Text style={{ fontSize: 9, marginBottom: 3 }}>
          3. Unit yang telah dibooking akan dihold selama 7 hari kerja.
        </Text>
        <Text style={{ fontSize: 9, marginBottom: 3 }}>
          4. Surat booking ini bukan merupakan bukti kepemilikan unit.
        </Text>

        {/* Signatures */}
        <View style={sharedStyles.signatureContainer}>
          <View style={sharedStyles.signatureBox}>
            <Text style={sharedStyles.signatureLabel}>Customer</Text>
            <View style={sharedStyles.signatureLine} />
            <Text style={sharedStyles.signatureName}>{data.customer.name}</Text>
          </View>
          <View style={sharedStyles.signatureBox}>
            <Text style={sharedStyles.signatureLabel}>Marketing</Text>
            <View style={sharedStyles.signatureLine} />
            <Text style={sharedStyles.signatureName}>{data.marketing.name}</Text>
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
