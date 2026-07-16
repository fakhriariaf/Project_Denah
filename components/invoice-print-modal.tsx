"use client";

import React from "react";
import {
  getInvoiceTypeLabel,
  getPaymentMethodLabel,
  getInvoiceStatusLabel,
} from "@/lib/label-helpers";

interface InvoiceData {
  id: string;
  invoiceNumber: string;
  type: "booking_fee" | "dp" | "installment" | "other";
  amount: number;
  dueDate: Date | null;
  status: "unpaid" | "partial" | "paid" | "cancelled";
  notes: string | null;
  createdAt: Date;
  projectName: string;
  unitCode: string | null;
  customerName: string | null;
  bookingId: string | null;
}

interface PaymentRow {
  id: string;
  invoiceId: string | null;
  paymentNumber: string;
  amount: number;
  paymentDate: Date;
  paymentMethod: "cash" | "transfer" | "giro" | "other";
  proofFileUrl?: string | null;
  status: "pending" | "verified" | "rejected" | "voided";
  verifiedAt: Date | null;
}

interface Props {
  invoice: InvoiceData;
  payments: PaymentRow[];
  companyName?: string;
  onClose: () => void;
}

// User-facing labels come from the centralized helpers in lib/label-helpers.ts
// (getInvoiceTypeLabel / getPaymentMethodLabel / getInvoiceStatusLabel) so no
// raw enum value can leak. STATUS_COLORS carries ONLY the visual status colors
// for the printed badge; the label text is derived from getInvoiceStatusLabel.
const STATUS_COLORS = {
  paid:      { bg: "#C8EFE0", color: "#1A5240", border: "#2E7A5E" },
  partial:   { bg: "#FBE4C9", color: "#7A3D0E", border: "#D47A2E" },
  unpaid:    { bg: "#FFD6D6", color: "#8B1A1A", border: "#C0392B" },
  cancelled: { bg: "#E7E9E7", color: "#3D4840", border: "#7A8880" },
};

function formatRupiah(val: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val);
}

