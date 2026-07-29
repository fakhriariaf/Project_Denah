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
import { AlertCircle, Calendar, CheckCircle2, Loader2, Forward, User, Wrench, ShieldAlert } from "lucide-react";
import { resolveCustomerComplaint } from "@/server/actions/production";
import { useRouter } from "next/navigation";
import { getComplaintCategoryLabel } from "@/lib/label-helpers";

interface CustomerComplaintResolveDialogProps {
  complaint: {
    id: string;
    complaintNumber: string;
    description: string;
    category: string;
    unitCode: string;
    projectName: string;
    customerName: string;
  } | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CustomerComplaintResolveDialog({
  complaint,
  open,
  onClose,
  onSuccess,
}: CustomerComplaintResolveDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [resolutionStatus, setResolutionStatus] = useState<"resolved" | "waiting_customer_confirmation" | "follow_up_required" | "rejected">("resolved");
  const [developerNote, setDeveloperNote] = useState("");
  const [repairAction, setRepairAction] = useState<"no_physical_repair" | "minor_repair" | "major_repair" | "forwarded_to_supervisor" | "forwarded_to_vendor">("minor_repair");
  
  // Follow up state
  const [followUpDays, setFollowUpDays] = useState("3");
  
  // Custom message for consumer
  const [customerMessage, setCustomerMessage] = useState("");

  // Clear form on open/change
  useEffect(() => {
    if (open) {
      setResolutionStatus("resolved");
      setDeveloperNote("");
      setRepairAction("minor_repair");
      setFollowUpDays("3");
      setCustomerMessage("");
      setErrorMsg(null);
    }
  }, [open, complaint]);

  if (!complaint) return null;

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    // Manual client-side validation
    if (developerNote.trim().length < 5) {
      setErrorMsg("Catatan internal developer wajib diisi minimal 5 karakter.");
      setLoading(false);
      return;
    }

    if (resolutionStatus === "follow_up_required") {
      const days = parseInt(followUpDays) || 0;
      if (days <= 0) {
        setErrorMsg("Estimasi hari tindak lanjut wajib diisi dan lebih besar dari 0 hari.");
        setLoading(false);
        return;
      }
    }

    // Set assignedToRole depending on repairAction
    let assignedToRole: string | null = null;
    if (repairAction === "forwarded_to_supervisor") {
      assignedToRole = "Pengawas Lapangan";
    } else if (repairAction === "forwarded_to_vendor") {
      assignedToRole = "Vendor";
    } else if (resolutionStatus === "follow_up_required") {
      assignedToRole = "Admin Kantor";
    }

    try {
      const response = await resolveCustomerComplaint({
        complaintId: complaint.id,
        resolutionStatus,
        developerNote,
        repairAction,
        assignedToRole,
        followUpDays: resolutionStatus === "follow_up_required" ? parseInt(followUpDays) : undefined,
        customerMessage: customerMessage.trim() ? customerMessage : undefined,
      });

      if (response && response.success) {
        onSuccess();
        router.refresh();
        onClose();
      } else {
        setErrorMsg("Gagal menyimpan resolusi komplain konsumen.");
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
              <Wrench className="w-5 h-5 animate-pulse text-[#E8E9E5]" />
              Resolusi Komplain Konsumen
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs mt-1">
              Catat resolusi, tindakan perbaikan, dan instruksi internal untuk komplain konsumen.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleResolveSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
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
                {getComplaintCategoryLabel(complaint.category)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-[#7E8A7F] font-bold">Kavling / Unit:</span>
                <p className="font-semibold text-[#243028]">{complaint.unitCode || "-"}</p>
              </div>
              <div>
                <span className="text-[#7E8A7F] font-bold">Proyek:</span>
                <p className="font-semibold text-[#243028]">{complaint.projectName || "-"}</p>
              </div>
            </div>
            <div>
              <span className="text-[#7E8A7F] font-bold">Nama Konsumen:</span>
              <p className="font-semibold text-[#243028]">{complaint.customerName || "-"}</p>
            </div>
            <div>
              <span className="text-[#7E8A7F] font-bold">Deskripsi Masalah:</span>
              <p className="text-[#4A554D] italic mt-1 leading-relaxed bg-white p-3 rounded-lg border border-[#ECEFEA] max-h-24 overflow-y-auto">
                "{complaint.description}"
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Status Penyelesaian */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-[#3A4F3D]">Status Penyelesaian</Label>
              <Select 
                value={resolutionStatus} 
                onValueChange={(val: any) => setResolutionStatus(val)}
              >
                <SelectTrigger className="w-full! h-10 border-[#D6DED2] bg-white rounded-xl focus:ring-ring focus:border-[#4F6F52] text-sm text-[#243028]">
                  <SelectValue placeholder="Pilih status">
                    {resolutionStatus === "resolved" && "Selesai (Resolved)"}
                    {resolutionStatus === "waiting_customer_confirmation" && "Menunggu Konfirmasi Konsumen"}
                    {resolutionStatus === "follow_up_required" && "Perlu Tindak Lanjut (Follow Up)"}
                    {resolutionStatus === "rejected" && "Komplain Ditolak (Rejected)"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="border-[#D6DED2] rounded-xl shadow-lg">
                  <SelectItem value="resolved" className="focus:bg-[#E8E9E5] focus:text-[#4F6F52] py-2 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      Selesai (Resolved)
                    </span>
                  </SelectItem>
                  <SelectItem value="waiting_customer_confirmation" className="focus:bg-[#E8E9E5] focus:text-[#4F6F52] py-2 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-500 shrink-0" />
                      Menunggu Konfirmasi Konsumen
                    </span>
                  </SelectItem>
                  <SelectItem value="follow_up_required" className="focus:bg-[#E8E9E5] focus:text-[#4F6F52] py-2 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-500 shrink-0" />
                      Perlu Tindak Lanjut (Follow Up)
                    </span>
                  </SelectItem>
                  <SelectItem value="rejected" className="focus:bg-[#E8E9E5] focus:text-[#4F6F52] py-2 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
                      Komplain Ditolak (Rejected)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tindakan Perbaikan */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-[#3A4F3D]">Tindakan Perbaikan Fisik</Label>
              <Select 
                value={repairAction} 
                onValueChange={(val: any) => setRepairAction(val)}
              >
                <SelectTrigger className="w-full! h-10 border-[#D6DED2] bg-white rounded-xl focus:ring-ring focus:border-[#4F6F52] text-sm text-[#243028]">
                  <SelectValue placeholder="Pilih tindakan">
                    {repairAction === "no_physical_repair" && "Tidak Ada Perbaikan Fisik"}
                    {repairAction === "minor_repair" && "Perbaikan Ringan (Minor)"}
                    {repairAction === "major_repair" && "Perbaikan Mayor (Besar)"}
                    {repairAction === "forwarded_to_supervisor" && "Teruskan ke Pengawas Lapangan"}
                    {repairAction === "forwarded_to_vendor" && "Teruskan ke Kontraktor / Vendor"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="border-[#D6DED2] rounded-xl shadow-lg">
                  <SelectItem value="no_physical_repair" className="focus:bg-[#E8E9E5] focus:text-[#4F6F52] py-2 cursor-pointer">Tidak Ada Perbaikan Fisik</SelectItem>
                  <SelectItem value="minor_repair" className="focus:bg-[#E8E9E5] focus:text-[#4F6F52] py-2 cursor-pointer">Perbaikan Ringan (Minor)</SelectItem>
                  <SelectItem value="major_repair" className="focus:bg-[#E8E9E5] focus:text-[#4F6F52] py-2 cursor-pointer">Perbaikan Mayor (Besar)</SelectItem>
                  <SelectItem value="forwarded_to_supervisor" className="focus:bg-[#E8E9E5] focus:text-[#4F6F52] py-2 cursor-pointer font-medium text-emerald-800">
                    <span className="flex items-center gap-1.5">
                      <Forward className="w-3.5 h-3.5" /> Teruskan ke Pengawas Lapangan
                    </span>
                  </SelectItem>
                  <SelectItem value="forwarded_to_vendor" className="focus:bg-[#E8E9E5] focus:text-[#4F6F52] py-2 cursor-pointer font-medium text-amber-800">
                    <span className="flex items-center gap-1.5">
                      <Forward className="w-3.5 h-3.5" /> Teruskan ke Kontraktor / Vendor
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Optional Follow Up Days */}
            {resolutionStatus === "follow_up_required" && (
              <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-4 space-y-2 animate-fadeIn text-xs">
                <Label className="text-xs font-bold text-amber-900">Estimasi Tambahan Hari Tindak Lanjut</Label>
                <div className="flex gap-2 items-center mt-1">
                  <Input
                    type="number"
                    min="1"
                    value={followUpDays}
                    onChange={(e) => setFollowUpDays(e.target.value)}
                    className="w-24 h-9 border-amber-200 bg-white rounded-lg text-xs"
                  />
                  <span className="font-semibold text-amber-800">Hari dari sekarang</span>
                </div>
                <p className="text-[10px] text-amber-700 italic">
                  Sistem akan secara otomatis menghitung dan mengunci estimasi target tanggal tindak lanjut di database.
                </p>
              </div>
            )}

            {/* Catatan Internal Developer */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-[#3A4F3D]">Catatan Internal Developer (Wajib)</Label>
              <Textarea
                placeholder="Tuliskan catatan teknis detail, temuan tim di unit, investigasi plafon/dinding, atau instruksi internal..."
                value={developerNote}
                onChange={(e) => setDeveloperNote(e.target.value)}
                className="min-h-[85px] border-[#D6DED2] rounded-xl focus:ring-ring focus:border-[#4F6F52] text-sm"
              />
            </div>

            {/* Catatan Untuk Konsumen */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-[#3A4F3D]">Pesan untuk Konsumen (Opsional)</Label>
              <Textarea
                placeholder="Tuliskan pesan penjelasan resmi yang akan ditampilkan ke konsumen/user terkait status perbaikan..."
                value={customerMessage}
                onChange={(e) => setCustomerMessage(e.target.value)}
                className="min-h-[60px] border-[#D6DED2] rounded-xl focus:ring-ring focus:border-[#4F6F52] text-sm"
              />
            </div>
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
                "Simpan Resolusi"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
