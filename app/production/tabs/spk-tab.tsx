"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  HardHat, Plus, Search, CheckCircle2, XCircle, FileText,
  AlertTriangle, Layers, Sparkles, Calendar, Wrench, TrendingUp,
  ClipboardList, ChevronDown, ChevronUp, Clock, Loader2,
} from "lucide-react";
import {
  createSpk, activateSpk, checkOverdueSpks, deleteSpk, updateSpk,
  getSpkDetails, completeVendorSpk,
} from "@/server/actions/production";

const SPK_STATUS_LABELS: Record<string, string> = {
  active: "Aktif",
  proses_konstruksi: "Proses Konstruksi",
  selesai_konstruksi: "Selesai Konstruksi",
  overdue: "Terlambat",
  completed: "Selesai",
  cancelled: "Batal",
  draft: "Draft",
};

interface Spk {
  id: string;
  spkNumber: string;
  projectId: string | null;
  unitId: string | null;
  vendorId: string | null;
  title: string;
  workDescription: string;
  specification: string | null;
  rabAmount: number;
  startDate: Date;
  targetEndDate: Date;
  actualEndDate: Date | null;
  status: "draft" | "active" | "completed" | "overdue" | "cancelled" | "proses_konstruksi" | "selesai_konstruksi";
  progressPct: number;
  createdAt: Date;
  projectName: string;
  unitCode: string;
  vendorName: string;
}

interface Spmb {
  id: string;
  spmbNumber: string;
  spkId: string | null;
  spkNumber: string;
  spkTitle: string;
  projectName: string;
  unitCode: string;
}

export interface SpkTabProps {
  spks: Spk[];
  spmbs: Spmb[];
  projects: Array<{ id: string; name: string; code: string }>;
  units: Array<{ id: string; code: string; projectId: string | null; price: number; status: string; constructionProgress: number; readyStockSource?: string | null; isReadyStock?: boolean }>;
  vendors: Array<{ id: string; name: string; phone: string | null }>;
  workItems: Array<{ id: string; code: string; name: string; defaultWeightPct: number }>;
  dpPaidUnitIds: string[];
  isSuperAdmin?: boolean;
  isPengawas?: boolean;
  isVendor?: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenProgressDialog: (spkId: string, tab: string) => void;
  onOpenBastDialog: (unit: any, spk: any) => void;
}

