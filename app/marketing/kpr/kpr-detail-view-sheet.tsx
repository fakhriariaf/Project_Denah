"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { verifyCustomerDocument } from "@/server/actions/marketing";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  Building,
  FileText,
  Calendar,
  Phone,
  ClipboardList,
  Building2,
  Bookmark,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Hammer,
  HardHat,
  Check,
  X,
  RotateCcw,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/lib/i18n";
import { KprMilestoneTracker } from "./kpr-milestone-tracker";

interface Props {
  kpr: any;
  bankPartners: any[];
  submissions: any[];
  documents: any[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canVerifyDocs?: boolean;
}

export default function KprDetailViewSheet({
  kpr,
  bankPartners,
  submissions,
  documents,
  open,
  onOpenChange,
  canVerifyDocs = false,
}: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [docsList, setDocsList] = useState(documents);

  useEffect(() => {
    setDocsList(documents);
  }, [documents]);

  const handleVerify = async (docId: string, docStatus: "verified" | "rejected", notes?: string) => {
    setLoading(true);
    try {
      const res = await verifyCustomerDocument(docId, docStatus, notes);
      if (res.success) {
        setDocsList((prev) =>
          prev.map((d) => (d.id === docId ? { ...d, status: docStatus, notes: notes || null } : d))
        );
        router.refresh();
      }
    } catch (err: any) {
      alert(err.message || "Gagal memperbarui verifikasi berkas.");
    } finally {
      setLoading(false);
    }
  };

  const handleRejectClick = (docId: string) => {
    const notes = prompt("Masukkan alasan penolakan berkas:");
    if (notes === null) return;
    if (!notes.trim()) {
      alert("Alasan penolakan wajib diisi!");
      return;
    }
    handleVerify(docId, "rejected", notes.trim());
  };


  const getKprStatusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      bi_checking: { label: "BI Checking", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
      pemberkasan: { label: "Pemberkasan", className: "bg-amber-50 text-amber-700 border-amber-200" },
      proses_bank: { label: "Proses Bank", className: "bg-blue-50 text-blue-700 border-blue-200" },
      offering:    { label: "Offering Letter", className: "bg-purple-50 text-purple-700 border-purple-200" },
      approved:    { label: "Approved KPR", className: "bg-teal-50 text-teal-700 border-teal-200" },
      rejected:    { label: "Rejected KPR", className: "bg-rose-50 text-rose-700 border-rose-200" },
      akad:        { label: "Akad Kredit", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
      realisasi:   { label: "Realisasi Dana", className: "bg-cyan-50 text-cyan-700 border-cyan-200" },
    };
    const current = map[status] || { label: status, className: "bg-slate-50 text-slate-700 border-slate-200" };
    return (
      <Badge variant="outline" className={`font-black text-[10px] px-2.5 py-0.5 rounded-full ${current.className}`}>
        {current.label}
      </Badge>
    );
  };

  const getBiCheckStatusBadge = (biCheck: string) => {
    const map: Record<string, { label: string; className: string }> = {
      pending: { label: "Pending", className: "bg-amber-50 text-amber-700 border-amber-200" },
      partial: { label: "Disetujui Sebagian", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
      approved: { label: "Lolos BI Checking", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
      rejected_refund: { label: "Ditolak (Refund)", className: "bg-rose-50 text-rose-700 border-rose-200" },
      rejected_no_refund: { label: "Ditolak (Tanpa Refund)", className: "bg-rose-100 text-rose-800 border-rose-300" },
    };
    const current = map[biCheck] || { label: biCheck, className: "bg-slate-50 text-slate-700 border-slate-200" };
    return (
      <Badge variant="outline" className={`font-black text-[10px] px-2.5 py-0.5 rounded-full ${current.className}`}>
        {current.label}
      </Badge>
    );
  };

  const getSubmissionStatusBadge = (subStatus: string) => {
    const map: Record<string, { label: string; className: string }> = {
      submitted: { label: "Diajukan", className: "bg-blue-50 text-blue-700 border-blue-100" },
      verified: { label: "Diverifikasi", className: "bg-indigo-50 text-indigo-700 border-indigo-100" },
      offering: { label: "Offering", className: "bg-purple-50 text-purple-700 border-purple-100" },
      approved: { label: "Disetujui", className: "bg-emerald-50 text-emerald-700 border-emerald-100" },
      rejected: { label: "Ditolak", className: "bg-rose-50 text-rose-700 border-rose-100" },
    };
    const current = map[subStatus] || { label: subStatus, className: "bg-slate-50 text-slate-700 border-slate-100" };
    return (
      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${current.className}`}>
        {current.label}
      </span>
    );
  };

  // Decode JSON bank notes
  let parsedNotes: Record<string, string> = {};
  if (kpr.bankNotes) {
    try {
      parsedNotes = JSON.parse(kpr.bankNotes);
    } catch (e) {
      // Fallback if not JSON
      parsedNotes = { general: kpr.bankNotes };
    }
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-4xl bg-[#F7F8F3] border-l border-[#D6DED2] p-0 overflow-hidden flex flex-col h-full z-[100] sm:rounded-l-3xl shadow-[0_8px_30px_rgba(79,111,82,0.18)]"
      >
        {/* Sleek Header */}
        <div className="bg-white p-6 border-b border-[#D6DED2] shrink-0 shadow-sm rounded-tl-3xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-[#4F6F52] text-white flex items-center justify-center shadow-[0_4px_12px_rgba(79,111,82,0.3)] shrink-0">
                <ClipboardList className="h-6 w-6 text-white" />
              </div>
              <div className="min-w-0 space-y-1">
                <span className="text-[9px] font-black text-[#8FAF9A] uppercase tracking-widest block">
                  Detail Lengkap Proses KPR
                </span>
                <SheetTitle className="text-lg font-black text-[#243028] tracking-tight truncate">
                  {kpr.customerName}
                </SheetTitle>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <span className="text-xs text-[#66736A] font-semibold">
                    Unit:{" "}
                    <span className="font-mono font-bold text-[#4F6F52] bg-[#DDE8D8] px-2 py-0.5 rounded border border-[#8FAF9A]/30">
                      {kpr.unitCode}
                    </span>
                  </span>
                  <span className="text-[10px] text-[#A8B0AA]">•</span>
                  <span className="text-xs text-[#66736A] font-bold">{kpr.projectName}</span>
                  {kpr.isReadyStock && (
                    <Badge className="bg-[#4F6F52]/10 text-[#4F6F52] hover:bg-[#4F6F52]/20 border border-[#8FAF9A]/30 font-extrabold text-[9px] px-2 py-0.5 rounded-full shrink-0">
                      🏡 Ready Stock
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Status Tags */}
            <div className="flex flex-col sm:items-end gap-1.5 shrink-0 self-start sm:self-center">
              <div className="flex items-center gap-1.5">
                {getKprStatusBadge(kpr.status)}
                {getBiCheckStatusBadge(kpr.biCheckStatus)}
              </div>
              <span className="text-[9px] font-mono text-[#66736A]/50">
                Booking Ref: #{kpr.bookingNumber}
              </span>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-[#D6DED2]/50 overflow-hidden">
            <KprMilestoneTracker 
              data={{
                unitStatus: kpr.unitStatus,
                kprStatus: kpr.status,
                isReadyStock: kpr.isReadyStock,
                readyStockSource: kpr.readyStockSource || null,
                constructionProgress: kpr.constructionProgress
              }}
              orientation="horizontal"
            />
          </div>
        </div>

        {/* Scrollable Tabs Body */}
        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue="overview" className="w-full flex flex-col h-full">
            <div className="bg-white border-b border-[#D6DED2] px-6 py-2 shrink-0">
              <TabsList className="bg-[#F7F8F3] border border-[#D6DED2]/60 p-1 rounded-xl flex gap-1 h-9 max-w-fit">
                <TabsTrigger
                  value="overview"
                  className="rounded-lg px-4 py-1.5 text-xs font-bold gap-1.5 data-[state=active]:bg-white data-[state=active]:text-[#4F6F52] data-[state=active]:shadow-sm transition-all"
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  Ringkasan &amp; Unit
                </TabsTrigger>
                <TabsTrigger
                  value="submissions"
                  className="rounded-lg px-4 py-1.5 text-xs font-bold gap-1.5 data-[state=active]:bg-white data-[state=active]:text-[#4F6F52] data-[state=active]:shadow-sm transition-all"
                >
                  <Building className="h-3.5 w-3.5" />
                  Pengajuan Bank ({submissions.length})
                </TabsTrigger>
                <TabsTrigger
                  value="documents"
                  className="rounded-lg px-4 py-1.5 text-xs font-bold gap-1.5 data-[state=active]:bg-white data-[state=active]:text-[#4F6F52] data-[state=active]:shadow-sm transition-all"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Berkas Konsumen ({documents.length})
                </TabsTrigger>
              </TabsList>
            </div>

            {/* TAB CONTENT 1: OVERVIEW */}
            <TabsContent value="overview" className="p-6 space-y-6 focus-visible:outline-none focus-visible:ring-0 mt-0">
              {/* 1. Customer Personal Profile Card */}
              <div className="bg-white rounded-3xl p-5 border border-[#D6DED2] shadow-sm space-y-4">
                <h4 className="text-xs font-black text-[#243028] uppercase tracking-wider flex items-center gap-2 border-b border-[#D6DED2]/40 pb-3">
                  <User className="h-4.5 w-4.5 text-[#4F6F52]" />
                  Profil &amp; Kontak Konsumen
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider block">Nama Lengkap</span>
                    <p className="text-sm font-extrabold text-[#243028]">{kpr.customerName}</p>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider block">Nomor Telepon</span>
                    <a
                      href={`https://wa.me/${kpr.customerPhone.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-[#4F6F52] hover:underline flex items-center gap-1.5 font-mono"
                    >
                      <Phone className="h-3.5 w-3.5" /> {kpr.customerPhone} (WhatsApp)
                    </a>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider block">PIC Pemasaran</span>
                    <p className="text-xs font-semibold text-[#243028]">{kpr.marketingName || "—"}</p>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider block">Dokumen Checklist KPR</span>
                    <Badge variant="outline" className={`font-mono text-[9px] px-2 py-0.5 rounded font-black ${
                      kpr.documentStatus === "complete" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}>
                      {kpr.documentStatus === "complete" ? "LENGKAP" : "BELUM LENGKAP"}
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider block">Status Verifikasi Berkas</span>
                    {(() => {
                      const unverified = documents.some(d => d.status !== "verified");
                      return unverified ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-mono text-[9px] px-2 py-0.5 rounded font-black">
                          ⚠️ ADA BERKAS BELUM TERVERIFIKASI
                        </Badge>
                      ) : documents.length > 0 ? (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-mono text-[9px] px-2 py-0.5 rounded font-black">
                          ✓ SEMUA BERKAS TERVERIFIKASI
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 font-mono text-[9px] px-2 py-0.5 rounded font-black">
                          BELUM ADA BERKAS
                        </Badge>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* 2. Unit Specs & Price Information */}
              <div className="bg-white rounded-3xl p-5 border border-[#D6DED2] shadow-sm space-y-4">
                <h4 className="text-xs font-black text-[#243028] uppercase tracking-wider flex items-center gap-2 border-b border-[#D6DED2]/40 pb-3">
                  <Building2 className="h-4.5 w-4.5 text-[#4F6F52]" />
                  Spesifikasi Fisik &amp; Finansial Unit
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-[#F7F8F3]/60 p-3 rounded-2xl border border-[#D6DED2]/50">
                    <span className="text-[9px] text-[#66736A] font-bold uppercase tracking-wider block mb-1">Luas Tanah</span>
                    <p className="font-mono font-extrabold text-xs">{kpr.landArea || 84} m²</p>
                  </div>
                  <div className="bg-[#F7F8F3]/60 p-3 rounded-2xl border border-[#D6DED2]/50">
                    <span className="text-[9px] text-[#66736A] font-bold uppercase tracking-wider block mb-1">Luas Bangunan</span>
                    <p className="font-mono font-extrabold text-xs">{kpr.buildingArea || 50} m²</p>
                  </div>
                  <div className="bg-[#F7F8F3]/60 p-3 rounded-2xl border border-[#D6DED2]/50">
                    <span className="text-[9px] text-[#66736A] font-bold uppercase tracking-wider block mb-1">Tipe Desain</span>
                    <p className="font-extrabold text-xs">{kpr.typeName || "Tipe Standar"}</p>
                  </div>
                  <div className="bg-[#F7F8F3]/60 p-3 rounded-2xl border border-[#D6DED2]/50">
                    <span className="text-[9px] text-[#66736A] font-bold uppercase tracking-wider block mb-1">Jalur Peta</span>
                    <p className="font-extrabold text-xs uppercase">{kpr.cluster || "Blok A"}</p>
                  </div>

                  <div className="col-span-2 bg-[#F7F8F3] p-3 rounded-2xl border border-[#D6DED2] flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-[#66736A] font-bold uppercase tracking-wider block mb-0.5">Total Harga Unit</span>
                      <p className="text-sm font-extrabold text-[#4F6F52]">{formatCurrency(kpr.price || 420000000)}</p>
                    </div>
                  </div>
                  <div className="col-span-2 bg-[#4F6F52]/5 p-3 rounded-2xl border border-[#4F6F52]/20 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-[#4F6F52] font-black uppercase tracking-wider block mb-0.5">Plafond KPR Disetujui</span>
                      <p className="text-sm font-black text-[#4F6F52]">
                        {(() => {
                          const approvedSub = submissions.find(s => s.status === "approved");
                          return approvedSub?.plafondAmount ? formatCurrency(approvedSub.plafondAmount) : "Belum Disetujui Bank";
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Bank Verification Notes History */}
              <div className="bg-white rounded-3xl p-5 border border-[#D6DED2] shadow-sm space-y-4">
                <h4 className="text-xs font-black text-[#243028] uppercase tracking-wider flex items-center gap-2 border-b border-[#D6DED2]/40 pb-3">
                  <ClipboardList className="h-4.5 w-4.5 text-[#4F6F52]" />
                  Catatan Progres Tahapan Analisis Bank
                </h4>
                <div className="space-y-3.5">
                  {[
                    { key: "bi_checking", label: "BI Checking & SLIK" },
                    { key: "pemberkasan", label: "Fase Pemberkasan KPR" },
                    { key: "proses_bank", label: "Fase Pemeriksaan Analis Bank" },
                    { key: "offering", label: "Penerbitan Offering / SP3K" },
                    { key: "approved", label: "Persetujuan KPR Kredit" },
                    { key: "akad", label: "Akad Jual Beli & Kredit Bank" }
                  ].map((step) => {
                    const note = parsedNotes[step.key];
                    return (
                      <div key={step.key} className="flex gap-4 text-xs">
                        <div className="w-40 shrink-0 font-extrabold text-[#66736A] flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${kpr.status === step.key ? "bg-[#4F6F52] animate-pulse" : "bg-[#A8B0AA]"}`} />
                          <span>{step.label}</span>
                        </div>
                        <div className="flex-1 bg-[#F7F8F3]/50 p-2.5 rounded-xl border border-[#D6DED2]/30 min-h-[38px] flex items-center">
                          <p className={`leading-relaxed ${note ? "text-[#243028] font-bold" : "text-[#66736A]/40 font-semibold"}`}>
                            {note || "Tidak ada catatan progres khusus."}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* 4. Construction Status Card — only shown for approved/akad KPR + unit in construction */}
              {(kpr.status === "approved" || kpr.status === "akad") &&
               (kpr.unitStatus === "construction" || kpr.unitStatus === "construction_done") && (
                <div className={`rounded-3xl border p-5 shadow-sm space-y-3 ${
                  kpr.unitStatus === "construction_done"
                    ? "border-emerald-200 bg-emerald-50/60"
                    : "border-orange-200 bg-orange-50/60"
                }`}>
                  <h4 className="text-xs font-black text-[#243028] uppercase tracking-wider flex items-center gap-2 border-b border-[#D6DED2]/40 pb-3">
                    {kpr.unitStatus === "construction_done" ? (
                      <HardHat className={`h-4 w-4 text-emerald-600`} />
                    ) : (
                      <Hammer className={`h-4 w-4 text-orange-600`} />
                    )}
                    <span className={kpr.unitStatus === "construction_done" ? "text-emerald-700" : "text-orange-700"}>
                      Status Pembangunan Fisik
                    </span>
                  </h4>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#66736A]">Progress Konstruksi</span>
                    <span className={`text-lg font-black font-mono ${
                      kpr.unitStatus === "construction_done" ? "text-emerald-700" : "text-orange-700"
                    }`}>
                      {kpr.constructionProgress ?? 0}%
                    </span>
                  </div>

                  <Progress
                    value={kpr.constructionProgress ?? 0}
                    className={`h-2.5 rounded-full [&_[data-slot=progress-track]]:h-2.5 ${
                      kpr.unitStatus === "construction_done"
                        ? "[&_[data-slot=progress-indicator]]:bg-emerald-500"
                        : "[&_[data-slot=progress-indicator]]:bg-orange-500"
                    }`}
                  />

                  <p className={`text-xs font-semibold leading-relaxed ${
                    kpr.unitStatus === "construction_done"
                      ? "text-emerald-700"
                      : "text-orange-700"
                  }`}>
                    {kpr.unitStatus === "construction_done"
                      ? "✓ Pembangunan fisik selesai. Unit siap melanjutkan ke tahap Akad Kredit."
                      : `⏳ Pembangunan fisik sedang berjalan. Proses Akad baru bisa dilakukan setelah konstruksi mencapai 100%.`}
                  </p>
                </div>
              )}

              {/* 5. Status: Menunggu Serah Terima */}
              {kpr.unitStatus === "menunggu_serah_terima" && (
                <div className="rounded-3xl border border-violet-200 bg-violet-50/60 p-5 shadow-sm space-y-3">
                  <h4 className="text-xs font-black text-violet-700 uppercase tracking-wider flex items-center gap-2 border-b border-violet-200/40 pb-3">
                    <span className="h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
                    Menunggu Serah Terima
                  </h4>
                  <p className="text-xs font-semibold text-violet-700 leading-relaxed">
                    ⏳ Dana KPR telah direalisasikan dari bank kepada Developer. Unit kini menunggu proses serah terima fisik kepada konsumen (BAST Developer → Konsumen).
                  </p>
                </div>
              )}

              {/* 6. Status: Serah Terima Selesai */}
              {kpr.unitStatus === "handover_complete" && (
                <div className="rounded-3xl border border-teal-200 bg-teal-50/60 p-5 shadow-sm space-y-3">
                  <h4 className="text-xs font-black text-teal-700 uppercase tracking-wider flex items-center gap-2 border-b border-teal-200/40 pb-3">
                    <span className="h-2 w-2 rounded-full bg-teal-500" />
                    Serah Terima Selesai
                  </h4>
                  <p className="text-xs font-semibold text-teal-700 leading-relaxed">
                    ✓ Unit telah resmi diserahterimakan kepada konsumen. BAST Developer → Konsumen telah diverifikasi dan disetujui. Siklus unit selesai.
                  </p>
                </div>
              )}

            </TabsContent>

            {/* TAB CONTENT 2: SUBMISSIONS */}
            <TabsContent value="submissions" className="p-6 focus-visible:outline-none focus-visible:ring-0 mt-0">
              <div className="bg-white rounded-3xl p-5 border border-[#D6DED2] shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-[#D6DED2]/40 pb-3">
                  <h4 className="text-xs font-black text-[#243028] uppercase tracking-wider flex items-center gap-2">
                    <Building2 className="h-4.5 w-4.5 text-[#4F6F52]" />
                    Status Pengajuan Bank Rekanan
                  </h4>
                  <Badge variant="outline" className="font-mono bg-[#F7F8F3] text-[#243028] border border-[#D6DED2] text-[10px] px-2 py-0.5 rounded-md">
                    Total: {submissions.length} Pengajuan
                  </Badge>
                </div>

                {submissions.length === 0 ? (
                  <div className="py-16 text-center text-[#66736A]/60 flex flex-col justify-center items-center gap-2">
                    <Building2 className="h-10 w-10 text-[#A8B0AA] opacity-50 animate-pulse" />
                    <p className="font-bold text-xs">Belum Ada Pengajuan ke Bank Rekanan</p>
                    <p className="text-[10px] leading-relaxed max-w-[280px]">
                      Berkas KPR belum pernah diajukan ke bank rekanan manapun di database saat ini.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {submissions.map((sub) => {
                      const bp = bankPartners.find(b => b.id === sub.bankPartnerId);
                      return (
                        <div key={sub.id} className="p-4 bg-[#F7F8F3]/60 border border-[#D6DED2] rounded-2xl flex flex-col sm:flex-row justify-between gap-4 transition-all hover:bg-[#F7F8F3] hover:shadow-sm">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="h-8 w-8 rounded-xl bg-white border border-[#D6DED2] text-[#4F6F52] flex items-center justify-center shrink-0">
                                🏦
                              </span>
                              <div>
                                <h5 className="font-extrabold text-xs text-[#243028]">{bp?.name || "Bank Rekanan"}</h5>
                                <p className="text-[9px] text-[#66736A] font-bold mt-0.5 flex items-center gap-1 font-mono">
                                  <Calendar className="h-3 w-3" /> Tanggal Pengajuan: {new Date(sub.submissionDate).toLocaleDateString("id-ID")}
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-1">
                              <div>
                                <span className="text-[8px] text-[#66736A] font-bold uppercase block">Plafond</span>
                                <span className="font-mono text-xs font-extrabold text-[#243028]">
                                  {sub.plafondAmount ? formatCurrency(sub.plafondAmount) : "—"}
                                </span>
                              </div>
                              <div>
                                <span className="text-[8px] text-[#66736A] font-bold uppercase block">Tenor</span>
                                <span className="font-mono text-xs font-extrabold text-[#243028]">
                                  {sub.tenorYear ? `${sub.tenorYear} Tahun` : "—"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="self-start sm:self-center">
                            {getSubmissionStatusBadge(sub.status)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TAB CONTENT 3: DOCUMENTS */}
            <TabsContent value="documents" className="p-6 focus-visible:outline-none focus-visible:ring-0 mt-0">
              <div className="bg-white rounded-3xl p-5 border border-[#D6DED2] shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-[#D6DED2]/40 pb-3">
                  <h4 className="text-xs font-black text-[#243028] uppercase tracking-wider flex items-center gap-2">
                    <FileText className="h-4.5 w-4.5 text-[#4F6F52]" />
                    Berkas Administrasi Konsumen
                  </h4>
                  <Badge variant="outline" className="font-mono bg-[#F7F8F3] text-[#243028] border border-[#D6DED2] text-[10px] px-2 py-0.5 rounded-md">
                    Total: {documents.length} Berkas
                  </Badge>
                </div>

                {documents.length === 0 ? (
                  <div className="py-16 text-center text-[#66736A]/60 flex flex-col justify-center items-center gap-2">
                    <FileText className="h-10 w-10 text-[#A8B0AA] opacity-50 animate-pulse" />
                    <p className="font-bold text-xs">Belum Ada Dokumen Terunggah</p>
                    <p className="text-[10px] leading-relaxed max-w-[280px]">
                      Konsumen belum mengunggah berkas-berkas persyaratan seperti KTP, NPWP, Slip Gaji, atau Kartu Keluarga.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {docsList.map((doc) => {
                      const docLabels: Record<string, string> = {
                        ktp: "Kartu Tanda Penduduk (KTP)",
                        npwp: "Nomor Pokok Wajib Pajak (NPWP)",
                        slip_gaji: "Slip Gaji / Penghasilan",
                        kk: "Kartu Keluarga (KK)",
                        spjb: "SPJB Konsumen",
                        kpr_doc: "Dokumen KPR Lainnya",
                        other: "Berkas Pendukung",
                      };

                      return (
                        <div key={doc.id} className="p-3 bg-[#F7F8F3]/60 border border-[#D6DED2] rounded-2xl flex items-center justify-between text-xs transition-all hover:bg-[#F7F8F3]">
                          <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                            <div className={`p-2 rounded-xl shrink-0 ${
                              doc.status === "verified" 
                                ? "bg-emerald-50 text-emerald-600" 
                                : doc.status === "rejected"
                                ? "bg-rose-50 text-rose-600"
                                : "bg-amber-50 text-amber-600"
                            }`}>
                              <ShieldCheck className="h-4.5 w-4.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-extrabold text-[#243028] text-[11px] truncate">
                                  {docLabels[doc.documentType] || doc.documentType.toUpperCase()}
                                </p>
                                {doc.status === "verified" ? (
                                  <Badge className="bg-emerald-50 hover:bg-emerald-50 text-emerald-700 border border-emerald-200 text-[8px] font-black px-1.5 py-0.2 rounded shrink-0">
                                    ✓ Terverifikasi
                                  </Badge>
                                ) : doc.status === "rejected" ? (
                                  <Badge className="bg-rose-50 hover:bg-rose-50 text-rose-700 border border-rose-200 text-[8px] font-black px-1.5 py-0.2 rounded shrink-0">
                                    ❌ Ditolak
                                  </Badge>
                                ) : (
                                  <Badge className="bg-amber-50 hover:bg-amber-50 text-amber-700 border border-amber-200 text-[8px] font-black px-1.5 py-0.2 rounded shrink-0">
                                    ⚠️ Belum Terverifikasi
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[9px] text-[#66736A] font-mono truncate max-w-[170px] mt-0.5">
                                {doc.fileName || "file_berkas.pdf"}
                              </p>
                              {doc.status === "rejected" && doc.notes && (
                                <div className="mt-1.5 p-2.5 bg-rose-50/60 border border-rose-200/40 rounded-xl text-[10px] text-rose-700 font-semibold flex items-start gap-1.5 shadow-inner max-w-sm">
                                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                                  <div>
                                    <span className="font-black block text-[8px] uppercase tracking-wider text-rose-800">Alasan Penolakan:</span>
                                    <p className="mt-0.5 font-bold leading-relaxed">{doc.notes}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 flex items-center gap-1.5 ml-2">
                            <a
                              href={doc.fileUrl || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="h-8 w-8 bg-slate-50 hover:bg-[#DDE8D8]/50 border border-[#D6DED2]/50 text-[#4F6F52] flex items-center justify-center transition-all shadow-sm rounded-xl"
                              title="Lihat Berkas"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>

                            {canVerifyDocs && (
                              <>
                                {doc.status !== "verified" && (
                                  <button
                                    type="button"
                                    onClick={() => handleVerify(doc.id, "verified")}
                                    disabled={loading}
                                    className="h-8 w-8 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/50 flex items-center justify-center transition-all shadow-sm font-bold rounded-xl"
                                    title="Setujui Berkas"
                                  >
                                    <Check className="h-4 w-4 text-emerald-600" />
                                  </button>
                                )}
                                {doc.status !== "rejected" && (
                                  <button
                                    type="button"
                                    onClick={() => handleRejectClick(doc.id)}
                                    disabled={loading}
                                    className="h-8 w-8 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/50 flex items-center justify-center transition-all shadow-sm font-bold rounded-xl"
                                    title="Tolak Berkas"
                                  >
                                    <X className="h-4 w-4 text-rose-600" />
                                  </button>
                                )}
                                {doc.status === "verified" && (
                                  <button
                                    type="button"
                                    onClick={() => handleVerify(doc.id, "rejected", "Dibatalkan verifikasi")}
                                    disabled={loading}
                                    className="h-8 w-8 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200/50 flex items-center justify-center transition-all shadow-sm"
                                    title="Batalkan & Tolak"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5 text-rose-600" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