function formatDate(d: Date | null | string | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function InvoicePrintModal({ invoice, payments, companyName = "PT Denah Property Indonesia", onClose }: Props) {
  const statusConf = STATUS_COLORS[invoice.status] ?? STATUS_COLORS.unpaid;
  // Label via centralized helper (uppercased for the printed badge style).
  const statusLabel = getInvoiceStatusLabel(invoice.status).toUpperCase();

  const verifiedPayments = payments.filter(
    (p) => p.invoiceId === invoice.id && p.status === "verified"
  );
  const paidAmount = verifiedPayments.reduce((s, p) => s + p.amount, 0);
  const outstanding = Math.max(0, invoice.amount - paidAmount);

  const handlePrint = () => window.print();

  return (
    <>
      {/* Print-only CSS injected into head via style tag */}
      <style>{`
        @media print {
          body > *:not(#invoice-print-root) { display: none !important; }
          #invoice-print-root { display: block !important; position: fixed !important; inset: 0 !important; z-index: 99999 !important; background: white !important; overflow: visible !important; }
          .invoice-modal-overlay { background: white !important; position: static !important; }
          .invoice-no-print { display: none !important; }
          .invoice-card { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; border: none !important; max-width: 100% !important; }
          @page { margin: 10mm; size: A4 portrait; }
        }
      `}</style>

      {/* BACKDROP */}
      <div
        id="invoice-print-root"
        className="invoice-modal-overlay"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "rgba(36,48,40,0.7)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          overflowY: "auto",
          padding: "24px 16px 48px",
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div style={{ width: "100%", maxWidth: 760, position: "relative" }}>

          {/* ACTION BAR */}
          <div
            className="invoice-no-print"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
              gap: 8,
            }}
          >
            <div style={{ color: "white", fontWeight: 700, fontSize: 14 }}>
              🧾 {invoice.invoiceNumber} — {invoice.customerName}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={onClose}
                style={{
                  padding: "8px 16px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.3)",
                  background: "rgba(255,255,255,0.1)",
                  color: "white",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                ✕ Tutup
              </button>
              <button
                onClick={handlePrint}
                style={{
                  padding: "8px 20px",
                  borderRadius: 10,
                  border: "none",
                  background: "#4F6F52",
                  color: "white",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: "0 4px 12px rgba(79,111,82,0.4)",
                }}
              >
                🖨️ Cetak / Simpan PDF
              </button>
            </div>
          </div>

          {/* INVOICE CARD */}
          <div
            className="invoice-card"
            style={{
              background: "white",
              borderRadius: 16,
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              border: "1px solid #D6DED2",
              overflow: "hidden",
              position: "relative",
            }}
          >
            {/* HEADER */}
            <div
              style={{
                background: "linear-gradient(135deg, #243028 0%, #4F6F52 60%, #8FAF9A 100%)",
                padding: "28px 36px 24px",
                color: "white",
                position: "relative",
              }}
            >
              <div style={{ position: "absolute", top: 0, right: 0, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.05)", transform: "translate(40%, -40%)", pointerEvents: "none" }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" }}>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{companyName}</div>
                  <div style={{ fontSize: 11, opacity: 0.75, lineHeight: 1.7 }}>
                    Sistem ERP Properti Perumahan
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: -1, opacity: 0.9 }}>INVOICE</div>
                  <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, background: "rgba(255,255,255,0.15)", padding: "3px 10px", borderRadius: 6, marginTop: 4 }}>
                    {invoice.invoiceNumber}
                  </div>
                  <div style={{
                    marginTop: 8,
                    display: "inline-block",
                    padding: "4px 14px",
                    borderRadius: 20,
                    background: statusConf.bg,
                    color: statusConf.color,
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: 1,
                    border: `2px solid ${statusConf.border}`,
                  }}>
                    {statusLabel}
                  </div>
                </div>
              </div>
            </div>

            {/* META GRID */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #D6DED2" }}>
              <div style={{ padding: "20px 36px", borderRight: "1px solid #D6DED2" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#8FAF9A", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Ditagihkan Kepada</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#243028", marginBottom: 3 }}>{invoice.customerName || "—"}</div>
                <div style={{ fontSize: 11, color: "#66736A", lineHeight: 1.7 }}>
                  {invoice.projectName}<br />
                  {invoice.unitCode && <>Kavling: <strong>{invoice.unitCode}</strong></>}
                </div>
              </div>
              <div style={{ padding: "20px 36px" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#8FAF9A", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Detail Invoice</div>
                <table style={{ fontSize: 11, borderCollapse: "collapse", width: "100%" }}>
                  <tbody>
                    {[
                      ["Nomor Invoice", invoice.invoiceNumber],
                      ["Tanggal Terbit", formatDate(invoice.createdAt)],
                      ["Jatuh Tempo", formatDate(invoice.dueDate)],
                      ["Jenis Tagihan", getInvoiceTypeLabel(invoice.type)],
                    ].map(([label, val]) => (
                      <tr key={label}>
                        <td style={{ color: "#66736A", padding: "2px 0", width: 100 }}>{label}</td>
                        <td style={{ color: "#243028", fontWeight: 600, padding: "2px 0" }}>: {val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* AMOUNT TABLE */}
            <div style={{ padding: "24px 36px 20px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#F7F8F3" }}>
                    {[["Keterangan", "left"], ["Proyek / Kavling", "left"], ["Jumlah", "right"]].map(([h, a]) => (
                      <th key={h} style={{ padding: "9px 12px", fontSize: 10, fontWeight: 700, color: "#66736A", textTransform: "uppercase", letterSpacing: 0.5, border: "1px solid #D6DED2", textAlign: a as "left" | "right" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: "12px", border: "1px solid #D6DED2", fontWeight: 600, color: "#243028" }}>
                      {getInvoiceTypeLabel(invoice.type)}
                      {invoice.notes && <div style={{ fontSize: 10, color: "#66736A", fontWeight: 400, marginTop: 2 }}>{invoice.notes}</div>}
                    </td>
                    <td style={{ padding: "12px", border: "1px solid #D6DED2", color: "#66736A" }}>
                      {invoice.projectName}<br />
                      <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#243028" }}>{invoice.unitCode || "—"}</span>
                    </td>
                    <td style={{ padding: "12px", border: "1px solid #D6DED2", textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: 14, color: "#243028" }}>
                      {formatRupiah(invoice.amount)}
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr style={{ background: "#F7F8F3" }}>
                    <td colSpan={2} style={{ padding: "9px 12px", border: "1px solid #D6DED2", textAlign: "right", fontWeight: 600, color: "#66736A", fontSize: 12 }}>Total Tagihan</td>
                    <td style={{ padding: "9px 12px", border: "1px solid #D6DED2", textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: 14, color: "#243028" }}>{formatRupiah(invoice.amount)}</td>
                  </tr>
                  <tr>
                    <td colSpan={2} style={{ padding: "9px 12px", border: "1px solid #D6DED2", textAlign: "right", fontWeight: 600, color: "#2E7A5E", fontSize: 12 }}>Sudah Dibayar</td>
                    <td style={{ padding: "9px 12px", border: "1px solid #D6DED2", textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: 14, color: "#2E7A5E" }}>({formatRupiah(paidAmount)})</td>
                  </tr>
                  <tr style={{ background: outstanding > 0 ? "#FFD6D6" : "#C8EFE0" }}>
                    <td colSpan={2} style={{ padding: "10px 12px", border: "1px solid #D6DED2", textAlign: "right", fontWeight: 800, fontSize: 13, color: outstanding > 0 ? "#8B1A1A" : "#1A5240" }}>
                      {outstanding > 0 ? "Sisa Tagihan" : "✓ Lunas Penuh"}
                    </td>
                    <td style={{ padding: "10px 12px", border: "1px solid #D6DED2", textAlign: "right", fontFamily: "monospace", fontWeight: 900, fontSize: 16, color: outstanding > 0 ? "#8B1A1A" : "#1A5240" }}>
                      {formatRupiah(outstanding)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* PAYMENT HISTORY */}
            {verifiedPayments.length > 0 && (
              <div style={{ padding: "0 36px 24px" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#8FAF9A", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Riwayat Pembayaran Terverifikasi</div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: "#F7F8F3" }}>
                      {[["No. Setoran", "left"], ["Tanggal Bayar", "left"], ["Metode", "left"], ["Jumlah", "right"]].map(([h, a]) => (
                        <th key={h} style={{ padding: "7px 10px", fontSize: 9, fontWeight: 700, color: "#66736A", textTransform: "uppercase", letterSpacing: 0.5, border: "1px solid #D6DED2", textAlign: a as "left" | "right" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {verifiedPayments.map((p) => (
                      <tr key={p.id}>
                        <td style={{ padding: "7px 10px", border: "1px solid #D6DED2", fontFamily: "monospace", fontWeight: 600, color: "#243028" }}>{p.paymentNumber}</td>
                        <td style={{ padding: "7px 10px", border: "1px solid #D6DED2", color: "#66736A" }}>{formatDate(p.paymentDate)}</td>
                        <td style={{ padding: "7px 10px", border: "1px solid #D6DED2", color: "#66736A" }}>{getPaymentMethodLabel(p.paymentMethod)}</td>
                        <td style={{ padding: "7px 10px", border: "1px solid #D6DED2", textAlign: "right", fontFamily: "monospace", fontWeight: 600, color: "#2E7A5E" }}>{formatRupiah(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* DIVIDER */}
            <div style={{ height: 1, background: "#D6DED2", margin: "0 36px" }} />

            {/* FOOTER */}
            <div style={{ padding: "20px 36px 28px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div style={{ maxWidth: 340 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#8FAF9A", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Catatan</div>
                <div style={{ fontSize: 10, color: "#66736A", lineHeight: 1.7 }}>
                  Dokumen ini diterbitkan resmi oleh sistem ERP {companyName}.<br />
                  Harap simpan dokumen ini sebagai bukti pembayaran yang sah.
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#8FAF9A", textTransform: "uppercase", letterSpacing: 1, marginBottom: 44 }}>Disetujui Oleh</div>
                <div style={{ borderTop: "1.5px solid #243028", paddingTop: 5, width: 140 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#243028" }}>Admin Keuangan</div>
                  <div style={{ fontSize: 10, color: "#66736A" }}>{companyName}</div>
                </div>
              </div>
            </div>

            {/* LUNAS WATERMARK */}
            {invoice.status === "paid" && (
              <div style={{
                position: "absolute", top: "50%", left: "50%",
                transform: "translate(-50%, -50%) rotate(-30deg)",
                fontSize: 72, fontWeight: 900,
                color: "rgba(79,111,82,0.06)",
                userSelect: "none", pointerEvents: "none",
                whiteSpace: "nowrap", letterSpacing: -2,
              }}>
                LUNAS
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
