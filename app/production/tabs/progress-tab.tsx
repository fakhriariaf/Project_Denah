"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  HardHat, Plus, CheckCircle2, XCircle, FileText,
  AlertTriangle, UploadCloud, Layers, Wrench, TrendingUp,
  ClipboardList, ExternalLink, Camera, Calendar, Clock,
  MessageSquare, Loader2, Trash2,
} from "lucide-react";
import Image from "next/image";
import {
  inputProgress, createHandoverEstimation, getSpkDetails,
  getHandoverEstimations, uploadProgressPhotoAttachment,
  completeConstruction, uploadBastAttachment, getBastAttachmentForSpk,
  getCustomerBastForUnit, uploadCustomerBastFromProduction,
  deleteCustomerBastDocument, deleteProgressLog,
} from "@/server/actions/production";
import { getSpkStatusLabel } from "@/lib/label-helpers";

interface Spk {
  id: string; spkNumber: string; projectId: string | null; unitId: string | null;
  vendorId: string | null; title: string; workDescription: string;
  status: "draft" | "active" | "completed" | "overdue" | "cancelled" | "proses_konstruksi" | "selesai_konstruksi";
  progressPct: number; projectName: string; unitCode: string; vendorName: string;
}

interface Unit {
  id: string; code: string; projectId: string | null; price: number; status: string;
  constructionProgress: number; readyStockSource?: string | null; isReadyStock?: boolean;
}

export interface ProgressTabProps {
  spks: Spk[];
  units: Unit[];
  workItems: Array<{ id: string; code: string; name: string; defaultWeightPct: number }>;
  isSuperAdmin?: boolean;
  isPengawas?: boolean;
  isVendor?: boolean;
  /** External control: if set, open the progress dialog for a specific SPK */
  externalProgressSpkId?: string | null;
  externalProgressTab?: string | null;
  onExternalProgressHandled?: () => void;
}