export function SpkTab({
  spks,
  spmbs,
  projects,
  units,
  vendors,
  workItems,
  dpPaidUnitIds,
  isSuperAdmin = false,
  isPengawas = false,
  isVendor = false,
  searchQuery,
  onSearchChange,
  onOpenProgressDialog,
  onOpenBastDialog,
}: SpkTabProps) {
  const router = useRouter();
  const { t } = useI18n();
  const dpPaidUnitIdsSet = React.useMemo(() => new Set(dpPaidUnitIds), [dpPaidUnitIds]);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  // SPK Dialog states
  const [spkOpen, setSpkOpen] = React.useState(false);
  const [editingSpkId, setEditingSpkId] = React.useState<string | null>(null);
  const [spkFormError, setSpkFormError] = React.useState<string | null>(null);
  const [formWeights, setFormWeights] = React.useState<Array<{ workItemId: string; weightPct: number }>>([]);
  const [vendorCompleteConfirmOpen, setVendorCompleteConfirmOpen] = React.useState(false);
  const [spkToCompleteVendor, setSpkToCompleteVendor] = React.useState<any | null>(null);

  // SPK detail view state
  const [selectedSpkId, setSelectedSpkId] = React.useState<string | null>(null);
  const [lastSelectedSpkId, setLastSelectedSpkId] = React.useState<string | null>(null);
  const [spkWeights, setSpkWeights] = React.useState<Array<{ workItemId: string; name: string; weightPct: number; currentProgress: number }>>([]);

  React.useEffect(() => {
    if (selectedSpkId) setLastSelectedSpkId(selectedSpkId);
  }, [selectedSpkId]);

  // SPK form state
  const [newSpk, setNewSpk] = React.useState({
    projectId: "", unitId: "", vendorId: "", title: "",
    workDescription: "", specification: "", rabAmount: "", startDate: "", targetEndDate: "",
  });

  // Vendor Performance
  const vendorPerformance = React.useMemo(() => {
    const perfMap = new Map<string, { id: string; name: string; activeSpks: number; completedSpks: number; totalProgress: number; overdueSpks: number }>();
    vendors.forEach(v => { perfMap.set(v.id, { id: v.id, name: v.name, activeSpks: 0, completedSpks: 0, totalProgress: 0, overdueSpks: 0 }); });
    spks.forEach(s => {
      if (!s.vendorId) return;
      let p = perfMap.get(s.vendorId);
      if (!p) { p = { id: s.vendorId, name: s.vendorName || "Kontraktor Tanpa Nama", activeSpks: 0, completedSpks: 0, totalProgress: 0, overdueSpks: 0 }; perfMap.set(s.vendorId, p); }
      if (s.status === "active" || s.status === "proses_konstruksi") { p.activeSpks += 1; p.totalProgress += s.progressPct; }
      else if (s.status === "completed" || s.status === "selesai_konstruksi") { p.completedSpks += 1; p.totalProgress += 100; }
      else if (s.status === "overdue") { p.overdueSpks += 1; p.totalProgress += s.progressPct; }
    });
    return Array.from(perfMap.values()).map(p => {
      const totalSpks = p.activeSpks + p.completedSpks + p.overdueSpks;
      const avgSpkProgress = totalSpks > 0 ? Math.round(p.totalProgress / totalSpks) : 0;
      let rating = "A"; let ratingColor = "bg-[#DDE8D8] text-[#4F6F52] border border-[#8FAF9A]/30";
      if (p.overdueSpks > 0) { rating = "C"; ratingColor = "bg-red-50 text-red-700 border border-red-200"; }
      else if (avgSpkProgress < 50 && p.activeSpks > 0) { rating = "B"; ratingColor = "bg-amber-50 text-amber-700 border border-amber-200"; }
      return { ...p, totalSpks, avgSpkProgress, rating, ratingColor };
    }).filter(p => p.totalSpks > 0);
  }, [spks, vendors]);

  const filteredSpks = spks.filter(s => {
    const q = searchQuery.toLowerCase();
    return s.spkNumber.toLowerCase().includes(q) || s.title.toLowerCase().includes(q) || s.unitCode.toLowerCase().includes(q) || s.vendorName.toLowerCase().includes(q);
  });

  // Handlers
  const handleRunOverdueScanner = async () => {
    setIsSubmitting(true); setErrorMessage(null); setSuccessMessage(null);
    try {
      const res = await checkOverdueSpks();
      setSuccessMessage(t("production.scanner_done").replace("{{count}}", res.updatedCount.toString()));
      router.refresh();
    } catch (e: any) { setErrorMessage(e.message || "Gagal menjalankan scanner."); }
    finally { setIsSubmitting(false); }
  };

  const handleDeleteSpk = async (id: string, spkNumber: string) => {
    const confirmed = window.confirm(`Apakah Anda yakin ingin menghapus SPK "${spkNumber}"? Tindakan ini tidak dapat dibatalkan.`);
    if (!confirmed) return;
    setIsSubmitting(true); setErrorMessage(null); setSuccessMessage(null);
    try {
      const res = await deleteSpk(id);
      if (res.success) { setSuccessMessage(`Surat Perintah Kerja (SPK) "${spkNumber}" berhasil dihapus.`); if (selectedSpkId === id) setSelectedSpkId(null); router.refresh(); }
    } catch (err) { setErrorMessage(err instanceof Error ? err.message : "Gagal menghapus SPK."); }
    finally { setIsSubmitting(false); }
  };

  const handleEditSpkClick = async (s: any) => {
    setEditingSpkId(s.id);
    setNewSpk({ projectId: s.projectId || "", unitId: s.unitId || "", vendorId: s.vendorId || "", title: s.title || "", workDescription: s.workDescription || "", specification: s.specification || "", rabAmount: String(s.rabAmount || ""), startDate: new Date(s.startDate).toISOString().slice(0, 10), targetEndDate: new Date(s.targetEndDate).toISOString().slice(0, 10) });
    try {
      const details = await getSpkDetails(s.id);
      if (details && details.weights && details.weights.length > 0) { setFormWeights(details.weights.map(w => ({ workItemId: w.workItem.id, weightPct: w.weight.weightPct }))); }
      else { setFormWeights(workItems.map(item => ({ workItemId: item.id, weightPct: item.defaultWeightPct }))); }
    } catch { setFormWeights(workItems.map(item => ({ workItemId: item.id, weightPct: item.defaultWeightPct }))); }
    setSpkOpen(true);
  };

  const handleCreateSpk = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true); setErrorMessage(null);
    const totalFormWeight = formWeights.reduce((sum, w) => sum + (w.weightPct || 0), 0);
    if (totalFormWeight !== 100) { setSpkFormError(`Total bobot komponen harus tepat 100%. Saat ini: ${totalFormWeight}%. Silakan sesuaikan kembali.`); setIsSubmitting(false); return; }
    try {
      if (editingSpkId) {
        await updateSpk(editingSpkId, { projectId: newSpk.projectId, unitId: newSpk.unitId, vendorId: newSpk.vendorId, title: newSpk.title, workDescription: newSpk.workDescription, specification: newSpk.specification || null, rabAmount: Number(newSpk.rabAmount), startDate: new Date(newSpk.startDate), targetEndDate: new Date(newSpk.targetEndDate), customWeights: formWeights });
        setSuccessMessage(t("production.spk_updated"));
      } else {
        await createSpk({ projectId: newSpk.projectId, unitId: newSpk.unitId, vendorId: newSpk.vendorId, title: newSpk.title, workDescription: newSpk.workDescription, specification: newSpk.specification || null, rabAmount: Number(newSpk.rabAmount), startDate: new Date(newSpk.startDate), targetEndDate: new Date(newSpk.targetEndDate), customWeights: formWeights });
        setSuccessMessage(t("production.spk_created"));
      }
      setSpkFormError(null); setSpkOpen(false); setEditingSpkId(null);
      setNewSpk({ projectId: "", unitId: "", vendorId: "", title: "", workDescription: "", specification: "", rabAmount: "", startDate: "", targetEndDate: "" });
      router.refresh();
    } catch (e: any) {
      let msg = "Gagal memproses SPK.";
      try { const parsed = JSON.parse(e.message); if (Array.isArray(parsed)) { msg = parsed.map((err: any) => err.message || err.path?.join(".")).join(", "); } else if (parsed.message) { msg = parsed.message; } } catch { msg = e.message || msg; }
      setSpkFormError(msg);
    } finally { setIsSubmitting(false); }
  };

  const handleActivateSpk = async (spkId: string) => {
    setIsSubmitting(true); setErrorMessage(null); setSuccessMessage(null);
    try { await activateSpk(spkId); setSuccessMessage(t("production.construction_started")); router.refresh(); }
    catch (e: any) { setErrorMessage(e.message || "Gagal memulai konstruksi."); }
    finally { setIsSubmitting(false); }
  };

  const handleViewSpkDetails = async (spkId: string) => {
    setSelectedSpkId(spkId);
    try {
      const details = await getSpkDetails(spkId);
      if (!details) return;
      const items = details.weights.map(w => {
        const totalProgress = details.logs.filter(l => l.log.workItemId === w.weight.workItemId).reduce((sum, l) => sum + l.log.percentageAdded, 0);
        return { workItemId: w.workItem.id, name: w.workItem.name, weightPct: w.weight.weightPct, currentProgress: Math.min(100, totalProgress) };
      });
      setSpkWeights(items);
    } catch (e) { setErrorMessage(e instanceof Error ? e.message : "Gagal memuat detail SPK."); }
  };

  const handleCompleteVendorSpk = async () => {
    if (!spkToCompleteVendor) return;
    setIsSubmitting(true); setErrorMessage(null); setSuccessMessage(null);
    try {
      const res = await completeVendorSpk(spkToCompleteVendor.id);
      if (res.success) { setSuccessMessage(`Pernyataan selesai pembangunan SPK "${spkToCompleteVendor.spkNumber}" berhasil diajukan! Status SPK kini "Selesai Konstruksi" dan siap diverifikasi oleh Pengawas/Admin.`); setVendorCompleteConfirmOpen(false); setSpkToCompleteVendor(null); router.refresh(); }
      else throw new Error("Gagal menyelesaikan pembangunan SPK.");
    } catch (e: any) { setErrorMessage(e.message || "Gagal menyelesaikan pembangunan SPK."); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="space-y-6">
      {/* Alert Banners */}
      {errorMessage && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
          <XCircle className="h-5 w-5 shrink-0" /><span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-[#DDE8D8] border border-[#8FAF9A]/40 text-[#4F6F52] text-sm font-medium animate-fade-in">
          <CheckCircle2 className="h-5 w-5 shrink-0" /><span>{successMessage}</span>
        </div>
      )}

      {/* Header actions */}
      <div className="flex flex-wrap items-center gap-2.5 justify-end">
        <Button onClick={handleRunOverdueScanner} disabled={isSubmitting} variant="outline" className="bg-white/90 backdrop-blur-sm border-[#D6DED2] text-[#4F6F52] hover:bg-[#8FAF9A]/10 font-bold rounded-xl h-10 shadow-sm">
          <Calendar className="mr-2 h-4 w-4 text-[#4F6F52]" />{t("production.btn_scan_overdue")}
        </Button>
        <Button onClick={() => { setEditingSpkId(null); setNewSpk({ projectId: "", unitId: "", vendorId: "", title: "", workDescription: "", specification: "", rabAmount: "", startDate: "", targetEndDate: "" }); setFormWeights(workItems.map(item => ({ workItemId: item.id, weightPct: item.defaultWeightPct }))); setSpkOpen(true); }} className="bg-[#4F6F52] hover:bg-[#3D563F] text-white font-bold rounded-xl h-10 shadow-[0_4px_14px_rgba(79,111,82,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all">
          <Plus className="mr-2 h-4 w-4" />{t("production.btn_new_spk")}
        </Button>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("production.spk_search_ph")} className="pl-8 border-[#8FAF9A]/30 focus-visible:ring-primary" value={searchQuery} onChange={(e) => onSearchChange(e.target.value)} />
        </div>
        <div className="text-xs text-muted-foreground font-medium">{t("production.spk_showing", { shown: filteredSpks.length, total: spks.length })}</div>
      </div>

      {/* Vendor Performance Board */}
      {vendorPerformance.length > 0 && (
        <div className="bg-[#F7F8F3]/80 p-5 rounded-3xl border border-[#8FAF9A]/30 space-y-4 shadow-[0_4px_20px_-2px_rgba(143,175,154,0.1)]">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5"><HardHat className="h-4 w-4 text-primary" />{t("production.perf_board_title")}</h4>
              <p className="text-[11px] text-muted-foreground">{t("production.perf_board_desc")}</p>
            </div>
            <Badge className="bg-[#DDE8D8] text-[#4F6F52] font-semibold text-[10px] rounded-full border border-[#8FAF9A]/30 hover:bg-[#DDE8D8] shadow-none">Live Audit</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {vendorPerformance.slice(0, 3).map((vp) => (
              <div key={vp.id} className="bg-white/90 p-4 rounded-2xl border border-[#8FAF9A]/20 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-3 group">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{t("production.perf_contractor_lbl")}</span>
                    <h5 className="font-bold text-sm text-[#243028] group-hover:text-primary transition-colors">{vp.name}</h5>
                  </div>
                  <Badge className={`${vp.ratingColor} font-extrabold text-[10px] px-2 py-0.5 rounded-md shadow-none border`}>Grade {vp.rating}</Badge>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold"><span className="text-muted-foreground">{t("production.perf_avg_progress")}</span><span className="text-primary font-bold">{vp.avgSpkProgress}%</span></div>
                  <Progress value={vp.avgSpkProgress} className="h-1.5 bg-muted" />
                </div>
                <div className="grid grid-cols-3 gap-1 text-center border-t border-[#8FAF9A]/10 pt-2 text-[10px] font-semibold text-muted-foreground">
                  <div className="space-y-0.5"><div className="text-foreground font-bold font-mono tabular-nums text-xs">{vp.totalSpks}</div><div>{t("production.perf_total_spk")}</div></div>
                  <div className="space-y-0.5 border-x border-[#8FAF9A]/10"><div className="text-[#4F6F52] font-bold font-mono tabular-nums text-xs">{vp.completedSpks}</div><div>{t("production.perf_done")}</div></div>
                  <div className="space-y-0.5"><div className="text-red-600 font-bold font-mono tabular-nums text-xs">{vp.overdueSpks}</div><div>{t("production.perf_overdue")}</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SPK Table */}
      <div className="rounded-md border border-[#8FAF9A]/20 overflow-hidden">
        <Table>
          <TableHeader className="bg-[#8FAF9A]/10">
            <TableRow>
              <TableHead className="font-bold text-primary w-[14%]">{t("production.col_spk_no")}</TableHead>
              <TableHead className="font-bold text-primary w-[14%]">{t("production.col_project_unit")}</TableHead>
              <TableHead className="font-bold text-primary w-[14%]">{t("production.col_contractor")}</TableHead>
              <TableHead className="font-bold text-primary w-[17%]">{t("production.col_work")}</TableHead>
              <TableHead className="font-bold text-primary w-[12%]">{t("production.col_rab")}</TableHead>
              <TableHead className="font-bold text-primary w-[10%]">{t("production.col_target")}</TableHead>
              <TableHead className="font-bold text-primary text-center w-[9%]">{t("production.col_progress")}</TableHead>
              <TableHead className="font-bold text-primary w-[10%]">{t("production.col_status")}</TableHead>
              <TableHead className="font-bold text-primary text-right w-[10%]">{t("production.col_action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSpks.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">{t("production.spk_empty")}</TableCell></TableRow>
            ) : (
              filteredSpks.map((s) => (
                <TableRow key={s.id} className="hover:bg-[#8FAF9A]/5 cursor-pointer transition-colors duration-150" onClick={() => handleViewSpkDetails(s.id)}>
                  <TableCell className="font-bold font-mono text-[#243028] text-xs">{s.spkNumber}</TableCell>
                  <TableCell><div className="font-extrabold text-[#243028] text-xs">{s.projectName}</div><div className="text-[10px] font-bold text-muted-foreground font-mono mt-0.5">Unit: {s.unitCode}</div></TableCell>
                  <TableCell className="font-semibold text-[#243028] text-xs">{s.vendorName}</TableCell>
                  <TableCell><div className="font-bold text-[#243028] text-xs">{s.title}</div><div className="text-[10px] text-muted-foreground truncate max-w-[150px] font-medium mt-0.5">{s.workDescription}</div></TableCell>
                  <TableCell className="font-bold font-mono text-xs">{s.rabAmount === 0 ? <span className="text-rose-600 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />Rp 0</span> : <span className="text-[#4F6F52]">Rp {s.rabAmount.toLocaleString("id-ID")}</span>}</TableCell>
                  <TableCell className="text-muted-foreground text-[10px] font-bold font-mono">{new Date(s.targetEndDate).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' })}</TableCell>
                  <TableCell className="align-middle"><div className="flex flex-col items-center gap-1 w-20 mx-auto"><Progress value={s.progressPct} className="h-1.5 w-16 bg-muted" /><span className="text-[10px] font-extrabold text-primary font-mono">{s.progressPct}%</span></div></TableCell>
                  <TableCell>
                    <Badge className={`shadow-none font-semibold text-[10px] ${s.status === "completed" || s.status === "selesai_konstruksi" ? "bg-[#DDE8D8] text-[#4F6F52] border border-[#8FAF9A]/30" : s.status === "proses_konstruksi" ? "bg-purple-50 text-purple-700 border border-purple-200" : s.status === "active" ? "bg-blue-50 text-blue-700 border border-blue-200" : s.status === "overdue" ? "bg-red-50 text-red-700 border border-red-200 animate-pulse" : "bg-gray-100 text-gray-700 border border-gray-200"}`}>
                      {s.status === "completed" || s.status === "selesai_konstruksi" ? (s.status === "selesai_konstruksi" ? t("production.status_selesai_konstruksi") : t("production.status_done")) : s.status === "proses_konstruksi" ? t("production.status_proses_konstruksi") : s.status === "active" ? t("production.status_active") : s.status === "overdue" ? t("production.status_overdue") : t("production.status_draft")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      {isSuperAdmin && (<><Button size="sm" onClick={() => handleEditSpkClick(s)} className="bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs h-7 px-2.5 rounded-md" title="Ubah Rincian SPK">Ubah</Button><Button size="sm" variant="destructive" onClick={() => handleDeleteSpk(s.id, s.spkNumber)} className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs h-7 px-2.5 rounded-md" title="Hapus SPK">Hapus</Button></>)}
                      {s.status === "active" && <Button size="sm" onClick={() => handleActivateSpk(s.id)} className="bg-primary hover:bg-[#4F6F52] text-primary-foreground font-semibold text-xs h-7">{t("production.btn_start_work")}</Button>}
                      <Button size="sm" variant="outline" onClick={() => { if (selectedSpkId === s.id) setSelectedSpkId(null); else handleViewSpkDetails(s.id); }} className={`border-[#8FAF9A] text-primary hover:bg-[#8FAF9A]/10 text-xs h-7 flex items-center gap-1.5 transition-all duration-200 ${selectedSpkId === s.id ? "bg-[#DDE8D8]/50 border-primary shadow-sm" : ""}`}>
                        {t("production.btn_detail")}{selectedSpkId === s.id ? <ChevronUp className="h-3.5 w-3.5 text-primary shrink-0 transition-transform duration-200" /> : <ChevronDown className="h-3.5 w-3.5 text-[#66736A] shrink-0 transition-transform duration-200" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* SPK Detail Drawer */}
      <div className={`overflow-hidden transition-all duration-500 ease-in-out ${selectedSpkId ? "max-h-[1200px] opacity-100 p-6 border-[#8FAF9A]/40 mt-6 bg-gradient-to-r from-background to-[#DDE8D8]/10 rounded-xl border space-y-6 shadow-sm" : "max-h-0 opacity-0 p-0 m-0 border-transparent pointer-events-none"}`}>
        {(() => {
          const spk = spks.find(s => s.id === (selectedSpkId || lastSelectedSpkId));
          if (!spk) return null;
          return (
            <div className="space-y-6">
              {spk.rabAmount === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3"><AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" /><div><h5 className="font-bold text-amber-900 text-sm">Nilai RAB Belum Diverifikasi</h5><p className="text-amber-700 text-xs mt-1">SPK ini dibuat secara otomatis dengan nilai RAB Rp 0. Silakan verifikasi dan ubah nilai RAB sesuai harga kontrak yang benar.</p></div></div>
                  {isSuperAdmin && <Button size="sm" onClick={() => handleEditSpkClick(spk)} className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs whitespace-nowrap self-start sm:self-center">Ubah Nilai RAB</Button>}
                </div>
              )}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#8FAF9A]/20">
                <div>
                  <div className="text-xs font-bold text-primary uppercase tracking-wider">{t("production.spk_detail_lbl")}</div>
                  <h3 className="text-xl font-bold text-foreground mt-1 flex items-center gap-2"><span className="font-mono text-primary">{spk.spkNumber}</span> &mdash; {spk.title}</h3>
                </div>
                <div className="flex items-center gap-2">
                  {(() => { const spkSpmb = spmbs.find(b => b.spkId === spk.id); return spkSpmb ? <a href={`/production/spmb/${spkSpmb.id}/print`} className="border border-amber-500/50 text-amber-700 hover:bg-amber-50 font-semibold text-xs h-9 px-4 rounded-md flex items-center justify-center gap-1.5 transition-colors bg-background"><FileText className="h-4 w-4 text-amber-600" />{t("production.btn_print_spmb")}</a> : null; })()}
                  {(spk.status === "completed" || spk.status === "selesai_konstruksi") && <a href={`/production/spk/${spk.id}/bast/print`} className="border border-emerald-500/50 text-emerald-700 hover:bg-emerald-50 font-semibold text-xs h-9 px-4 rounded-md flex items-center justify-center gap-1.5 transition-colors bg-background"><CheckCircle2 className="h-4 w-4 text-emerald-600" />Cetak BAST</a>}
                  {spk.status === "active" && <Button size="sm" onClick={() => handleActivateSpk(spk.id)} className="bg-primary hover:bg-[#4F6F52] text-primary-foreground font-semibold text-xs h-9">{t("production.btn_start_work")}</Button>}
                  {(spk.status === "proses_konstruksi" || spk.status === "overdue") && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" onClick={() => { onOpenProgressDialog(spk.id, "form"); }} className="bg-[#4F6F52] hover:bg-[#3D563F] text-white font-semibold text-xs h-9 rounded-xl shadow-sm"><Wrench className="mr-1.5 h-3.5 w-3.5" />{t("production.btn_input_progress") || "Catat Progress"}</Button>
                      <Button size="sm" variant="outline" onClick={() => { onOpenProgressDialog(spk.id, "history"); }} className="border-amber-600/40 text-amber-700 hover:bg-amber-50/50 hover:text-amber-800 font-semibold text-xs h-9 rounded-xl"><Clock className="mr-1.5 h-3.5 w-3.5 text-amber-600" />Revisi / Riwayat</Button>
                    </div>
                  )}

                  {(() => {
                    const unit = units.find(u => u.id === spk.unitId);
                    const isReadyToComplete = unit && (unit.status === "construction_done" || ((unit.status === "construction" || unit.status === "overdue") && unit.constructionProgress === 100));
                    if (isVendor) {
                      const canVendorDeclareComplete = spk.progressPct === 100 && (spk.status === "proses_konstruksi" || spk.status === "overdue");
                      if (canVendorDeclareComplete) return <Button size="sm" onClick={() => { setSpkToCompleteVendor(spk); setVendorCompleteConfirmOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs h-9 rounded-xl flex items-center gap-1.5 shadow-[0_4px_12px_rgba(16,185,129,0.25)] transition-all animate-pulse"><CheckCircle2 className="h-4 w-4" />Selesai Membangun (Vendor)</Button>;
                      return null;
                    }
                    const showDirectComplete = isReadyToComplete && (spk.status === "proses_konstruksi" || spk.status === "overdue");
                    const showUploadBastOnly = spk.status === "selesai_konstruksi" && unit && unit.status !== "construction_done";
                    if (showDirectComplete || showUploadBastOnly) return <Button size="sm" onClick={() => onOpenBastDialog(unit, spk)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs h-9 rounded-xl flex items-center gap-1.5 shadow-[0_4px_12px_rgba(16,185,129,0.25)] transition-all animate-pulse ml-2"><CheckCircle2 className="h-4 w-4" />{spk.status === "selesai_konstruksi" ? "Upload BAST & Selesaikan Unit" : "Selesai Membangun (Upload BAST)"}</Button>;
                    return null;
                  })()}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-4">
                  <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5"><Layers className="h-4 w-4 text-primary" />Struktur Komponen & Bobot SLA Pembangunan</h4>
                  <div className="space-y-3 bg-background p-4 rounded-lg border border-[#8FAF9A]/20">
                    {spkWeights.map((w) => (<div key={w.workItemId} className="space-y-1"><div className="flex items-center justify-between text-xs font-semibold text-foreground"><span>{w.name} <span className="text-muted-foreground">({t("production.weight_lbl")}: {w.weightPct}%)</span></span><span className="text-primary font-bold">{w.currentProgress}%</span></div><Progress value={w.currentProgress} className="h-2 bg-muted" /></div>))}
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-primary" />Informasi SPK</h4>
                  <div className="bg-background p-4 rounded-lg border border-[#8FAF9A]/20 space-y-3 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">{t("production.info_project")}:</span><span className="font-semibold text-foreground">{spk.projectName}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{t("production.info_kavling")}:</span><span className="font-bold text-foreground font-mono">{spk.unitCode}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{t("production.info_contractor")}:</span><span className="font-semibold text-foreground">{spk.vendorName}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{t("production.info_value")}:</span><span className="font-bold text-primary font-mono tabular-nums">Rp {spk.rabAmount.toLocaleString("id-ID")}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">{t("production.info_duration")}:</span><span className="font-semibold text-foreground">{new Date(spk.startDate).toLocaleDateString("id-ID")} s/d {new Date(spk.targetEndDate).toLocaleDateString("id-ID")}</span></div>
                    {spk.specification && <div className="pt-2 border-t border-[#8FAF9A]/10"><div className="text-muted-foreground mb-1">{t("production.info_spec")}:</div><p className="bg-[#8FAF9A]/5 p-2 rounded text-foreground italic font-medium leading-relaxed">{spk.specification}</p></div>}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Create/Edit SPK Dialog */}
      <Dialog open={spkOpen} onOpenChange={(open) => { setSpkOpen(open); if (!open) { setEditingSpkId(null); setNewSpk({ projectId: "", unitId: "", vendorId: "", title: "", workDescription: "", specification: "", rabAmount: "", startDate: "", targetEndDate: "" }); setFormWeights([]); } if (open) setSpkFormError(null); }}>
        <DialogContent className="sm:max-w-lg rounded-3xl bg-white/98 backdrop-blur-md border border-[#D6DED2] shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden font-sans">
          <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-[#D6DED2]">
            <DialogHeader>
              <DialogTitle className="text-primary font-bold text-lg">{editingSpkId ? "Ubah Surat Perintah Kerja (SPK)" : t("production.spk_form_title")}</DialogTitle>
              <DialogDescription className="text-xs">{editingSpkId ? "Perbarui rincian Surat Perintah Kerja untuk kontraktor lapangan." : t("production.spk_form_desc")}</DialogDescription>
            </DialogHeader>
          </div>
          <form onSubmit={handleCreateSpk} className="p-6 space-y-4 pt-4 max-h-[75vh] overflow-y-auto">
            {spkFormError && <div className="w-full flex items-start gap-2.5 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold animate-in fade-in slide-in-from-top-2"><XCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" /><span className="leading-relaxed">{spkFormError}</span></div>}

            {newSpk.unitId && (() => { const selectedUnit = units.find(u => u.id === newSpk.unitId); const needsGate = selectedUnit && ["kpr_process", "booking"].includes(selectedUnit.status); if (!needsGate) return null; const dpPaid = dpPaidUnitIdsSet.has(newSpk.unitId); return dpPaid ? <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold animate-in fade-in"><span className="h-5 w-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 text-[10px] font-bold">✓</span><span><strong>{t("production.dp_gate_paid")}</strong></span></div> : <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 text-xs font-semibold animate-in fade-in"><AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" /><div><p className="font-bold text-amber-900">{t("production.dp_gate_warning")}</p><p className="text-amber-700 font-medium mt-0.5">{t("production.dp_gate_desc")}</p></div></div>; })()}

            <div className="space-y-3 text-sm">
              <div className="space-y-1"><label className="font-semibold text-foreground text-xs">{t("production.spk_lbl_project")}</label>
                <Select value={newSpk.projectId} onValueChange={(val: string | null) => setNewSpk(prev => ({ ...prev, projectId: val || "", unitId: "" }))} required items={projects.map(p => ({ label: `${p.name} (${p.code})`, value: p.id }))}>
                  <SelectTrigger className="w-full border-[#8FAF9A]/30 focus:ring-primary"><SelectValue placeholder={t("production.spk_lbl_project")}>{newSpk.projectId ? (() => { const p = projects.find(proj => proj.id === newSpk.projectId); return p ? `${p.name} (${p.code})` : undefined; })() : undefined}</SelectValue></SelectTrigger>
                  <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="space-y-1"><label className="font-semibold text-foreground text-xs">{t("production.spk_lbl_unit")}</label>
                <Select value={newSpk.unitId} onValueChange={(val: string | null) => setNewSpk(prev => ({ ...prev, unitId: val || "" }))} disabled={!newSpk.projectId} required items={units.map(u => ({ label: `${u.code} — ${u.status}`, value: u.id }))}>
                  <SelectTrigger className="w-full border-[#8FAF9A]/30 focus:ring-primary"><SelectValue placeholder={t("production.spk_lbl_unit")}>{newSpk.unitId ? (() => { const u = units.find(unit => unit.id === newSpk.unitId); return u ? `${u.code} — ${u.status}` : undefined; })() : undefined}</SelectValue></SelectTrigger>
                  <SelectContent>{units.filter(u => (u.projectId === newSpk.projectId && !u.isReadyStock && u.status !== "belum_siap" && (u.status !== "construction" || !spks.some(s => s.unitId === u.id && s.status !== "cancelled")) && u.status !== "construction_done" && (u.constructionProgress || 0) < 100) || u.id === newSpk.unitId).map(u => <SelectItem key={u.id} value={u.id}>{u.code} &mdash; Progres {u.constructionProgress || 0}%</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="space-y-1"><label className="font-semibold text-foreground text-xs">{t("production.spk_lbl_vendor")}</label>
                <Select value={newSpk.vendorId} onValueChange={(val: string | null) => setNewSpk(prev => ({ ...prev, vendorId: val || "" }))} required items={vendors.map(v => ({ label: v.name, value: v.id }))}>
                  <SelectTrigger className="w-full border-[#8FAF9A]/30 focus:ring-primary"><SelectValue placeholder={t("production.spk_lbl_vendor")}>{newSpk.vendorId ? vendors.find(v => v.id === newSpk.vendorId)?.name : undefined}</SelectValue></SelectTrigger>
                  <SelectContent>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="space-y-1"><label className="font-semibold text-foreground text-xs">{t("production.spk_lbl_title")}</label><Input required placeholder={t("production.spk_title_ph")} className="border-[#8FAF9A]/30 focus-visible:ring-primary" value={newSpk.title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSpk(prev => ({ ...prev, title: e.target.value }))} /></div>
              <div className="space-y-1"><label className="font-semibold text-foreground text-xs">{t("production.spk_lbl_work_desc")}</label><Textarea required placeholder={t("production.spk_work_desc_ph")} className="border-[#8FAF9A]/30 focus-visible:ring-primary text-xs" value={newSpk.workDescription} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewSpk(prev => ({ ...prev, workDescription: e.target.value }))} /></div>
              <div className="space-y-1"><label className="font-semibold text-foreground text-xs">{t("production.spk_lbl_spec")}</label><Input placeholder={t("production.spk_spec_ph")} className="border-[#8FAF9A]/30 focus-visible:ring-primary" value={newSpk.specification} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSpk(prev => ({ ...prev, specification: e.target.value }))} /></div>
              <div className="space-y-1"><label className="font-semibold text-foreground text-xs">{t("production.spk_lbl_rab")}</label><Input type="number" required placeholder={t("production.spk_rab_ph")} className="border-[#8FAF9A]/30 focus-visible:ring-primary" value={newSpk.rabAmount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSpk(prev => ({ ...prev, rabAmount: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><label className="font-semibold text-foreground text-xs">{t("production.spk_lbl_start")}</label><Input type="date" required className="border-[#8FAF9A]/30 focus-visible:ring-primary text-xs" value={newSpk.startDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSpk(prev => ({ ...prev, startDate: e.target.value }))} /></div>
                <div className="space-y-1"><label className="font-semibold text-foreground text-xs">{t("production.spk_lbl_end")}</label><Input type="date" required className="border-[#8FAF9A]/30 focus-visible:ring-primary text-xs" value={newSpk.targetEndDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSpk(prev => ({ ...prev, targetEndDate: e.target.value }))} /></div>
              </div>

              {/* Weight breakdown */}
              <div className="p-4 bg-[#F7F8F3]/80 border border-[#8FAF9A]/30 rounded-2xl space-y-3 transition-all duration-300">
                <div className="flex justify-between items-center text-[#243028] font-bold text-xs">
                  <span className="flex items-center gap-1.5"><Layers className="h-4 w-4 text-primary" />Struktur Komponen & Bobot SLA Pembangunan</span>
                  {(() => { const totalWeight = formWeights.reduce((sum, w) => sum + (w.weightPct || 0), 0); const isPerfect = totalWeight === 100; return <Badge className={`font-bold text-[10px] rounded-full shadow-none border transition-colors ${isPerfect ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-50" : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-50 animate-pulse"}`}>Total: {totalWeight}% {isPerfect ? "(Sesuai)" : "(Wajib 100%)"}</Badge>; })()}
                </div>
                <div className="space-y-2.5 divide-y divide-[#8FAF9A]/10 text-xs font-semibold text-[#4F6F52] pt-1">
                  {workItems.map(item => {
                    const currentWeight = formWeights.find(w => w.workItemId === item.id)?.weightPct ?? item.defaultWeightPct;
                    const allocatedAmount = Number(newSpk.rabAmount || 0) * (currentWeight / 100);
                    const formattedAllocated = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(allocatedAmount);
                    return (
                      <div key={item.id} className="flex justify-between items-center pt-2.5 first:pt-0 last:pb-0">
                        <div className="flex flex-col gap-0.5"><span className="text-[#243028] font-bold text-xs">{item.name}</span><span className="text-muted-foreground text-[10px] font-mono">{item.code}</span></div>
                        <div className="flex items-center gap-3">
                          {Number(newSpk.rabAmount) > 0 && <span className="text-primary/90 font-bold tabular-nums text-xs bg-[#DDE8D8]/40 px-2 py-1 rounded-lg border border-[#8FAF9A]/20">{formattedAllocated}</span>}
                          <div className="relative flex items-center w-20">
                            <Input type="number" min={1} max={100} value={currentWeight} onChange={(e) => { const val = Math.max(0, Math.min(100, Number(e.target.value) || 0)); setFormWeights(prev => { const exists = prev.some(w => w.workItemId === item.id); if (!exists) return [...prev, { workItemId: item.id, weightPct: val }]; return prev.map(w => w.workItemId === item.id ? { ...w, weightPct: val } : w); }); }} className="w-full h-8 text-center font-mono text-xs rounded-lg border-[#8FAF9A]/30 focus-visible:ring-primary pr-6 font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                            <span className="absolute right-2 text-xs text-muted-foreground font-bold pointer-events-none">%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="ghost" onClick={() => setSpkOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">{t("production.btn_cancel")}</Button>
              <Button type="submit" disabled={isSubmitting || (() => { const u = units.find(unit => unit.id === newSpk.unitId); if (!u) return false; if (["kpr_process", "booking"].includes(u.status) && !dpPaidUnitIdsSet.has(newSpk.unitId)) return true; return false; })()} className="bg-primary hover:bg-[#4F6F52] text-primary-foreground font-semibold text-xs disabled:opacity-60 disabled:cursor-not-allowed">
                {(() => { const u = units.find(unit => unit.id === newSpk.unitId); const blocked = u && ["kpr_process", "booking"].includes(u.status) && !dpPaidUnitIdsSet.has(newSpk.unitId); return blocked ? `🔒 ${t("production.btn_wait_dp")}` : (editingSpkId ? "Simpan Perubahan" : t("production.btn_publish_spk")); })()}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Vendor Complete Confirm Dialog */}
      <Dialog open={vendorCompleteConfirmOpen} onOpenChange={setVendorCompleteConfirmOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl bg-white/98 backdrop-blur-md border border-[#D6DED2] shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden font-sans">
          <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-[#D6DED2]">
            <DialogHeader>
              <DialogTitle className="text-primary font-bold text-lg flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-emerald-600" />Nyatakan Selesai Konstruksi (Vendor)</DialogTitle>
              <DialogDescription className="text-xs">Apakah Anda yakin telah menyelesaikan semua pekerjaan pada SPK ini dengan progress fisik 100%?</DialogDescription>
            </DialogHeader>
          </div>
          <div className="p-6 space-y-4 pt-4">
            {spkToCompleteVendor && (
              <div className="p-3.5 bg-[#8FAF9A]/5 border border-[#8FAF9A]/20 rounded-2xl space-y-2 text-xs font-semibold text-foreground">
                <div className="flex justify-between"><span className="text-muted-foreground">Pekerjaan:</span><span className="text-[#243028] font-bold">{spkToCompleteVendor.title}</span></div>
                <div className="flex justify-between border-t border-[#8FAF9A]/10 pt-1.5"><span className="text-muted-foreground">Nomor SPK:</span><span className="font-mono text-primary font-bold">{spkToCompleteVendor.spkNumber}</span></div>
                <div className="flex justify-between border-t border-[#8FAF9A]/10 pt-1.5"><span className="text-muted-foreground">Kavling / Unit:</span><span className="font-mono">{spkToCompleteVendor.unitCode}</span></div>
                <div className="flex justify-between border-t border-[#8FAF9A]/10 pt-1.5"><span className="text-muted-foreground">Progress Fisik:</span><span className="text-emerald-700 font-extrabold">{spkToCompleteVendor.progressPct}%</span></div>
              </div>
            )}
            <div className="text-xs text-muted-foreground leading-relaxed bg-amber-50 border border-amber-200/50 rounded-2xl p-3 flex gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <span><strong>Perhatian:</strong> Mengajukan selesai pembangunan akan mengubah status SPK menjadi <strong>Selesai Konstruksi</strong>. Pengawas Lapangan &amp; Admin Developer akan melakukan verifikasi fisik di lokasi sebelum menandatangani BAST resmi dan menyelesaikan status unit.</span>
            </div>
            <DialogFooter className="pt-2 border-t border-[#8FAF9A]/10 mt-4 flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setVendorCompleteConfirmOpen(false)} className="text-xs text-muted-foreground hover:text-foreground rounded-xl">Batal</Button>
              <Button type="button" disabled={isSubmitting} onClick={handleCompleteVendorSpk} className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-sm px-4 flex items-center gap-1.5">
                {isSubmitting ? <span className="flex items-center gap-1"><span className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />Memproses...</span> : <><CheckCircle2 className="h-4 w-4 text-white" />Ya, Nyatakan Selesai</>}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
