"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  uploadCustomerDocument,
  verifyCustomerDocument,
  deleteCustomerDocument,
} from "@/server/actions/marketing";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Upload, FileCheck, AlertCircle, X, FilePlus, FileText, Trash2,
  CheckCircle2, XCircle, Clock, Eye, ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export type CustomerDoc = {
  customer_documents: {
    id: string;
    customerId: string;
    bookingId: string | null;
    documentType: string;
    status: string;
    notes: string | null;
    uploadedAt: Date;
  };
  attachments: {
    id: string;
    fileName: string;
    fileUrl: string;
    mimeType: string;
    fileSize: number;
  };
};

const DOC_TYPE_LABELS: Record<string, string> = {
  ktp: "KTP",
  npwp: "NPWP",
  slip_gaji: "Slip Gaji",
  kk: "Kartu Keluarga",
  spjb: "SPJB",
  kpr_doc: "Dokumen KPR",
  other: "Lainnya",
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  uploaded: { label: "Menunggu Verifikasi", icon: Clock, className: "bg-amber-50 border-amber-100 text-amber-700" },
  verified: { label: "Terverifikasi", icon: CheckCircle2, className: "bg-emerald-50 border-emerald-100 text-emerald-700" },
  rejected: { label: "Ditolak", icon: XCircle, className: "bg-rose-50 border-rose-100 text-rose-700" },
};

