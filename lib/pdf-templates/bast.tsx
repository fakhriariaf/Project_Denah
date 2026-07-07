import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import {
  sharedStyles,
  COMPANY_INFO,
  COLORS,
  formatDate,
} from "./shared-styles";

const bastStyles = StyleSheet.create({
  paragraph: {
    fontSize: 10,
    lineHeight: 1.6,
    marginBottom: 8,
    textAlign: "justify",
  },
  partyTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  partyContent: {
    marginLeft: 16,
    marginBottom: 8,
  },
  checklistBox: {
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
    marginTop: 8,
  },
  checklistItem: {
    flexDirection: "row",
    marginBottom: 4,
    alignItems: "center",
  },
  checkbox: {
    width: 12,
    height: 12,
    borderWidth: 1,
    borderColor: COLORS.text,
    marginRight: 8,
  },
  checklistText: {
    fontSize: 9,
    flex: 1,
  },
});

export interface BastData {
  bookingNumber: string;
  bookingDate: Date | string;
  handoverDate: Date | string | null;
  customer: {
    name: string;
    nik: string | null;
    phone: string;
    address: string | null;
  };
  unit: {
    code: string;
    cluster: string | null;
    typeName: string | null;
    landArea: number;
    buildingArea: number;
  };
  project: {
    name: string;
    location: string | null;
  };
}

export function BastTemplate({ data }: { data: BastData }) {
  const today = data.handoverDate ? formatDate(data.handoverDate) : formatDate(new Date());

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
        <Text style={sharedStyles.title}>BERITA ACARA SERAH TERIMA (BAST)</Text>

        {/* Document Info */}
        <View style={sharedStyles.row}>
          <Text style={sharedStyles.label}>Nomor</Text>
          <Text style={sharedStyles.value}>: BAST/{data.bookingNumber}</Text>
        </View>
        <View style={sharedStyles.row}>
          <Text style={sharedStyles.label}>Tanggal</Text>
          <Text style={sharedStyles.value}>: {today}</Text>
        </View>

        <View style={sharedStyles.separator} />

        {/* Opening */}
        <Text style={bastStyles.paragraph}>
          Pada hari ini, {today}, telah dilakukan serah terima unit rumah antara:
        </Text>

        {/* Party 1 - Developer */}
        <Text style={bastStyles.partyTitle}>PIHAK PERTAMA (Developer):</Text>
        <View style={bastStyles.partyContent}>
          <View style={sharedStyles.row}>
            <Text style={sharedStyles.label}>Nama Perusahaan</Text>
            <Text style={sharedStyles.value}>: {COMPANY_INFO.name}</Text>
          </View>
          <View style={sharedStyles.row}>
            <Text style={sharedStyles.label}>Alamat</Text>
            <Text style={sharedStyles.value}>: {COMPANY_INFO.address}</Text>
          </View>
          <View style={sharedStyles.row}>
            <Text style={sharedStyles.label}>Telepon</Text>
            <Text style={sharedStyles.value}>: {COMPANY_INFO.phone}</Text>
          </View>
        </View>

        {/* Party 2 - Customer */}
        <Text style={bastStyles.partyTitle}>PIHAK KEDUA (Pembeli):</Text>
        <View style={bastStyles.partyContent}>
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
        </View>

        <View style={sharedStyles.separator} />

        {/* Unit Details */}
        <Text style={sharedStyles.sectionTitle}>Detail Unit yang Diserahterimakan</Text>
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
          <Text style={sharedStyles.label}>No. Booking</Text>
          <Text style={sharedStyles.value}>: {data.bookingNumber}</Text>
        </View>

        <View style={sharedStyles.separator} />

        {/* Checklist */}
        <Text style={sharedStyles.sectionTitle}>Checklist Kondisi Unit</Text>
        <View style={bastStyles.checklistBox}>
          {[
            "Struktur bangunan sesuai spesifikasi",
            "Instalasi listrik berfungsi normal",
            "Instalasi air berfungsi normal",
            "Pintu dan jendela terpasang dengan baik",
            "Cat dinding dan plafon sesuai standar",
            "Lantai terpasang rapi tanpa cacat",
            "Atap tidak bocor",
            "Saluran pembuangan berfungsi normal",
            "Kunci dan akses diserahkan",
          ].map((item, idx) => (
            <View key={idx} style={bastStyles.checklistItem}>
              <View style={bastStyles.checkbox} />
              <Text style={bastStyles.checklistText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Closing */}
        <Text style={[bastStyles.paragraph, { marginTop: 12 }]}>
          Demikian berita acara serah terima ini dibuat dengan sebenarnya oleh kedua belah pihak dalam
          keadaan sadar dan tanpa paksaan dari pihak manapun.
        </Text>

        {/* Signatures */}
        <View style={sharedStyles.signatureContainer}>
          <View style={sharedStyles.signatureBox}>
            <Text style={sharedStyles.signatureLabel}>PIHAK PERTAMA</Text>
            <View style={sharedStyles.signatureLine} />
            <Text style={sharedStyles.signatureName}>{COMPANY_INFO.name}</Text>
          </View>
          <View style={sharedStyles.signatureBox}>
            <Text style={sharedStyles.signatureLabel}>PIHAK KEDUA</Text>
            <View style={sharedStyles.signatureLine} />
            <Text style={sharedStyles.signatureName}>{data.customer.name}</Text>
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
