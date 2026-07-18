"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  approveBastKonsumen,
  requestHandoverRevision,
  replaceBastCustomerDocument,
  uploadCustomerDocument,
  verifyCustomerDocument,
} from "@/server/actions/marketing";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileCheck2,
  FileUp,
  Loader2,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";

type BastDocument = {
  id: string;
  status: "uploaded" | "verified" | "rejected";
  notes: string | null;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
};

type Props = {
  bookingId: string;
  customerId: string;
  document: BastDocument | null;
  canUpload: boolean;
  canVerify: boolean;
  canCompleteHandover: boolean;
  canRequestRevision: boolean;
  handoverComplete: boolean;
};

const statusView = {
  uploaded: {
    label: "Menunggu Verifikasi",
    detail: "BAST sudah diunggah dan menunggu pemeriksaan Admin.",
    icon: Clock3,
    className: "border-amber-200 bg-amber-50 text-amber-800",
  },
  verified: {
    label: "Terverifikasi",
    detail: "BAST sudah diverifikasi dan siap diproses ke serah terima final.",
    icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  rejected: {
    label: "Perlu Diperbaiki",
    detail: "BAST ditolak. Unggah BAST pengganti untuk diproses dan diverifikasi ulang.",
    icon: XCircle,
    className: "border-rose-200 bg-rose-50 text-rose-800",
  },
} as const;

export default function BastConsumerCard({
  bookingId,
  customerId,
  document,
  canUpload,
  canVerify,
  canCompleteHandover,
  canRequestRevision,
  handoverComplete,
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSignedDocumentConfirmed, setIsSignedDocumentConfirmed] = useState(false);
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const [revisionReason, setRevisionReason] = useState("");

  const fileNameLooksLikeBast = selectedFile ? /bast/i.test(selectedFile.name) : true;

  const uploadBast = async () => {
    if (!selectedFile) {
      setError("Pilih berkas BAST yang telah ditandatangani terlebih dahulu.");
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("Ukuran berkas BAST maksimal 10 MB.");
      return;
    }
    if (!isSignedDocumentConfirmed) {
      setError("Konfirmasikan bahwa file yang dipilih adalah BAST yang telah ditandatangani kedua pihak.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const response = await fetch("/api/upload-attachment", { method: "POST", body: formData });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "Berkas BAST gagal diunggah.");
      }
      const file = await response.json();
      const documentData = {
        fileName: selectedFile.name,
        fileUrl: file.url,
        mimeType: selectedFile.type || "application/pdf",
        fileSize: selectedFile.size,
      };
      if (document?.status === "rejected") {
        await replaceBastCustomerDocument(bookingId, document.id, documentData);
      } else {
        await uploadCustomerDocument({
          customerId,
          bookingId,
          documentType: "bast",
          ...documentData,
        });
      }
      setSelectedFile(null);
      setIsSignedDocumentConfirmed(false);
      if (inputRef.current) inputRef.current.value = "";
      setMessage(document?.status === "rejected"
        ? "BAST pengganti berhasil diunggah dan menunggu verifikasi ulang."
        : "BAST Konsumen berhasil diunggah dan menunggu verifikasi.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "BAST Konsumen gagal diunggah.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyBast = async () => {
    if (!document || !window.confirm("Verifikasi BAST Konsumen ini?")) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await verifyCustomerDocument(document.id, "verified");
      setMessage("BAST Konsumen telah diverifikasi.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "BAST Konsumen gagal diverifikasi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const completeHandover = async () => {
    if (!window.confirm("Selesaikan serah terima unit kepada konsumen? Tindakan ini mengunci status unit.")) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await approveBastKonsumen(bookingId);
      setMessage("Serah terima unit berhasil diselesaikan.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Serah terima unit gagal diselesaikan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitRevision = async () => {
    if (revisionReason.trim().length < 10) {
      setError("Alasan revisi serah terima minimal 10 karakter.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await requestHandoverRevision(bookingId, revisionReason);
      setRevisionDialogOpen(false);
      setRevisionReason("");
      setMessage("Serah terima dibuka kembali. Unggah BAST yang benar untuk diproses ulang.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revisi serah terima gagal diproses.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentStatus = document ? statusView[document.status] : null;
  const StatusIcon = currentStatus?.icon;

  return (
    <section className="rounded-2xl border border-violet-200 bg-violet-50/50 p-5 shadow-sage">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-violet-100 text-violet-700">
          <FileCheck2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-violet-950">BAST Developer ke Konsumen</p>
          <p className="mt-0.5 text-xs leading-relaxed text-violet-800">
            Unggah BAST yang telah ditandatangani Developer dan Konsumen sebagai bukti serah terima unit.
          </p>
        </div>
      </div>

      {handoverComplete ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Serah terima unit telah selesai.
          </div>
          {document && (
            <a href={document.fileUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold underline underline-offset-2">
              <ExternalLink className="h-3.5 w-3.5" />
              Lihat BAST: {document.fileName}
            </a>
          )}
        </div>
      ) : document && currentStatus && StatusIcon ? (
        <div className={`mt-4 rounded-xl border p-3 ${currentStatus.className}`}>
          <div className="flex items-start gap-2">
            <StatusIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{currentStatus.label}</p>
              <p className="mt-0.5 text-xs">{currentStatus.detail}</p>
              {document.notes && <p className="mt-2 text-xs italic">Catatan: {document.notes}</p>}
            </div>
          </div>
          <a
            href={document.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold underline underline-offset-2"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Lihat {document.fileName}
          </a>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-violet-300 bg-card/70 p-3 text-xs font-semibold text-violet-800">
          BAST Konsumen belum diunggah.
        </div>
      )}

      {error && <p className="mt-3 text-xs font-semibold text-rose-700">{error}</p>}
      {message && <p className="mt-3 text-xs font-semibold text-emerald-700">{message}</p>}

      {(!document || document.status === "rejected") && canUpload && !handoverComplete && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/*"
            onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
            className="block min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2 text-xs file:mr-3 file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-xs file:font-bold file:text-primary"
          />
          <Button type="button" onClick={uploadBast} disabled={isSubmitting || !selectedFile || !isSignedDocumentConfirmed} className="bg-primary text-white hover:bg-primary/90">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            {document?.status === "rejected" ? "Unggah BAST Pengganti" : "Unggah BAST"}
          </Button>
          </div>
          {selectedFile && !fileNameLooksLikeBast && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              Nama file tidak memuat kata “BAST”. Pastikan ini benar-benar dokumen Berita Acara Serah Terima.
            </p>
          )}
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-violet-200 bg-card/70 p-3 text-xs text-violet-900">
            <input
              type="checkbox"
              checked={isSignedDocumentConfirmed}
              onChange={(event) => setIsSignedDocumentConfirmed(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span>Saya memastikan file ini adalah BAST Developer → Konsumen yang telah ditandatangani kedua pihak.</span>
          </label>
        </div>
      )}

      {document && !handoverComplete && (
        <div className="mt-4 flex flex-wrap gap-2">
          {canVerify && document.status === "uploaded" && (
            <Button type="button" onClick={verifyBast} disabled={isSubmitting} className="bg-primary text-white hover:bg-primary/90">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Verifikasi BAST
            </Button>
          )}
          {canCompleteHandover && document.status === "verified" && (
            <Button type="button" onClick={completeHandover} disabled={isSubmitting} className="bg-emerald-700 text-white hover:bg-emerald-800">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Selesaikan Serah Terima
            </Button>
          )}
        </div>
      )}
      {handoverComplete && canRequestRevision && (
        <div className="mt-4">
          <Button type="button" variant="outline" onClick={() => setRevisionDialogOpen(true)} className="border-amber-300 text-amber-800 hover:bg-amber-50">
            <RotateCcw className="h-4 w-4" />
            Revisi Serah Terima
          </Button>
        </div>
      )}

      <Dialog open={revisionDialogOpen} onOpenChange={setRevisionDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Revisi Serah Terima</DialogTitle>
            <DialogDescription>
              Serah terima akan dibuka kembali ke tahap Menunggu Serah Terima. BAST saat ini ditandai perlu diperbaiki dan riwayat audit tetap tersimpan.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={revisionReason}
            onChange={(event) => setRevisionReason(event.target.value)}
            placeholder="Tuliskan alasan revisi, misalnya: file yang terunggah bukan BAST yang telah ditandatangani."
            maxLength={500}
            rows={4}
          />
          <p className="text-right text-xs text-muted-foreground">{revisionReason.length}/500 karakter</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRevisionDialogOpen(false)} disabled={isSubmitting}>Batal</Button>
            <Button type="button" onClick={submitRevision} disabled={isSubmitting || revisionReason.trim().length < 10} className="bg-amber-700 text-white hover:bg-amber-800">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Buka Kembali Serah Terima
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
