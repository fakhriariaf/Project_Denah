"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { attachExistingPaymentProof, uploadPaymentProof } from "@/server/actions/marketing";
import { Button } from "@/components/ui/button";
import { Upload, FileCheck, AlertCircle, X, FilePlus } from "lucide-react";
import { parseServerError } from "@/lib/error-parser";
import { useI18n } from "@/lib/i18n";

interface Props {
  bookingId: string;
  paymentType: "booking_fee" | "dp" | "cash_settlement" | "installment";
  invoiceId?: string;
  existingPaymentId?: string;
}

export default function BookingPaymentProofForm({
  bookingId,
  paymentType,
  invoiceId,
  existingPaymentId,
}: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
      setSuccess(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError(t("booking_proof.error_empty"));
      return;
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (selectedFile.size > MAX_SIZE) {
      setError(t("booking_proof.error_size"));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const uploadRes = await fetch("/api/upload-attachment", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json();
        throw new Error(errData.error || t("booking_proof.error_upload"));
      }

      const fileData = await uploadRes.json();
      
      const proofData = {
        fileName: selectedFile.name,
        fileUrl: fileData.url,
        mimeType: selectedFile.type,
        fileSize: selectedFile.size,
      };
      const res = existingPaymentId
        ? await attachExistingPaymentProof(bookingId, existingPaymentId, proofData)
        : await uploadPaymentProof(bookingId, proofData, paymentType, invoiceId);

      if (res.success) {
        setSuccess(true);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        router.refresh();
      }
    } catch (err: any) {
      setError(parseServerError(err));
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const paymentProofLabel =
    paymentType === "booking_fee"
      ? "Booking Fee (BF)"
      : paymentType === "dp"
        ? "Uang Muka (DP)"
        : "Pelunasan Cash";

  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-sage">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-xl bg-secondary text-primary flex items-center justify-center">
          <FilePlus className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-bold text-foreground text-sm">
            {"Upload Bukti " + paymentProofLabel}
          </h3>
          <p className="text-[10px] text-muted-foreground">{t("booking_proof.format")}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Feedback States */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-semibold">
            <FileCheck className="h-4 w-4 shrink-0" />
            {t("booking_proof.success")}
          </div>
        )}

        {/* Drag & Drop Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 ${
            isDragOver
              ? "border-[#4F6F52] bg-secondary/30 scale-[1.01]"
              : selectedFile
                ? "border-primary/50 bg-secondary/20"
                : "border-border bg-muted/30/50 hover:border-primary/50 hover:bg-secondary/10"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileChange}
            className="hidden"
          />
          
          {selectedFile ? (
            <>
              <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center">
                <FileCheck className="h-6 w-6 text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-foreground truncate max-w-[200px]">{selectedFile.name}</p>
                <p className="text-xs text-primary/70 font-mono">{formatFileSize(selectedFile.size)}</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="absolute top-2 right-2 h-6 w-6 rounded-full bg-rose-100 text-rose-600 hover:bg-rose-200 flex items-center justify-center transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <>
              <div className="h-12 w-12 rounded-xl bg-secondary/60 flex items-center justify-center">
                <Upload className="h-6 w-6 text-primary/70" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">
                  {t("booking_proof.drag_drop")}
                </p>
                <p className="text-xs text-primary/70">{t("booking_proof.drag_drop_format")}</p>
              </div>
            </>
          )}
        </div>

        <Button
          type="submit"
          disabled={loading || !selectedFile || success}
          className="w-full bg-primary hover:bg-[#3F5941] text-white font-bold rounded-xl shadow-[0_2px_8px_rgba(79,111,82,0.25)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {t("booking_proof.uploading")}
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              {"Upload Bukti " + paymentProofLabel}
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