interface Props {
  customerId: string;
  bookingId?: string;
  initialDocs: CustomerDoc[];
  canVerify?: boolean;
  canUpload?: boolean;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CustomerDocumentsPanel({
  customerId,
  bookingId,
  initialDocs,
  canVerify = false,
  canUpload = true,
}: Props) {
  const router = useRouter();
  const [docs, setDocs] = useState<CustomerDoc[]>(initialDocs);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<string>("ktp");
  const [isDragOver, setIsDragOver] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerDoc | null>(null);
  const [rejectTarget, setRejectTarget] = useState<CustomerDoc | null>(null);
  const [rejectNotes, setRejectNotes] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRejectClick = (doc: CustomerDoc) => {
    setRejectTarget(doc);
    setRejectNotes("");
  };

  useEffect(() => {
    setDocs(initialDocs);
  }, [initialDocs]);

  useEffect(() => {
    const uploadedTypes = new Set(docs.map((d) => d.customer_documents.documentType));
    if (selectedDocType !== "other" && uploadedTypes.has(selectedDocType)) {
      const nextAvailable = Object.keys(DOC_TYPE_LABELS).find(type => type === "other" || !uploadedTypes.has(type));
      setSelectedDocType(nextAvailable || "other");
    }
  }, [docs, selectedDocType]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      setErrorMsg(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMsg("Pilih file dokumen terlebih dahulu.");
      return;
    }
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (selectedFile.size > MAX_SIZE) {
      setErrorMsg("Ukuran file maksimum 10MB.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const uploadRes = await fetch("/api/upload-attachment", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json();
        throw new Error(errData.error || "Gagal mengunggah berkas ke server.");
      }

      const fileData = await uploadRes.json();

      const res = await uploadCustomerDocument({
        customerId,
        bookingId,
        documentType: selectedDocType as any,
        fileName: selectedFile.name,
        fileUrl: fileData.url,
        mimeType: selectedFile.type,
        fileSize: selectedFile.size,
      });

      if (res && res.success) {
        const newDoc: CustomerDoc = {
          customer_documents: {
            id: res.id!,
            customerId,
            bookingId: bookingId || null,
            documentType: selectedDocType,
            status: "uploaded",
            notes: null,
            uploadedAt: new Date(),
          },
          attachments: {
            id: res.attachmentId!,
            fileName: selectedFile.name,
            fileUrl: fileData.url,
            mimeType: selectedFile.type,
            fileSize: selectedFile.size,
          }
        };

        setDocs((prev) => [...prev, newDoc]);
        setSuccessMsg(`Dokumen ${DOC_TYPE_LABELS[selectedDocType]} berhasil diupload!`);
        router.refresh();
      }
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal mengupload dokumen.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (docId: string, status: "verified" | "rejected", notes?: string) => {
    setVerifyingId(docId);
    try {
      await verifyCustomerDocument(docId, status, notes);
      setDocs((prev) =>
        prev.map((d) =>
          d.customer_documents.id === docId
            ? { ...d, customer_documents: { ...d.customer_documents, status, notes: notes || null } }
            : d
        )
      );
      router.refresh();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal mengubah status dokumen.");
    } finally {
      setVerifyingId(null);
    }
  };

  const handleDeleteClick = (doc: CustomerDoc) => {
    setDeleteTarget(doc);
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    const docId = deleteTarget.customer_documents.id;
    setDeleteTarget(null);
    try {
      await deleteCustomerDocument(docId);
      setDocs((prev) => prev.filter((d) => d.customer_documents.id !== docId));
      router.refresh();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal menghapus dokumen.");
    }
  };

  const handleReupload = async (doc: CustomerDoc) => {
    const docId = doc.customer_documents.id;
    const docType = doc.customer_documents.documentType;
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await deleteCustomerDocument(docId);
      setDocs((prev) => prev.filter((d) => d.customer_documents.id !== docId));
      setSelectedDocType(docType);
      router.refresh();
      setTimeout(() => {
        fileInputRef.current?.click();
      }, 150);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal memproses unggah ulang.");
    } finally {
      setLoading(false);
    }
  };

  // Group docs by type to show which are missing
  const uploadedTypes = new Set(docs.map((d) => d.customer_documents.documentType));
  const activeUploadedTypes = new Set(
    docs
      .filter((d) => d.customer_documents.status !== "rejected")
      .map((d) => d.customer_documents.documentType)
  );
  const requiredTypes = ["ktp", "kk", "npwp", "slip_gaji"];
  const completionPct = Math.round(
    (requiredTypes.filter((t) => activeUploadedTypes.has(t)).length / requiredTypes.length) * 100
  );

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="bg-white border border-[#D6DED2] rounded-2xl p-4 shadow-sage">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#4F6F52]" />
            <span className="text-sm font-bold text-[#243028]">Kelengkapan Dokumen KPR</span>
          </div>
          <span className="text-sm font-mono font-bold text-[#4F6F52]">{completionPct}%</span>
        </div>
        <div className="w-full h-2 bg-[#DDE8D8] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#4F6F52] rounded-full transition-all duration-500"
            style={{ width: `${completionPct}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {requiredTypes.map((t) => {
            const docObj = docs.find((d) => d.customer_documents.documentType === t);
            const status = docObj?.customer_documents.status;
            
            let pillClass = "bg-[#F7F8F3] border-[#D6DED2] text-[#A8B0AA]";
            let pillIcon = "â—‹";
            
            if (docObj) {
              if (status === "rejected") {
                pillClass = "bg-rose-50 border-rose-100 text-rose-700";
                pillIcon = "âœ—";
              } else {
                pillClass = "bg-emerald-50 border-emerald-100 text-emerald-700";
                pillIcon = "âœ“";
              }
            }
            
            return (
              <span
                key={t}
                className={`text-[10px] font-bold px-2 py-1 rounded-full border ${pillClass}`}
              >
                {pillIcon} {DOC_TYPE_LABELS[t]}
              </span>
            );
          })}
        </div>
      </div>

      {/* Upload Form */}
      {canUpload && (
        <div className="bg-white border border-[#D6DED2] rounded-2xl p-5 shadow-sage">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-xl bg-[#DDE8D8] text-[#4F6F52] flex items-center justify-center">
              <FilePlus className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-[#243028] text-sm">Upload Dokumen Konsumen</h3>
              <p className="text-[10px] text-[#66736A]">Format: JPG, PNG, PDF. Maks 10MB per file.</p>
            </div>
          </div>

          <form onSubmit={handleUpload} className="space-y-3">
            {errorMsg && (
              <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl">
                <FileCheck className="h-4 w-4 shrink-0" />
                {successMsg}
              </div>
            )}

            {/* Doc Type Selector */}
            <div>
              <label className="text-xs font-medium text-[#243028] mb-1 block">Jenis Dokumen</label>
              <Select value={selectedDocType} onValueChange={(val: string | null) => setSelectedDocType(val ?? "ktp")}>
                <SelectTrigger className="border-[#D6DED2] focus:ring-ring/50 focus:border-[#8FAF9A]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-[#D6DED2] bg-white/95 backdrop-blur-md">
                  {Object.entries(DOC_TYPE_LABELS)
                    .filter(([type]) => type === "other" || !uploadedTypes.has(type))
                    .map(([v, label]) => (
                      <SelectItem key={v} value={v}>{label}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Drag & Drop */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 ${
                isDragOver
                  ? "border-[#4F6F52] bg-[#DDE8D8]/30 scale-[1.01]"
                  : selectedFile
                    ? "border-[#8FAF9A] bg-[#DDE8D8]/20"
                    : "border-[#D6DED2] bg-[#F7F8F3]/50 hover:border-[#8FAF9A] hover:bg-[#DDE8D8]/10"
              }`}
            >
              <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleFileChange} className="hidden" />
              {selectedFile ? (
                <>
                  <FileCheck className="h-8 w-8 text-[#4F6F52]" />
                  <p className="text-sm font-bold text-[#243028] truncate max-w-[200px]">{selectedFile.name}</p>
                  <p className="text-xs text-[#8FAF9A] font-mono">{formatFileSize(selectedFile.size)}</p>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="absolute top-2 right-2 h-6 w-6 rounded-full bg-rose-100 text-rose-600 hover:bg-rose-200 flex items-center justify-center"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-[#8FAF9A]" />
                  <p className="text-sm font-semibold text-[#243028]">Klik atau seret file ke sini</p>
                  <p className="text-xs text-[#8FAF9A]">JPG, PNG, atau PDF</p>
                </>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading || !selectedFile}
              className="w-full btn-premium bg-[#4F6F52] hover:bg-[#3D563F] text-white gap-2"
            >
              {loading ? (
                <><div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Mengupload...</>
              ) : (
                <><Upload className="h-4 w-4" />Upload {DOC_TYPE_LABELS[selectedDocType]}</>
              )}
            </Button>
          </form>
        </div>
      )}

      {/* Documents List */}
      <div className="bg-white border border-[#D6DED2] rounded-2xl overflow-hidden shadow-sage">
        <div className="px-5 py-3.5 border-b border-[#D6DED2] bg-[#F7F8F3]/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#66736A] uppercase tracking-wider">Dokumen Terupload</span>
            <span className="text-xs font-mono text-[#8FAF9A] tabular-nums">{docs.length} file</span>
          </div>
        </div>

        {docs.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="h-10 w-10 text-[#8FAF9A] mx-auto mb-3 opacity-60" />
            <p className="text-sm font-semibold text-[#243028]">Belum Ada Dokumen</p>
            <p className="text-xs text-[#66736A] mt-1">Upload dokumen persyaratan KPR konsumen di atas.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#D6DED2]/60">
            {docs.map((doc) => {
              const statusCfg = STATUS_CONFIG[doc.customer_documents.status];
              const StatusIcon = statusCfg?.icon ?? Clock;
              return (
                <div key={doc.customer_documents.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#F7F8F3]/60 transition-colors">
                  <div className="h-9 w-9 rounded-xl bg-[#DDE8D8] flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-[#4F6F52]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-[#243028]">{DOC_TYPE_LABELS[doc.customer_documents.documentType]}</p>
                      <Badge className={`border text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${statusCfg?.className}`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusCfg?.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-[#66736A] truncate">{doc.attachments.fileName}</p>
                    {doc.customer_documents.notes && (
                      <p className="text-[10px] text-amber-600 mt-0.5">{doc.customer_documents.notes}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* View/Download */}
                    <a
                      href={doc.attachments.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-7 w-7 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 flex items-center justify-center transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </a>

                    {/* Re-upload button for rejected files */}
                    {doc.customer_documents.status === "rejected" && (
                      <button
                        type="button"
                        onClick={() => handleReupload(doc)}
                        disabled={loading}
                        className="h-7 px-2 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200/50 flex items-center justify-center transition-all shadow-sm font-bold text-[10px] gap-1 shrink-0"
                        title="Upload Ulang Berkas"
                      >
                        <Upload className="h-3.5 w-3.5 text-sky-600" />
                        <span>Upload Ulang</span>
                      </button>
                    )}

                    {/* Verify/Reject â€” for authorized roles */}
                    {canVerify && doc.customer_documents.status === "uploaded" && (
                      <>
                        <button
                          onClick={() => handleVerify(doc.customer_documents.id, "verified")}
                          disabled={verifyingId === doc.customer_documents.id}
                          className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center transition-colors disabled:opacity-50"
                          title="Verifikasi"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleRejectClick(doc)}
                          disabled={verifyingId === doc.customer_documents.id}
                          className="h-7 w-7 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition-colors disabled:opacity-50"
                          title="Tolak"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}

                    {/* Delete */}
                    {doc.customer_documents.status !== "verified" && (
                      <button
                        onClick={() => handleDeleteClick(doc)}
                        className="h-7 w-7 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center transition-colors"
                        title="Hapus"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialog Konfirmasi Hapus */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md bg-white p-6 rounded-3xl border border-[#D6DED2] shadow-sage-lg z-[150]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#243028] tracking-tight">Konfirmasi Hapus</DialogTitle>
            <DialogDescription className="text-xs text-[#66736A] mt-2 leading-relaxed">
              Apakah Anda yakin ingin menghapus berkas dokumen KPR <strong>"{deleteTarget ? DOC_TYPE_LABELS[deleteTarget.customer_documents.documentType] : ""}"</strong>? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="rounded-xl border-[#D6DED2] text-xs font-semibold"
            >
              Batal
            </Button>
            <Button
              onClick={executeDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm"
            >
              Hapus Berkas
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Penolakan Berkas KPR */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent className="max-w-md bg-white p-6 rounded-3xl border border-[#D6DED2] shadow-sage-lg z-[150]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-rose-800 tracking-tight flex items-center gap-2">
              <XCircle className="h-5 w-5 text-rose-600" />
              Tolak Dokumen KPR
            </DialogTitle>
            <DialogDescription className="text-xs text-[#66736A] mt-2 leading-relaxed">
              Silakan masukkan alasan penolakan dokumen <strong>"{rejectTarget ? DOC_TYPE_LABELS[rejectTarget.customer_documents.documentType] : ""}"</strong> milik konsumen ini. Catatan revisi wajib diisi agar staf marketing dapat mengetahui penyebab penolakan berkas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            <div>
              <label className="text-xs font-bold text-[#66736A] mb-1 block">Catatan / Alasan Revisi <span className="text-rose-600">*</span></label>
              <textarea
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                placeholder="Contoh: Foto KTP kurang jelas, silakan upload ulang foto KTP yang lebih terang..."
                className="w-full text-xs p-3 rounded-xl border border-[#D6DED2] bg-[#F7F8F3]/60 focus:outline-none focus:border-rose-400 font-semibold h-24 resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setRejectTarget(null)}
              className="rounded-xl border-[#D6DED2] text-xs font-semibold"
            >
              Batal
            </Button>
            <Button
              disabled={loading || !rejectNotes.trim()}
              onClick={async () => {
                if (!rejectTarget) return;
                const docId = rejectTarget.customer_documents.id;
                setLoading(true);
                try {
                  await handleVerify(docId, "rejected", rejectNotes);
                  setRejectTarget(null);
                } finally {
                  setLoading(false);
                }
              }}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm disabled:opacity-50"
            >
              Tolak & Minta Revisi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
