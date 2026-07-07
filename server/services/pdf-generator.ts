/**
 * PDF Generator Service
 *
 * Centralized service for generating PDF documents.
 * Uses @react-pdf/renderer for server-side PDF generation.
 *
 * Usage:
 *   import { generatePdfUrl } from "@/server/services/pdf-generator";
 *   const url = generatePdfUrl("booking", bookingId);
 *   // url => "/api/pdf/booking/{id}"
 */

export type PdfDocumentType = "booking" | "invoice" | "payment" | "bast";

/**
 * Generate the URL for downloading/viewing a PDF document.
 * This is used in the frontend to link to the PDF API route.
 */
export function generatePdfUrl(type: PdfDocumentType, id: string): string {
  return `/api/pdf/${type}/${id}`;
}

/**
 * Get human-readable document title for a given type.
 */
export function getPdfDocumentTitle(type: PdfDocumentType): string {
  const titles: Record<PdfDocumentType, string> = {
    booking: "Surat Booking",
    invoice: "Invoice",
    payment: "Kwitansi Pembayaran",
    bast: "Berita Acara Serah Terima (BAST)",
  };
  return titles[type];
}

/**
 * All available PDF document types with their labels.
 */
export const PDF_DOCUMENT_TYPES: { value: PdfDocumentType; label: string }[] = [
  { value: "booking", label: "Surat Booking" },
  { value: "invoice", label: "Invoice" },
  { value: "payment", label: "Kwitansi Pembayaran" },
  { value: "bast", label: "Berita Acara Serah Terima (BAST)" },
];