export function ProgressTab({
  spks, units, workItems,
  isSuperAdmin = false, isPengawas = false, isVendor: _isVendor = false,
  externalProgressSpkId, externalProgressTab, onExternalProgressHandled,
}: ProgressTabProps) {
  const router = useRouter();
  const { t } = useI18n();
  const canManageBast = isSuperAdmin || isPengawas;

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  // Unit detail view
  const [selectedUnitId, setSelectedUnitId] = React.useState<string | null>(null);
  const [spkWeights, setSpkWeights] = React.useState<Array<{ workItemId: string; name: string; weightPct: number; currentProgress: number }>>([]);
  const [spkLogs, setSpkLogs] = React.useState<Array<any>>([]);
  const [handoverEstimations, setHandoverEstimations] = React.useState<Array<any>>([]);
  const [activeUnitBast, setActiveUnitBast] = React.useState<any | null>(null);
  const [customerBast, setCustomerBast] = React.useState<any | null>(null);

  // BAST Upload Dialog
  const [bastDialogOpen, setBastDialogOpen] = React.useState(false);
  const [bastUnit, setBastUnit] = React.useState<any | null>(null);
  const [bastSpk, setBastSpk] = React.useState<any | null>(null);
  const [bastPdfFile, setBastPdfFile] = React.useState<File | null>(null);

  // Progress dialog
  const [progressOpen, setProgressOpen] = React.useState(false);
  const [progressTab, setProgressTab] = React.useState<string>("form");
  const [uploadedPhotos, setUploadedPhotos] = React.useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);

  // Handover dialog
  const [handoverOpen, setHandoverOpen] = React.useState(false);

  // Progress form state
  const [newProgress, setNewProgress] = React.useState({
    spkId: "", workItemId: "", percentageAdded: 10,
    progressDate: new Date().toISOString().slice(0, 10), notes: "",
  });

  // Handover form state
  const [newHandover, setNewHandover] = React.useState({
    unitId: "", spkId: "", handoverType: "vendor_to_developer" as "vendor_to_developer" | "developer_to_customer",
    estimatedHandoverDate: "", calculationNote: "",
  });

  const handoverValidationError = React.useMemo(() => {
    if (!newHandover.unitId) return null;
    const selectedUnit = units.find(u => u.id === newHandover.unitId);
    if (!selectedUnit) return null;
    if (newHandover.handoverType === "vendor_to_developer") {
      const statusStr = selectedUnit.status as string;
      if (statusStr === "construction_done" || statusStr === "sold" || statusStr === "menunggu_serah_terima" || statusStr === "handover_complete") return "⚠️ BAST Vendor ke Developer untuk unit ini sudah selesai dilakukan. Silakan pilih BAST Developer ke Konsumen.";
      if (selectedUnit.constructionProgress < 100) return "⚠️ BAST Vendor ke Developer hanya dapat dikalkulasikan jika progres pembangunan unit sudah mencapai 100%.";
    } else if (newHandover.handoverType === "developer_to_customer") {
      const statusStr = selectedUnit.status as string;
      if (statusStr === "available" || statusStr === "belum_siap") return "⚠️ Unit belum terbooking oleh konsumen aktif.";
      if (statusStr === "construction") return "⚠️ Pembangunan unit fisik harus diserahterimakan oleh Vendor terlebih dahulu (Status unit harus 'Selesai Bangun').";
    }
    return null;
  }, [newHandover.unitId, newHandover.handoverType, units]);

  // Dynamic SPK components
  const currentSpkComponents = React.useMemo(() => {
    if (newProgress.spkId && spkWeights.length > 0) {
      return spkWeights.map(w => ({ id: w.workItemId, name: w.name, weightPct: w.weightPct, currentProgress: w.currentProgress }));
    }
    return workItems.map(item => ({ id: item.id, name: item.name, weightPct: item.defaultWeightPct, currentProgress: 0 }));
  }, [newProgress.spkId, spkWeights, workItems]);

  const selectedComponent = React.useMemo(() => currentSpkComponents.find(c => c.id === newProgress.workItemId), [currentSpkComponents, newProgress.workItemId]);
  const currentProgressPct = selectedComponent ? selectedComponent.currentProgress : 0;
  const componentWeightPct = selectedComponent ? selectedComponent.weightPct : 0;
  const newTotalProgress = Math.min(100, currentProgressPct + (newProgress.percentageAdded || 0));
  const isOverLimit = (currentProgressPct + (newProgress.percentageAdded || 0)) > 100;

  const handleLoadSpkWeights = React.useCallback(async (spkId: string) => {
    try {
      const details = await getSpkDetails(spkId);
      if (!details) return;
      setSpkLogs(details.logs || []);
      const items = details.weights.map(w => {
        const totalProgress = details.logs.filter(l => l.log.workItemId === w.weight.workItemId).reduce((sum, l) => sum + l.log.percentageAdded, 0);
        return { workItemId: w.workItem.id, name: w.workItem.name, weightPct: w.weight.weightPct, currentProgress: Math.min(100, totalProgress) };
      });
      setSpkWeights(items);
    } catch (e) { console.error("Gagal memuat detail SPK:", e); }
  }, []);

  // Handle external progress dialog trigger from SPK tab
  React.useEffect(() => {
    if (externalProgressSpkId) {
      setNewProgress(prev => ({ ...prev, spkId: externalProgressSpkId }));
      handleLoadSpkWeights(externalProgressSpkId);
      setProgressTab(externalProgressTab || "form");
      setProgressOpen(true);
      onExternalProgressHandled?.();
    }
  }, [externalProgressSpkId, externalProgressTab, handleLoadSpkWeights, onExternalProgressHandled]);

  const handleViewUnitProgress = async (unitId: string) => {
    setSelectedUnitId(unitId);
    const linkedSpk = spks.find(s => s.unitId === unitId && s.status !== "cancelled");
    setNewHandover(prev => ({ ...prev, unitId, spkId: linkedSpk?.id || "" }));
    try {
      try { const custBast = await getCustomerBastForUnit(unitId); setCustomerBast(custBast); } catch { setCustomerBast(null); }
      const estimations = await getHandoverEstimations(unitId);
      setHandoverEstimations(estimations.map(e => ({ id: e.estimation.id, estimatedHandoverDate: new Date(e.estimation.estimatedHandoverDate), calculationNote: e.estimation.calculationNote || null, createdAt: new Date(e.estimation.createdAt ?? Date.now()) })));
      if (linkedSpk) {
        try { const bast = await getBastAttachmentForSpk(linkedSpk.id); setActiveUnitBast(bast); } catch { setActiveUnitBast(null); }
        const details = await getSpkDetails(linkedSpk.id);
        if (details) {
          setSpkLogs(details.logs || []);
          setSpkWeights(details.weights.map(w => { const totalProgress = details.logs.filter(l => l.log.workItemId === w.weight.workItemId).reduce((sum, l) => sum + l.log.percentageAdded, 0); return { workItemId: w.workItem.id, name: w.workItem.name, weightPct: w.weight.weightPct, currentProgress: Math.min(100, totalProgress) }; }));
        } else { setSpkWeights([]); setSpkLogs([]); }
      } else { setSpkWeights([]); setSpkLogs([]); setActiveUnitBast(null); }
    } catch (err) { setErrorMessage(err instanceof Error ? err.message : "Gagal memuat detail unit."); setHandoverEstimations([]); setSpkWeights([]); }
  };

  const handleInputProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true); setErrorMessage(null);
    try {
      const photoAttachmentIds: string[] = [];
      if (selectedFiles.length > 0) {
        for (const fileToUpload of selectedFiles) {
          const formData = new FormData(); formData.append("file", fileToUpload);
          const uploadRes = await fetch("/api/upload-attachment", { method: "POST", body: formData });
          if (!uploadRes.ok) { const errData = await uploadRes.json(); throw new Error(errData.error || "Gagal mengunggah foto progress ke storage."); }
          const fileData = await uploadRes.json();
          const attachmentRes = await uploadProgressPhotoAttachment(newProgress.spkId, { fileName: fileToUpload.name, fileUrl: fileData.url, mimeType: fileToUpload.type, fileSize: fileToUpload.size });
          if (attachmentRes.success) photoAttachmentIds.push(attachmentRes.attachmentId);
        }
      }
      await inputProgress({
        spkId: newProgress.spkId, workItemId: newProgress.workItemId, percentageAdded: Number(newProgress.percentageAdded),
        progressDate: new Date(newProgress.progressDate), photoAttachmentId: photoAttachmentIds[0] || null,
        photoAttachmentIds: photoAttachmentIds.length > 0 ? photoAttachmentIds : null, notes: newProgress.notes || null,
      });
      setSuccessMessage(t("production.progress_saved"));
      setProgressOpen(false); setUploadedPhotos([]); setSelectedFiles([]);
      if (selectedUnitId === spks.find(s => s.id === newProgress.spkId)?.unitId) { handleViewUnitProgress(selectedUnitId!); }
      setNewProgress({ spkId: "", workItemId: "", percentageAdded: 10, progressDate: new Date().toISOString().slice(0, 10), notes: "" });
      router.refresh();
    } catch (e: any) { setErrorMessage(e.message || "Gagal menginput progress."); }
    finally { setIsSubmitting(false); }
  };

  const handleCreateHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true); setErrorMessage(null);
    try {
      await createHandoverEstimation({ unitId: newHandover.unitId, spkId: newHandover.spkId, handoverType: newHandover.handoverType, estimatedHandoverDate: new Date(newHandover.estimatedHandoverDate), calculationNote: newHandover.calculationNote || null });
      setSuccessMessage(t("production.handover_est_saved"));
      setHandoverOpen(false); setNewHandover({ unitId: "", spkId: "", handoverType: "vendor_to_developer", estimatedHandoverDate: "", calculationNote: "" });
      if (selectedUnitId === newHandover.unitId) handleViewUnitProgress(newHandover.unitId);
      router.refresh();
    } catch (e: any) { setErrorMessage(e.message || "Gagal menyimpan estimasi."); }
    finally { setIsSubmitting(false); }
  };

  const handleCompleteConstructionWithBast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bastUnit || !bastSpk || !bastPdfFile) { setErrorMessage("⚠️ Silakan pilih file PDF Berita Acara Serah Terima (BAST) terlebih dahulu."); return; }
    setIsSubmitting(true); setErrorMessage(null); setSuccessMessage(null);
    try {
      const formData = new FormData(); formData.append("file", bastPdfFile);
      const uploadRes = await fetch("/api/upload-attachment", { method: "POST", body: formData });
      if (!uploadRes.ok) { const errData = await uploadRes.json(); throw new Error(errData.error || "Gagal mengunggah PDF BAST ke storage."); }
      const fileData = await uploadRes.json();
      const attachmentRes = await uploadBastAttachment(bastSpk.id, { fileName: bastPdfFile.name, fileUrl: fileData.url, mimeType: bastPdfFile.type, fileSize: bastPdfFile.size });
      if (!attachmentRes.success) throw new Error("Gagal menyimpan metadata BAST ke database.");
      const res = await completeConstruction(bastUnit.id, attachmentRes.attachmentId);
      if (res.success) { setSuccessMessage(`Unit "${bastUnit.code}" berhasil dinyatakan selesai pembangunan dan status berubah menjadi Tersedia Siap Huni!`); setBastDialogOpen(false); setBastUnit(null); setBastSpk(null); setBastPdfFile(null); router.refresh(); }
    } catch (e: any) { setErrorMessage(e.message || "Gagal menyelesaikan pembangunan unit."); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="space-y-6">
      {errorMessage && <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium"><XCircle className="h-5 w-5 shrink-0" /><span>{errorMessage}</span></div>}
      {successMessage && <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary border border-primary/40 text-primary text-sm font-medium animate-fade-in"><CheckCircle2 className="h-5 w-5 shrink-0" /><span>{successMessage}</span></div>}

      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div><h3 className="text-lg font-bold text-foreground">{t("production.progress_title")}</h3><p className="text-xs text-muted-foreground">{t("production.progress_desc")}</p></div>
        <Button onClick={() => setHandoverOpen(true)} className="bg-primary hover:bg-primary text-primary-foreground font-semibold text-xs"><Calendar className="mr-1.5 h-3.5 w-3.5" />{t("production.btn_handover_calc")}</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Unit list */}
        <div className="space-y-4 lg:col-span-1 border-r border-border pr-0 lg:pr-6">
          <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5"><ClipboardList className="h-4 w-4 text-primary" />{t("production.construction_units_title")}</h4>
          <div className="space-y-2 max-h-[480px] overflow-y-auto">
            {units.filter(u => u.status === "construction" || u.status === "construction_done" || u.status === "overdue" || spks.some(s => s.unitId === u.id && s.status !== "cancelled")).map((u) => (
              <div key={u.id} onClick={() => handleViewUnitProgress(u.id)} className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex items-center justify-between gap-4 ${selectedUnitId === u.id ? "bg-secondary/20 border-primary shadow-[0_4px_20px_-2px_rgba(143,175,154,0.15)] ring-1 ring-primary/30" : "border-border bg-background hover:border-primary/30 hover:bg-[#8FAF9A]/5 hover:shadow-sm"}`}>
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-foreground tracking-tight">{u.code}</span>
                    <Badge className={`shadow-none font-semibold text-[10px] rounded-full px-2 py-0.5 ${u.status === "construction_done" || (u.status === "available" && u.constructionProgress === 100) ? "bg-secondary text-primary border border-primary/30" : u.status === "overdue" ? "bg-rose-50 text-rose-700 border border-rose-200" : u.status === "sold" ? "bg-red-50 text-red-700 border border-red-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
                      {u.status === "construction_done" || (u.status === "available" && u.constructionProgress === 100) ? t("production.status_done") : u.status === "sold" ? "Terjual" : u.status === "overdue" ? t("production.status_overdue") : t("production.status_construction")}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1"><HardHat className="h-3 w-3 text-muted-foreground/60" /><span>{t("production.field_weight")}</span></div>
                </div>
                <div className="relative flex items-center justify-center h-12 w-12 flex-shrink-0">
                  <svg className="w-full h-full transform -rotate-90"><circle cx="24" cy="24" r="18" className="stroke-muted" strokeWidth="3.5" fill="transparent" /><circle cx="24" cy="24" r="18" className="stroke-primary transition-all duration-500 ease-out" strokeWidth="3.5" fill="transparent" strokeDasharray={2 * Math.PI * 18} strokeDashoffset={2 * Math.PI * 18 * (1 - u.constructionProgress / 100)} strokeLinecap="round" /></svg>
                  <div className="absolute inset-0 flex items-center justify-center text-[10px] font-extrabold text-foreground tabular-nums">{u.constructionProgress}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Unit detail panel */}
        <div className="lg:col-span-2 space-y-6">
          {selectedUnitId ? (() => {
            const unit = units.find(u => u.id === selectedUnitId);
            if (!unit) return null;
            const spk = spks.find(s => s.unitId === unit.id && s.status !== "cancelled");
            return (
              <div className="space-y-6 animate-fade-in">
                <div className="pb-4 border-b border-border flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold text-foreground">{t("production.unit_detail_title")}: {unit.code}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("production.unit_linked_spk")}: {spk ? `${spk.spkNumber} (${spk.title})` : t("production.unit_no_spk")}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {unit.readyStockSource === "construction_flow" && <span className="bg-[#EAF2EC] text-primary border border-primary/30 text-[10px] font-extrabold px-2 py-0.5 rounded-lg">🏗️ Konstruksi ERP</span>}
                      {unit.readyStockSource === "legacy_ready_stock" && <span className="bg-[#F4F6F0] text-[#606C5A] border border-primary/20 text-[10px] font-extrabold px-2 py-0.5 rounded-lg">🏠 Existing Siap Huni</span>}
                      {unit.readyStockSource === "manual_ready_stock" && <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-extrabold px-2 py-0.5 rounded-lg">⚙️ Manual Ready</span>}
                      {unit.isReadyStock ? <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold px-2 py-0.5 rounded-lg">✓ Siap Huni</span> : <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-extrabold px-2 py-0.5 rounded-lg">Indent</span>}
                    </div>
                  </div>
                  {((unit.status === "construction_done") || ((unit.status === "construction" || unit.status === "overdue") && unit.constructionProgress === 100)) && (
                    <Button size="sm" disabled={isSubmitting} onClick={() => { setBastUnit(unit); setBastSpk(spk); setBastPdfFile(null); setBastDialogOpen(true); }} className="bg-primary hover:bg-primary/90 text-white font-extrabold text-xs h-9 rounded-xl flex items-center gap-1.5 shadow-[0_4px_12px_rgba(79,111,82,0.25)] transition-all"><CheckCircle2 className="h-4 w-4 text-white" />Selesai Pembangunan</Button>
                  )}
                </div>

                {/* BAST Vendor section */}
                <div className="space-y-2">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground px-1">{unit.readyStockSource === "construction_flow" ? "BAST Vendor ke Developer (Wajib)" : "BAST Vendor ke Developer (Opsional / Arsip)"}</p>
                  {activeUnitBast ? (
                    <div className="p-3.5 bg-primary/5 border border-[#4F6F52]/10 rounded-2xl flex items-center justify-between text-xs transition-all hover:bg-primary/10">
                      <div className="flex items-center gap-2.5 min-w-0"><div className="p-2 bg-primary/10 text-primary rounded-xl shrink-0"><UploadCloud className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="font-extrabold text-foreground text-xs truncate">Dokumen Terunggah</p><p className="text-[10px] text-muted-foreground font-mono truncate max-w-[280px] mt-0.5">{activeUnitBast.fileName}</p></div></div>
                      <a href={activeUnitBast.fileUrl} target="_blank" rel="noopener noreferrer" className="bg-primary hover:bg-primary/90 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-sm transition-all hover:scale-[1.02] flex items-center gap-1.5 shrink-0 ml-2"><ExternalLink className="h-3.5 w-3.5 text-white" />Lihat PDF</a>
                    </div>
                  ) : (unit.readyStockSource === "legacy_ready_stock" || unit.readyStockSource === "manual_ready_stock") && (
                    <div className="p-3.5 bg-gray-50/50 border border-gray-200/80 rounded-2xl flex items-center justify-between text-xs"><div className="flex items-center gap-2"><div className="p-1.5 bg-gray-100 text-gray-400 rounded-lg"><FileText className="h-4 w-4" /></div><div><p className="font-bold text-muted-foreground text-xs">Arsip BAST Vendor Kosong</p><p className="text-[9px] text-muted-foreground mt-0.5">Tidak wajib untuk unit ready stock legacy.</p></div></div></div>
                  )}
                </div>

                {/* BAST Konsumen panel - simplified */}
                <div className="bg-card border border-border rounded-2xl p-5 shadow-[0_4px_20px_rgba(143,175,154,0.08)] space-y-4">
                  <div className="flex items-center justify-between"><h4 className="font-extrabold text-sm text-foreground flex items-center gap-2"><FileText className="h-4 w-4 text-primary" />BAST Konsumen (Developer ke Konsumen)</h4>{customerBast && customerBast.customerName && <span className="bg-[#EAF2EC] text-primary border border-primary/30 text-[9px] font-extrabold px-2 py-0.5 rounded-lg">Terhubung KPR</span>}</div>
                  {(() => {
                    if (!customerBast || !customerBast.bookingId) return <div className="text-center py-5 border border-dashed border-border rounded-xl bg-muted/30/40"><AlertTriangle className="h-6 w-6 text-amber-500 mx-auto mb-2 animate-pulse" /><p className="text-xs font-bold text-foreground">Unit Belum Terjual / Booking Tidak Aktif</p><p className="text-[10px] text-muted-foreground mt-1 px-4 leading-relaxed">Unggah BAST Konsumen dinonaktifkan karena unit belum memiliki booking/penjualan yang aktif.</p></div>;
                    const isEligibleForHandover = unit.status === "sold" || unit.status === "menunggu_serah_terima" || unit.status === "handover_complete" || unit.constructionProgress === 100;
                    if (!isEligibleForHandover) return <div className="p-4 border border-rose-100 rounded-xl bg-rose-50/50 space-y-2"><div className="flex gap-2"><AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" /><div><p className="text-xs font-bold text-rose-800">Belum Siap Serah Terima</p><p className="text-[10px] text-rose-600 mt-0.5 leading-relaxed">Pembangunan unit kavling ini masih berjalan (Progres: {unit.constructionProgress}%).</p></div></div><div className="text-[10px] text-muted-foreground pl-6 border-t border-rose-100/50 pt-2 font-mono space-y-0.5"><p>Konsumen: <span className="font-bold">{customerBast.customerName}</span></p><p>No. Booking: <span className="font-bold">{customerBast.bookingNumber}</span></p></div></div>;
                    const docStatus = customerBast.docStatus;
                    return (
                      <div className="space-y-3">
                        <div className="p-3 bg-muted/30/60 border border-border rounded-xl text-xs space-y-1.5 font-sans">
                          <div className="grid grid-cols-3 gap-1"><span className="text-muted-foreground">Konsumen:</span><span className="col-span-2 font-extrabold text-foreground">{customerBast.customerName}</span><span className="text-muted-foreground">No. Booking:</span><span className="col-span-2 font-mono font-bold text-primary">{customerBast.bookingNumber}</span></div>
                        </div>
                        {!customerBast.fileName ? (
                          <div className="text-center py-4 border border-dashed border-primary/40 rounded-xl bg-card space-y-2">
                            <UploadCloud className="h-6 w-6 text-primary/70 mx-auto animate-bounce" /><p className="text-xs font-bold text-foreground">Unggah PDF BAST Konsumen</p>
                            <div className="px-6 pt-2"><input type="file" id="customer-bast-file" accept="application/pdf" className="hidden" onChange={async (ev) => { const file = ev.target.files?.[0]; if (!file) return; setIsSubmitting(true); setErrorMessage(null); setSuccessMessage(null); try { const fd = new FormData(); fd.append("file", file); const uRes = await fetch("/api/upload-attachment", { method: "POST", body: fd }); if (!uRes.ok) throw new Error("Gagal mengunggah berkas BAST."); const fData = await uRes.json(); const res = await uploadCustomerBastFromProduction(unit.id, customerBast.bookingId, customerBast.customerId, { fileName: file.name, fileUrl: fData.url, mimeType: file.type, fileSize: file.size }); if (res.success) { setSuccessMessage("✓ Berkas BAST Konsumen berhasil diunggah dan disinkronkan ke KPR!"); await handleViewUnitProgress(unit.id); } } catch (err: any) { setErrorMessage(err.message || "Gagal mengunggah BAST."); } finally { setIsSubmitting(false); } }} /><label htmlFor="customer-bast-file" className="inline-flex items-center justify-center bg-primary hover:bg-primary/90 text-white font-extrabold text-xs px-4 py-2 rounded-xl shadow-md cursor-pointer transition-all active:scale-95 hover:scale-[1.02] gap-1.5"><UploadCloud className="h-4 w-4" />Pilih Berkas PDF BAST</label></div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className={`p-3 border rounded-xl flex items-center justify-between text-xs ${docStatus === "verified" ? "bg-emerald-50/50 border-emerald-200" : docStatus === "rejected" ? "bg-rose-50/50 border-rose-200" : "bg-muted/30 border-border"}`}>
                              <div className="flex items-center gap-2.5 min-w-0"><div className={`p-2 rounded-xl shrink-0 ${docStatus === "verified" ? "bg-emerald-100 text-emerald-800" : docStatus === "rejected" ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"}`}><FileText className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="font-extrabold text-foreground truncate text-xs">BAST Konsumen Terunggah</p><p className="text-[10px] text-muted-foreground font-mono truncate max-w-[160px] mt-0.5">{customerBast.fileName}</p></div></div>
                              <div className="flex flex-col gap-1.5 shrink-0 ml-2"><a href={customerBast.fileUrl} target="_blank" rel="noopener noreferrer" className="bg-primary hover:bg-primary/90 text-white font-extrabold text-[10px] px-2.5 py-1.5 rounded-lg shadow-sm transition-all text-center flex items-center justify-center gap-1 hover:scale-[1.02]"><ExternalLink className="h-3 w-3 text-white" />Unduh</a>
                                {canManageBast && docStatus !== "verified" && customerBast.docId && <button type="button" title="Hapus dokumen BAST Konsumen" className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[10px] px-2.5 py-1.5 rounded-lg shadow-sm transition-all text-center flex items-center justify-center gap-1 hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed" disabled={isSubmitting} onClick={async () => { const confirmed = window.confirm("Apakah Anda yakin ingin menghapus dokumen BAST Konsumen ini?\n\nTindakan ini tidak dapat dibatalkan."); if (!confirmed) return; setIsSubmitting(true); setErrorMessage(null); setSuccessMessage(null); try { const res = await deleteCustomerBastDocument(customerBast.docId); if (res.success) { setSuccessMessage("✓ Dokumen BAST Konsumen berhasil dihapus."); await handleViewUnitProgress(unit.id); } } catch (err: any) { setErrorMessage(err.message || "Gagal menghapus dokumen BAST."); } finally { setIsSubmitting(false); } }}><Trash2 className="h-3 w-3" />Hapus</button>}
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="pt-1.5 flex gap-2"><a href={`/marketing/bookings/${customerBast.bookingId}/bast/print`} target="_blank" rel="noopener noreferrer" className="w-full inline-flex items-center justify-center bg-card border border-border text-primary hover:bg-muted/30/50 font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-sm transition-all gap-1.5"><FileText className="h-4 w-4" />Cetak Berita Acara BAST</a></div>
                      </div>
                    );
                  })()}
                </div>

                {/* Work parts & Handover estimations */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4"><h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5"><Wrench className="h-4 w-4 text-primary" />{t("production.spk_component_title")}</h4>
                    <div className="space-y-4 bg-[#8FAF9A]/5 p-4 rounded-xl border border-primary/20">{spkWeights.length === 0 ? <div className="text-center py-4 text-xs text-muted-foreground border border-dashed border-primary/30 rounded-lg">{t("production.component_empty")}</div> : spkWeights.map((w) => <div key={w.workItemId} className="space-y-1"><div className="flex justify-between text-xs font-semibold text-foreground"><span>{w.name} <span className="text-muted-foreground font-normal">({t("production.weight_lbl")} {w.weightPct}%)</span></span><span className="text-primary font-bold">{w.currentProgress}%</span></div><Progress value={w.currentProgress} className="h-2 bg-muted" /></div>)}</div>
                  </div>
                  <div className="space-y-4"><h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5"><Calendar className="h-4 w-4 text-primary" />{t("production.handover_est_title")}</h4>
                    <div className="space-y-3">{handoverEstimations.length === 0 ? <div className="text-center py-6 border border-dashed border-primary/30 rounded-lg text-xs text-muted-foreground">{t("production.handover_empty")}</div> : handoverEstimations.map((est) => <div key={est.id} className="bg-background p-4 rounded-xl border border-primary/30 shadow-sm space-y-3"><div className="flex items-center justify-between text-xs font-semibold"><span className="text-muted-foreground flex items-center gap-1">{t("production.handover_target_lbl")}:</span><Badge className="bg-secondary text-primary hover:bg-secondary font-bold shadow-none">{new Date(est.estimatedHandoverDate).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' })}</Badge></div>{activeUnitBast ? <div className="flex items-center gap-1.5 text-[10px] font-black text-primary bg-secondary/50 px-2.5 py-1 rounded-lg border border-primary/30 w-fit"><CheckCircle2 className="h-3 w-3 text-primary" />Sudah Selesai Serah Terima (BAST Aktif)</div> : <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/50 w-fit"><Clock className="h-3 w-3 text-amber-600 animate-pulse" />Dalam Proses / Estimasi Konstruksi</div>}<div className="p-2.5 rounded bg-[#8FAF9A]/5 border border-primary/50/10 text-xs text-foreground italic leading-relaxed">&ldquo;{est.calculationNote}&rdquo;</div><div className="text-[10px] text-muted-foreground text-right font-medium">{t("production.handover_calc_date")} {new Date(est.createdAt).toLocaleDateString()}</div></div>)}</div>
                  </div>
                </div>

                {/* Photo Gallery */}
                <div className="pt-6 border-t border-border space-y-3 mt-6">
                  <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5"><Camera className="h-4 w-4 text-primary" />Galeri Bukti Foto Fisik Lapangan</h4>
                  {(() => {
                    const photos = spkLogs.filter(l => l.attachment && l.attachment.fileUrl).map(l => ({ workItemName: l.workItem.name, progressDate: l.log.progressDate, notes: l.log.notes, fileUrl: l.attachment!.fileUrl, fileName: l.attachment!.fileName }));
                    if (photos.length === 0) return <div className="flex flex-col items-center justify-center py-6 text-muted-foreground gap-1.5 border border-dashed border-primary/30 rounded-xl bg-[#8FAF9A]/5"><Camera className="h-8 w-8 opacity-30 text-primary" /><span className="text-xs font-bold">Belum Ada Galeri Foto Konstruksi</span></div>;
                    return <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">{photos.map((photo, idx) => <a key={idx} href={photo.fileUrl} target="_blank" rel="noopener noreferrer" className="group/photo relative aspect-square bg-muted/30 border border-primary/20 rounded-xl overflow-hidden flex flex-col items-center justify-center transition-all hover:shadow-md hover:border-[#4F6F52]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.fileUrl} alt={photo.workItemName} className="absolute inset-0 w-full h-full object-cover group-hover/photo:scale-105 transition-transform duration-300" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} /><div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" /><div className="absolute bottom-0 left-0 right-0 p-2"><span className="text-[9px] font-black text-white block leading-tight truncate">{photo.workItemName}</span><span className="text-[8px] font-mono text-white/90 block mt-0.5">{new Date(photo.progressDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' })}</span></div></a>)}</div>;
                  })()}
                </div>
              </div>
            );
          })() : (
            <div className="h-64 border border-dashed border-primary/30 rounded-xl flex flex-col items-center justify-center text-center p-6 text-muted-foreground"><Layers className="h-10 w-10 text-primary/30 mb-2 animate-bounce" /><h4 className="font-bold text-foreground text-sm">{t("production.select_unit_cta")}</h4><p className="text-xs max-w-xs mt-1">{t("production.select_unit_desc")}</p></div>
          )}
        </div>
      </div>

      {/* Progress Input Dialog */}
      <Dialog open={progressOpen} onOpenChange={(open) => { setProgressOpen(open); if (!open) { setUploadedPhotos([]); setSelectedFiles([]); } }}>
        <DialogContent className="sm:max-w-xl rounded-3xl bg-white/98 backdrop-blur-md border border-border shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden font-sans">
          <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-border">
            <DialogHeader><DialogTitle className="text-primary font-bold text-lg flex items-center gap-2"><HardHat className="h-5 w-5" />{t("production.progress_form_title")}</DialogTitle><DialogDescription className="text-xs">{t("production.progress_form_desc")}</DialogDescription></DialogHeader>
          </div>
          <Tabs value={progressTab} onValueChange={setProgressTab} className="w-full">
            <div className="px-6 pt-3 border-b border-border bg-muted/30/50"><TabsList className="grid grid-cols-2 w-full h-9 bg-muted/60 p-0.5 rounded-lg border border-border"><TabsTrigger value="form" className="text-xs font-semibold rounded-md py-1.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm">{t("production.btn_input_progress") || "Catat Progress"}</TabsTrigger><TabsTrigger value="history" className="text-xs font-semibold rounded-md py-1.5 data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm">Riwayat & Galeri Foto</TabsTrigger></TabsList></div>
            <TabsContent value="form" className="m-0 focus-visible:outline-none">
              {(() => { const currentSpk = spks.find(s => s.id === newProgress.spkId); if (!currentSpk) return null; return <div className="mx-6 mt-4 p-4 bg-gradient-to-r from-[#DDE8D8]/60 via-white/80 to-[#DDE8D8]/30 border border-border rounded-2xl flex items-center justify-between text-xs shadow-sm animate-scale-in"><div className="space-y-1"><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Nomor SPK Kerja</p><p className="font-mono font-bold text-primary text-sm">{currentSpk.spkNumber}</p><p className="text-[10px] text-muted-foreground font-medium">Vendor: {currentSpk.vendorName || "Kontraktor Utama"}</p></div><div className="text-right space-y-1"><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Unit / Kavling</p><p className="font-black text-foreground text-sm">{currentSpk.projectName} &bull; Kav. {currentSpk.unitCode}</p><p className="text-[10px] text-muted-foreground font-medium">Status SPK: <span className="capitalize font-bold text-amber-600">{getSpkStatusLabel(currentSpk.status)}</span></p></div></div>; })()}
              <form onSubmit={handleInputProgress} className="p-6 space-y-5 pt-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-4 text-sm">
                  <div className="space-y-1.5"><label className="font-bold text-foreground text-xs flex items-center gap-1.5"><ClipboardList className="h-4 w-4 text-primary/70" />{t("production.progress_lbl_component") || "Komponen Item Pekerjaan"}</label>
                    <Select value={newProgress.workItemId} onValueChange={(val: string | null) => setNewProgress(prev => ({ ...prev, workItemId: val || "" }))} required items={currentSpkComponents.map(item => ({ label: `${item.name} — Bobot ${item.weightPct}% (Progres: ${item.currentProgress}%)`, value: item.id }))}>
                      <SelectTrigger className="w-full h-11 border-border focus-visible:ring-2 focus-visible:ring-ring rounded-xl bg-white/80 backdrop-blur-sm text-xs font-semibold"><SelectValue placeholder={t("production.progress_lbl_component") || "Pilih komponen pekerjaan..."}>{newProgress.workItemId ? (() => { const item = currentSpkComponents.find(w => w.id === newProgress.workItemId); return item ? `${item.name} — Bobot ${item.weightPct}% (Progres: ${item.currentProgress}%)` : undefined; })() : undefined}</SelectValue></SelectTrigger>
                      <SelectContent className="border-border rounded-xl bg-popover backdrop-blur-md">{currentSpkComponents.map(item => <SelectItem key={item.id} value={item.id} className="text-xs font-semibold">{item.name} &mdash; Bobot {item.weightPct}% (Progres: {item.currentProgress}%)</SelectItem>)}</SelectContent>
                    </Select>
                  </div>

                  {newProgress.workItemId && <div className="p-4 bg-gradient-to-br from-[#8FAF9A]/5 via-white/40 to-[#8FAF9A]/10 border border-primary/20 rounded-2xl space-y-3 text-xs shadow-sm animate-scale-in"><div className="flex justify-between items-center font-bold text-foreground"><span className="text-muted-foreground font-bold">Status Kemajuan Fisik:</span><span className={`font-black text-xs px-2.5 py-0.5 rounded-full ${isOverLimit ? "bg-rose-50 text-rose-600 border border-rose-200 animate-pulse" : "bg-secondary text-primary border border-primary/50/25"}`}>{isOverLimit ? `⚠️ Melebihi Batas! (${currentProgressPct}% + ${newProgress.percentageAdded}% = ${currentProgressPct + newProgress.percentageAdded}%)` : `${currentProgressPct}% → ${newTotalProgress}%`}</span></div><div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden flex border border-border/40 shadow-inner"><div className="h-full bg-gradient-to-r from-[#4F6F52] to-[#608764] transition-all duration-500 rounded-l-full" style={{ width: `${currentProgressPct}%` }} /><div className={`h-full transition-all duration-500 ${isOverLimit ? "bg-red-400 animate-pulse" : "bg-gradient-to-r from-[#8FAF9A] to-[#A3C1AD]"} ${currentProgressPct === 0 ? "rounded-l-full" : ""}`} style={{ width: `${isOverLimit ? 100 - currentProgressPct : newProgress.percentageAdded}%` }} /></div></div>}

                  {currentProgressPct === 100 ? <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-xs text-emerald-800 shadow-sm animate-scale-in"><CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" /><div className="space-y-1"><p className="font-bold">Item Pekerjaan Selesai (100%)</p><p className="text-emerald-700/90 font-medium">Komponen pekerjaan ini telah mencapai progress fisik 100%.</p></div></div> : (
                    <div className="space-y-4">
                      <div className="p-4 bg-white/80 backdrop-blur-sm border border-border rounded-2xl shadow-sm space-y-3.5">
                        <div className="flex items-center justify-between text-xs font-bold text-foreground"><span className="flex items-center gap-1.5"><TrendingUp className="h-4 w-4 text-primary/70" />{t("production.progress_lbl_pct") || "Tambahan Kemajuan Fisik"}</span><div className="flex items-baseline gap-1.5">{newProgress.workItemId && componentWeightPct > 0 && <span className="text-[10px] text-muted-foreground font-semibold">(Dampak Unit: +{((newProgress.percentageAdded || 0) * componentWeightPct / 100).toFixed(1)}%)</span>}<span className="text-primary font-black text-base tracking-tight">+{newProgress.percentageAdded}%</span></div></div>
                        <Slider min={1} max={Math.max(1, 100 - currentProgressPct)} step={1} value={[newProgress.percentageAdded]} onValueChange={(val: number[]) => setNewProgress(prev => ({ ...prev, percentageAdded: val[0] }))} className="py-2 cursor-pointer" />
                        <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                          <div className="flex gap-1.5">{[10, 25, 50].map((preset) => { const disabled = preset > (100 - currentProgressPct); return <Button key={preset} type="button" variant="outline" disabled={disabled} className={`text-[10px] font-bold px-3 py-1 h-7 rounded-full transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:pointer-events-none ${newProgress.percentageAdded === preset ? "bg-primary text-white border-[#4F6F52] shadow-sm" : "border-border text-primary hover:bg-[#8FAF9A]/10 hover:border-primary/40 bg-card"}`} onClick={() => setNewProgress(prev => ({ ...prev, percentageAdded: preset }))}>+{preset}%</Button>; })}<Button type="button" variant="outline" className={`text-[10px] font-black px-3.5 py-1 h-7 rounded-full ${newProgress.percentageAdded === Math.max(1, 100 - currentProgressPct) ? "bg-primary text-white border-[#4F6F52] shadow-sm" : "border-[#4F6F52]/50 text-primary hover:bg-primary/10 bg-card"}`} onClick={() => setNewProgress(prev => ({ ...prev, percentageAdded: Math.max(1, 100 - currentProgressPct) }))}>Set 100%</Button></div>
                        </div>
                      </div>
                      <div className="space-y-1.5"><label className="font-bold text-foreground text-xs flex items-center gap-1.5"><Calendar className="h-4 w-4 text-primary/70" />{t("production.progress_lbl_date") || "Tanggal Laporan Lapangan"}</label><Input type="date" required className="border-border focus-visible:ring-2 focus-visible:ring-ring/20 h-10 text-xs rounded-xl bg-white/80 font-medium" value={newProgress.progressDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewProgress(prev => ({ ...prev, progressDate: e.target.value }))} /></div>
                      <div className="space-y-1.5"><label className="font-bold text-foreground text-xs flex items-center gap-1.5"><Camera className="h-4 w-4 text-primary/70" />Foto Dokumentasi</label>
                        <div onClick={() => document.getElementById('progress-photo-upload-tab')?.click()} className="border-2 border-dashed border-primary/40 hover:border-[#4F6F52]/60 bg-muted/30/40 hover:bg-[#8FAF9A]/5 rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 group"><input id="progress-photo-upload-tab" type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) { const filesArray = Array.from(e.target.files); setSelectedFiles(prev => [...prev, ...filesArray]); setUploadedPhotos(prev => [...prev, ...filesArray.map(file => URL.createObjectURL(file))]); } }} /><div className="flex flex-col items-center justify-center space-y-2"><div className="p-2.5 bg-card rounded-full shadow-md text-primary group-hover:scale-110 transition-transform duration-300 border border-border"><Plus className="h-4 w-4" /></div><span className="text-xs font-bold text-foreground">Klik atau seret foto ke sini</span><span className="text-[10px] text-slate-500 font-medium">Maks 4 foto, JPG/PNG/WebP, max 5MB</span></div></div>
                        {uploadedPhotos.length > 0 && <div className="grid grid-cols-4 gap-3.5 pt-2">{uploadedPhotos.map((photo, index) => <div key={index} className="relative group aspect-square rounded-xl overflow-hidden border border-primary/30 shadow-sm animate-scale-in"><Image src={photo} alt={`Preview ${index}`} fill className="object-cover" /><button type="button" onClick={(ev) => { ev.stopPropagation(); setSelectedFiles(prev => prev.filter((_, i) => i !== index)); setUploadedPhotos(prev => prev.filter((_, i) => i !== index)); }} className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-rose-600 rounded-full text-white transition-all duration-200 hover:scale-110 shadow-sm"><XCircle className="h-4 w-4" /></button></div>)}</div>}
                      </div>
                      <div className="space-y-1.5"><label className="font-bold text-foreground text-xs flex items-center gap-1.5"><MessageSquare className="h-4 w-4 text-primary/70" />Catatan Lapangan (Opsional)</label><Textarea placeholder="Contoh: Pemasangan plafon gypsum tuntas 100%..." className="border-border focus-visible:ring-2 focus-visible:ring-ring/20 text-xs rounded-xl min-h-[80px] bg-white/80" value={newProgress.notes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewProgress(prev => ({ ...prev, notes: e.target.value }))} /></div>
                    </div>
                  )}
                </div>
                <DialogFooter className="pt-3 border-t border-border/40 mt-4"><Button type="button" variant="ghost" onClick={() => setProgressOpen(false)} className="text-xs text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-50 h-10 px-4 font-bold">{t("production.btn_cancel") || "Batal"}</Button><Button type="submit" disabled={isSubmitting || isOverLimit || !newProgress.workItemId} className="bg-primary hover:bg-primary/90 text-white font-bold text-xs rounded-xl shadow-[0_4px_12px_rgba(79,111,82,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all h-10 px-5 flex items-center gap-1.5">{isSubmitting ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Menyimpan...</> : (t("production.btn_save_progress") || "Simpan Progres")}</Button></DialogFooter>
              </form>
            </TabsContent>

            <TabsContent value="history" className="m-0 focus-visible:outline-none p-6 pt-4 max-h-[60vh] overflow-y-auto space-y-4">
              <div className="space-y-1"><h4 className="text-sm font-bold text-foreground">Dokumentasi Log Progres</h4><p className="text-xs text-muted-foreground">Riwayat progres pembangunan dan unggahan foto lapangan untuk unit ini.</p></div>
              {spkLogs && spkLogs.length > 0 ? (() => {
                const currentSpk = spks.find(s => s.id === newProgress.spkId);
                const filteredLogs = newProgress.workItemId ? spkLogs.filter(l => l.log.workItemId === newProgress.workItemId) : spkLogs;
                if (filteredLogs.length === 0) return <div className="text-center py-10 border border-dashed border-primary/30 rounded-2xl text-xs text-muted-foreground">Belum ada riwayat progres untuk komponen yang dipilih.</div>;
                return <div className="space-y-3 pt-1">{filteredLogs.map((item: any) => <div key={item.log.id} className="p-3.5 bg-[#8FAF9A]/5 border border-primary/20 rounded-xl space-y-2 text-xs"><div className="flex justify-between items-center font-bold text-foreground"><span className="text-primary">{item.workItem?.name || "Komponen Pekerjaan"}</span><div className="flex items-center gap-2"><Badge className="bg-secondary text-primary font-semibold border border-primary/50/25 rounded-md hover:bg-secondary">+{item.log.percentageAdded}% &rarr; {item.log.currentTotalPct}%</Badge>{currentSpk && (currentSpk.status === "active" || currentSpk.status === "proses_konstruksi" || currentSpk.status === "overdue") && <button type="button" title="Hapus log progres" onClick={async () => { const confirmed = window.confirm(`Hapus log +${item.log.percentageAdded}% untuk "${item.workItem?.name}"?`); if (!confirmed) return; setIsSubmitting(true); try { const res = await deleteProgressLog(item.log.id); if (res.success) { setSuccessMessage("✓ Log progres berhasil dihapus."); if (currentSpk.unitId) await handleViewUnitProgress(currentSpk.unitId); } } catch (err: any) { setErrorMessage(err.message || "Gagal menghapus log."); } finally { setIsSubmitting(false); } }} disabled={isSubmitting} className="p-1 text-slate-400 hover:text-rose-600 transition-colors rounded-lg hover:bg-slate-100 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>}</div></div><div className="text-muted-foreground leading-relaxed">{item.log.notes ? `"${item.log.notes}"` : <span className="italic">Tidak ada catatan.</span>}</div>{((item.attachments && item.attachments.length > 0) || (item.attachment && item.attachment.fileUrl)) && <div className="pt-1.5"><span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">Bukti Foto</span><div className="flex flex-wrap gap-2">{item.attachments && item.attachments.length > 0 ? item.attachments.map((att: any, idx: number) => <div key={att.id || idx} className="relative h-24 w-36 rounded-lg overflow-hidden border border-primary/30 group shadow-sm bg-card cursor-zoom-in"><a href={att.fileUrl} target="_blank" rel="noopener noreferrer"><Image src={att.fileUrl} alt={`Bukti ${idx + 1}`} fill className="object-cover group-hover:scale-105 transition-transform duration-200" /></a></div>) : <div className="relative h-24 w-36 rounded-lg overflow-hidden border border-primary/30 group shadow-sm bg-card cursor-zoom-in"><a href={item.attachment.fileUrl} target="_blank" rel="noopener noreferrer"><Image src={item.attachment.fileUrl} alt="Bukti Progress" fill className="object-cover group-hover:scale-105 transition-transform duration-200" /></a></div>}</div></div>}<div className="text-[10px] text-muted-foreground pt-1 text-right font-medium">Dicatat: {new Date(item.log.progressDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</div></div>)}</div>;
              })() : <div className="text-center py-10 border border-dashed border-primary/30 rounded-2xl text-xs text-muted-foreground">Belum ada log progres pembangunan untuk SPK ini.</div>}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Handover Dialog */}
      <Dialog open={handoverOpen} onOpenChange={setHandoverOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl bg-white/98 backdrop-blur-md border border-border shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden font-sans">
          <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-border"><DialogHeader><DialogTitle className="text-primary font-bold text-lg flex items-center gap-2"><Calendar className="h-5 w-5" />{t("production.handover_form_title")}</DialogTitle><DialogDescription className="text-xs">{t("production.handover_form_desc")}</DialogDescription></DialogHeader></div>
          <form onSubmit={handleCreateHandover} className="p-6 space-y-4 pt-4 max-h-[75vh] overflow-y-auto">
            <div className="space-y-3 text-sm">
              <div className="space-y-1"><label className="font-semibold text-foreground text-xs">{t("production.handover_lbl_unit")}</label>
                <Select value={newHandover.unitId} onValueChange={(val: string | null) => { const cleanVal = val || ""; const linkedSpk = spks.find(s => s.unitId === cleanVal && s.status !== "cancelled"); setNewHandover(prev => ({ ...prev, unitId: cleanVal, spkId: linkedSpk?.id || "" })); }} required items={units.map(u => ({ label: `${u.code} — Progres ${u.constructionProgress}%`, value: u.id }))}>
                  <SelectTrigger className="w-full h-10 px-3 rounded-xl border border-primary/30 focus:ring-primary bg-card text-xs"><SelectValue placeholder={t("production.handover_lbl_unit")}>{newHandover.unitId ? (() => { const u = units.find(unit => unit.id === newHandover.unitId); return u ? `${u.code} — Progres ${u.constructionProgress}%` : undefined; })() : undefined}</SelectValue></SelectTrigger>
                  <SelectContent>{units.filter(u => u.status === "construction" || u.status === "construction_done" || u.status === "sold" || u.status === "menunggu_serah_terima" || u.status === "handover_complete" || u.id === newHandover.unitId).map(u => <SelectItem key={u.id} value={u.id}>{u.code} &mdash; Progres {u.constructionProgress}%</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><label className="font-semibold text-foreground text-xs">Tipe Estimasi Serah Terima (BAST)</label>
                <Select value={newHandover.handoverType} onValueChange={(val: "vendor_to_developer" | "developer_to_customer" | null) => setNewHandover(prev => ({ ...prev, handoverType: val || "vendor_to_developer" }))} required items={[{ label: "BAST Vendor ke Developer (Fisik 100%)", value: "vendor_to_developer" }, { label: "BAST Developer ke Konsumen (Serah Kunci)", value: "developer_to_customer" }]}>
                  <SelectTrigger className="w-full h-10 px-3 rounded-xl border border-primary/30 focus:ring-primary bg-card text-xs"><SelectValue placeholder="Pilih Tipe Serah Terima">{newHandover.handoverType === "vendor_to_developer" ? "BAST Vendor ke Developer (Fisik 100%)" : "BAST Developer ke Konsumen (Serah Kunci)"}</SelectValue></SelectTrigger>
                  <SelectContent><SelectItem value="vendor_to_developer">BAST Vendor ke Developer (Fisik 100%)</SelectItem><SelectItem value="developer_to_customer">BAST Developer ke Konsumen (Serah Kunci)</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><label className="font-semibold text-foreground text-xs">{t("production.handover_lbl_date")}</label><Input type="date" required className="border-primary/30 focus-visible:ring-primary text-xs" value={newHandover.estimatedHandoverDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewHandover(prev => ({ ...prev, estimatedHandoverDate: e.target.value }))} /></div>
              <div className="space-y-1"><label className="font-semibold text-foreground text-xs">{t("production.handover_lbl_notes")}</label><Textarea required placeholder={t("production.handover_notes_ph")} className="border-primary/30 focus-visible:ring-primary text-xs" value={newHandover.calculationNote} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewHandover(prev => ({ ...prev, calculationNote: e.target.value }))} /></div>
              {handoverValidationError && <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-2xl text-xs flex items-start gap-2.5 animate-in fade-in duration-300"><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /><span>{handoverValidationError}</span></div>}
            </div>
            <DialogFooter className="pt-2"><Button type="button" variant="ghost" onClick={() => setHandoverOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">{t("production.btn_cancel")}</Button><Button type="submit" disabled={isSubmitting || !!handoverValidationError} className="bg-primary hover:bg-primary text-primary-foreground font-semibold text-xs">{t("production.btn_save_handover")}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* BAST Upload Dialog */}
      <Dialog open={bastDialogOpen} onOpenChange={setBastDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl bg-white/98 backdrop-blur-md border border-border shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden font-sans">
          <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-border"><DialogHeader><DialogTitle className="text-primary font-bold text-lg flex items-center gap-2"><CheckCircle2 className="h-5 w-5" />Konfirmasi Selesai Pembangunan</DialogTitle><DialogDescription className="text-xs">Unggah dokumen BAST fisik untuk menyelesaikan unit.</DialogDescription></DialogHeader></div>
          <form onSubmit={handleCompleteConstructionWithBast} className="p-6 space-y-4 pt-4">
            {bastUnit && <div className="p-3.5 bg-[#8FAF9A]/5 border border-primary/20 rounded-2xl space-y-2 text-xs font-semibold text-foreground"><div className="flex justify-between"><span className="text-muted-foreground">Kavling / Unit:</span><span className="font-mono text-primary font-bold">{bastUnit.code}</span></div>{bastSpk && <div className="flex justify-between border-t border-primary/50/10 pt-1.5"><span className="text-muted-foreground">SPK Terkait:</span><span className="font-mono">{bastSpk.spkNumber}</span></div>}</div>}
            <div className="space-y-1.5"><label className="font-semibold text-foreground text-xs">Unggah File PDF BAST</label><div onClick={() => document.getElementById('bast-pdf-upload-tab')?.click()} className="border-2 border-dashed border-primary/30 hover:border-primary/50 bg-muted/30/60 hover:bg-[#8FAF9A]/5 rounded-2xl p-6 text-center cursor-pointer transition-all duration-150 group"><input id="bast-pdf-upload-tab" type="file" accept="application/pdf" className="hidden" required onChange={(e) => { if (e.target.files && e.target.files.length > 0) setBastPdfFile(e.target.files[0]); }} /><div className="flex flex-col items-center justify-center space-y-2"><div className="p-2.5 bg-card rounded-full shadow-sm text-primary group-hover:scale-110 transition-transform duration-200"><UploadCloud className="h-5 w-5" /></div><span className="text-xs font-bold text-foreground">{bastPdfFile ? bastPdfFile.name : "Pilih File PDF BAST"}</span><span className="text-[10px] text-muted-foreground">{bastPdfFile ? `Ukuran: ${(bastPdfFile.size / 1024 / 1024).toFixed(2)} MB` : "Format PDF (Maks. 10MB)"}</span></div></div></div>
            <DialogFooter className="pt-2 border-t border-primary/50/10 mt-4"><Button type="button" variant="ghost" onClick={() => setBastDialogOpen(false)} className="text-xs text-muted-foreground hover:text-foreground rounded-xl">Batal</Button><Button type="submit" disabled={isSubmitting || !bastPdfFile} className="bg-primary hover:bg-primary/90 text-white font-extrabold text-xs rounded-xl shadow-sm px-4 flex items-center gap-1.5">{isSubmitting ? <span className="flex items-center gap-1"><span className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Memproses...</span> : <><CheckCircle2 className="h-4 w-4 text-white" />Selesai & Jadikan Siap Huni</>}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
