"use client";

import React, { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { AlertCircle, Calendar, Clock, Loader2, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { reviewVendorComplaint } from "@/server/actions/production";
import { useRouter } from "next/navigation";

interface VendorComplaintReviewDialogProps {
  complaint: {
    id: string;
    complaintNumber: string;
    description: string;
    category: string;
    spkId: string | null;
    spkNumber: string;
    spkTitle: string;
    spkTargetEndDate: any; // Can be Date, number, or string
  } | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function VendorComplaintReviewDialog({
  complaint,
  open,
  onClose,
  onSuccess,
}: VendorComplaintReviewDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [decision, setDecision] = useState<"resolved" | "approved_extension" | "need_revision" | "rejected">("resolved");
  const [supervisorNote, setSupervisorNote] = useState("");
  const [extensionPreset, setExtensionPreset] = useState("3");
  const [customDays, setCustomDays] = useState("");
  const [extensionReason, setExtensionReason] = useState("");

  // Clear form on open/change
  useEffect(() => {
    if (open) {
      setDecision("resolved");
      setSupervisorNote("");
      setExtensionPreset("3");
      setCustomDays("");
      setExtensionReason("");
      setErrorMsg(null);
    }
  }, [open, complaint]);

  if (!complaint) return null;

  // Calculate extension days
  const getExtensionDaysNum = (): number => {
    if (decision !== "approved_extension") return 0;
    if (extensionPreset === "custom") {
      return parseInt(customDays) || 0;
    }
    return parseInt(extensionPreset) || 0;
  };

  const extensionDays = getExtensionDaysNum();

  // Parse target end date
  const getOldTargetDate = (): Date | null => {
    if (!complaint.spkTargetEndDate) return null;
    return new Date(complaint.spkTargetEndDate);
  };

  const oldTargetDate = getOldTargetDate();

  // Calculate new target date
  const getNewTargetDate = (): Date | null => {
    if (!oldTargetDate || decision !== "approved_extension" || extensionDays <= 0) return null;
    const newTime = oldTargetDate.getTime() + extensionDays * 24 * 60 * 60 * 1000;
    return new Date(newTime);
  };

  const newTargetDate = getNewTargetDate();

  const formatDate = (date: Date | null): string => {
    if (!date) return "-";
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const categoryLabels: Record<string, string> = {
    material: "Kekurangan Material",
    cuaca: "Cuaca Buruk",
    tenaga_kerja: "Kekurangan Pekerja",
    akses_lokasi: "Akses Lokasi Terhambat",
    revisi_desain: "Revisi Gambar / Desain",
    menunggu_instruksi: "Menunggu Instruksi",
    kendala_teknis: "Kendala Teknis Lapangan",
    lainnya: "Lain-lain",
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    // Manual client-side validation for UX
    if (supervisorNote.trim().length < 5) {
      setErrorMsg("Catatan pengawas wajib diisi minimal 5 karakter.");
      setLoading(false);
      return;
    }

    if (decision === "approved_extension") {
      if (extensionDays <= 0) {
        setErrorMsg("Jumlah tambahan waktu harus lebih besar dari 0 hari.");
        setLoading(false);
        return;
      }
      if (extensionReason.trim().length < 5) {
        setErrorMsg("Alasan tambahan waktu wajib diisi minimal 5 karakter.");
        setLoading(false);
        return;
      }
    }

    try {
      const response = await reviewVendorComplaint({
        complaintId: complaint.id,
        decision,
        supervisorNote,
        extensionDays: decision === "approved_extension" ? extensionDays : undefined,
        extensionReason: decision === "approved_extension" ? extensionReason : undefined,
      });

      if (response && response.success) {
        onSuccess();
        router.refresh();
        onClose();
      } else {
        setErrorMsg("Gagal menyimpan review komplain vendor.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan sistem saat memproses.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-lg overflow-hidden border border-[#D6DED2] bg-white/95 shadow-2xl backdrop-blur-md rounded-3xl p-0">
        <div className="bg-[#4F6F52] text-white px-6 py-5">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold tracking-wide flex items-center gap-2">
              <Clock className="w-5 h-5 animate-pulse text-[#E8E9E5]" />
              Review Kendala Vendor
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs mt-1">
              Proses dan tinjau laporan kendala konstruksi aktif dari pihak Vendor / Kontraktor.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleReviewSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Info Card */}
          <div className="bg-[#F8FAF7] border border-[#E4EAE1] rounded-2xl p-4 text-xs space-y-2.5">
            <div className="flex justify-between items-center pb-2 border-b border-[#E4EAE1]/80">
              <span className="font-bold text-[#4F6F52]">{complaint.complaintNumber}</span>
              <span className="bg-[#E4EAE1] text-[#3A4F3D] px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider">
                {categoryLabels[complaint.category] || complaint.category}
              </span>
            </div>
            <div>
              <Label className="text-[10px] text-[#7E8A7F] font-bold uppercase tracking-wider block">Judul Kendala</Label>
              <p className="text-sm font-semibold text-[#243028] mt-0.5">{complaint.spkTitle}</p>
            </div>
            <div>
              <Label className="text-[10px] text-[#7E8A7F] font-bold uppercase tracking-wider block">SPK Terkait</Label>
              <p className="text-[#3A4F3D] font-medium mt-0.5">{complaint.spkNumber}</p>
            </div>
            <div>
              <Label className="text-[10px] text-[#7E8A7F] font-bold uppercase tracking-wider block">Deskripsi Masalah</Label>
              <p className="text-[#4A554D] italic mt-1 leading-relaxed bg-white p-3 rounded-lg border border-[#ECEFEA] max-h-24 overflow-y-auto">
                "{complaint.description}"
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Keputusan Pengawas */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-[#3A4F3D]">Keputusan Pengawas</Label>
              <Select 
                value={decision} 
                onValueChange={(val: any) => setDecision(val)}
              >
                <SelectTrigger className="w-full! h-10 border-[#D6DED2] bg-white rounded-xl focus:ring-[#4F6F52] focus:border-[#4F6F52] text-sm text-[#243028]">
                  <SelectValue placeholder="Pilih keputusan">
                    {decision === "resolved" && "Selesaikan Kendala (Resolved)"}
                    {decision === "approved_extension" && "Setujui Tambahan Waktu (Extension)"}
                    {decision === "need_revision" && "Minta Revisi Info Laporan"}
                    {decision === "rejected" && "Tolak Pengajuan Komplain"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="border-[#D6DED2] rounded-xl shadow-lg">
                  <SelectItem value="resolved" className="focus:bg-[#E8E9E5] focus:text-[#4F6F52] cursor-pointer flex items-center py-2">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      Selesaikan Kendala (Resolved)
                    </span>
                  </SelectItem>
                  <SelectItem value="approved_extension" className="focus:bg-[#E8E9E5] focus:text-[#4F6F52] cursor-pointer flex items-center py-2">
                    <span className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-500 shrink-0" />
                      Setujui Tambahan Waktu (Extension)
                    </span>
                  </SelectItem>
                  <SelectItem value="need_revision" className="focus:bg-[#E8E9E5] focus:text-[#4F6F52] cursor-pointer flex items-center py-2">
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-blue-500 shrink-0" />
                      Minta Revisi Info Laporan
                    </span>
                  </SelectItem>
                  <SelectItem value="rejected" className="focus:bg-[#E8E9E5] focus:text-[#4F6F52] cursor-pointer flex items-center py-2">
                    <span className="flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                      Tolak Pengajuan Komplain
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Catatan Pengawas */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-[#3A4F3D]">Catatan Pengawas / Review</Label>
              <Textarea
                placeholder="Tuliskan ulasan pemeriksaan fisik lapangan, tindak lanjut, atau alasan keputusan secara detail..."
                value={supervisorNote}
                onChange={(e) => setSupervisorNote(e.target.value)}
                className="min-h-[80px] border-[#D6DED2] rounded-xl focus:ring-[#4F6F52] focus:border-[#4F6F52] text-sm"
              />
            </div>

            {/* Optional Extension section */}
            {decision === "approved_extension" && (
              <div className="border border-amber-200 bg-amber-50/50 rounded-2xl p-4 space-y-4 animate-fadeIn">
                <h4 className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-amber-600" />
                  Konfigurasi Perpanjangan Waktu SPK
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  {/* Preset Selector */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-semibold text-amber-900">Tambahan Waktu</Label>
                    <Select value={extensionPreset} onValueChange={(val) => setExtensionPreset(val || "3")}>
                      <SelectTrigger className="w-full! h-9 border-amber-200 bg-white rounded-lg text-xs">
                        <SelectValue placeholder="Pilih tambahan waktu">
                          {extensionPreset === "1" && "+1 Hari"}
                          {extensionPreset === "3" && "+3 Hari"}
                          {extensionPreset === "7" && "+1 Minggu (7 Hari)"}
                          {extensionPreset === "14" && "+2 Minggu (14 Hari)"}
                          {extensionPreset === "custom" && "Kustom Hari"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="border-amber-100 rounded-lg">
                        <SelectItem value="1">+1 Hari</SelectItem>
                        <SelectItem value="3">+3 Hari</SelectItem>
                        <SelectItem value="7">+1 Minggu (7 Hari)</SelectItem>
                        <SelectItem value="14">+2 Minggu (14 Hari)</SelectItem>
                        <SelectItem value="custom">Kustom Hari</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Custom Days Input */}
                  {extensionPreset === "custom" && (
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold text-amber-900">Jumlah Hari</Label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Contoh: 5"
                        value={customDays}
                        onChange={(e) => setCustomDays(e.target.value)}
                        className="h-9 border-amber-200 bg-white rounded-lg text-xs"
                      />
                    </div>
                  )}
                </div>

                {/* Extension Reason */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-semibold text-amber-900">Alasan Tambahan Waktu (Wajib)</Label>
                  <Textarea
                    placeholder="Contoh: Menimbang cuaca ekstrim intensitas tinggi selama 3 hari berturut-turut..."
                    value={extensionReason}
                    onChange={(e) => setExtensionReason(e.target.value)}
                    className="min-h-[60px] border-amber-200 bg-white rounded-lg text-xs"
                  />
                </div>

                {/* Target Date Preview */}
                {oldTargetDate && extensionDays > 0 && (
                  <div className="text-[11px] bg-white border border-amber-100 rounded-xl p-3 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-[#6B7280]">Target SPK Semula:</span>
                      <span className="font-semibold text-[#374151]">{formatDate(oldTargetDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#6B7280]">Tambahan Hari:</span>
                      <span className="font-bold text-amber-600">+{extensionDays} Hari</span>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-[#F3F4F6] text-xs">
                      <span className="font-bold text-amber-900">Estimasi Target Baru:</span>
                      <span className="font-bold text-emerald-700">{formatDate(newTargetDate)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="border-[#D6DED2] text-[#4A554D] rounded-xl hover:bg-[#F4F6F3]"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#4F6F52] hover:bg-[#3A4F3D] text-white rounded-xl flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan Keputusan"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
