"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import {
  HardHat, AlertTriangle, TrendingUp, MessageSquare,
  FileText, Layers, Truck, ClipboardList,
} from "lucide-react";
import { SpkTab } from "./tabs/spk-tab";
import { SpmbTab } from "./tabs/spmb-tab";
import { ProgressTab } from "./tabs/progress-tab";
import { ComplaintsTab } from "./tabs/complaints-tab";
import { CustomerComplaintResolveDialog } from "@/components/dashboard/customer-complaint-resolve-dialog";
import {
  createCustomerComplaint,
} from "@/server/actions/production";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface ProductionShellProps {
  activeUser: { id: string; name: string; email: string; roleId?: string | null };
  projects: Array<{ id: string; name: string; code: string }>;
  units: Array<{ id: string; code: string; projectId: string | null; price: number; status: string; constructionProgress: number; readyStockSource?: string | null; isReadyStock?: boolean }>;
  customers: Array<{ id: string; name: string; phone: string }>;
  vendors: Array<{ id: string; name: string; phone: string | null }>;
  workItems: Array<{ id: string; code: string; name: string; defaultWeightPct: number }>;
  spks: Array<{
    id: string; spkNumber: string; projectId: string | null; unitId: string | null;
    vendorId: string | null; title: string; workDescription: string; specification: string | null;
    rabAmount: number; startDate: Date; targetEndDate: Date; actualEndDate: Date | null;
    status: "draft" | "active" | "completed" | "overdue" | "cancelled" | "proses_konstruksi" | "selesai_konstruksi";
    progressPct: number; createdAt: Date; projectName: string; unitCode: string; vendorName: string;
  }>;
  spmbs: Array<{
    id: string; spmbNumber: string; spkId: string | null; issueDate: Date; startWorkDate: Date;
    targetEndDate: Date; status: "issued" | "active" | "completed" | "cancelled"; notes: string | null;
    createdAt: Date; spkNumber: string; spkTitle: string; projectName: string; unitCode: string;
  }>;
  materialRequests: Array<{
    id: string; requestNumber: string; spkId: string | null; projectId: string | null;
    unitId: string | null; vendorId: string | null; description: string; estimatedAmount: number;
    status: "draft" | "submitted" | "finance_pending" | "approved" | "rejected" | "purchased";
    transactionId: string | null; createdAt: Date; spkNumber: string; projectName: string;
    unitCode: string; vendorName: string | null;
  }>;
  complaints: Array<{
    id: string; complaintNumber: string; customerId: string | null; unitId: string | null;
    category: string; description: string; status: string; resolvedAt: Date | null;
    createdAt: Date; customerName: string; unitCode: string; projectName: string;
  }>;
  dpPaidUnitIds: string[];
  isSuperAdmin?: boolean;
  isPengawas?: boolean;
  isVendor?: boolean;
  defaultTab?: "spk" | "progress" | "materials" | "complaints";
}

export default function ProductionShell({
  activeUser, isSuperAdmin = false, isPengawas = false, isVendor = false,
  projects, units, customers, vendors, workItems,
  spks, spmbs, materialRequests, complaints, dpPaidUnitIds, defaultTab,
}: ProductionShellProps) {
  const router = useRouter();
  const { t } = useI18n();
  const [activeTab, setActiveTab] = React.useState<"spk" | "progress" | "materials" | "complaints">(defaultTab || "spk");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  // Complaint states (shared between shell and complaints tab)
  const [complaintOpen, setComplaintOpen] = React.useState(false);
  const [selectedResolveComplaint, setSelectedResolveComplaint] = React.useState<any | null>(null);
  const [resolveDialogOpen, setResolveDialogOpen] = React.useState(false);
  const [newComplaint, setNewComplaint] = React.useState<{
    customerId: string; unitId: string; title: string;
    category: "bangunan" | "serah_terima" | "listrik_air" | "legalitas" | "fasilitas" | "pelayanan" | "after_sales" | "lainnya";
    description: string;
  }>({ customerId: "", unitId: "", title: "", category: "bangunan", description: "" });

  // Progress dialog bridge (SPK tab can trigger progress dialog in Progress tab)
  const [externalProgressSpkId, setExternalProgressSpkId] = React.useState<string | null>(null);
  const [externalProgressTab, setExternalProgressTab] = React.useState<string | null>(null);

  React.useEffect(() => { if (defaultTab) setActiveTab(defaultTab); }, [defaultTab]);

  // High-level stats
  const activeSpksCount = spks.filter(s => s.status === "active" || s.status === "proses_konstruksi").length;
  const overdueSpksCount = spks.filter(s => s.status === "overdue").length;
  const completedSpksCount = spks.filter(s => s.status === "completed" || s.status === "selesai_konstruksi").length;
  const openComplaintsCount = complaints.filter(c => c.status === "open").length;
  const constructionUnits = units.filter(u => u.status === "construction");
  const avgProgress = constructionUnits.length > 0 ? Math.round(constructionUnits.reduce((sum, u) => sum + u.constructionProgress, 0) / constructionUnits.length) : 0;

  // Handle complaint creation
  const handleCreateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true); setErrorMessage(null);
    try {
      await createCustomerComplaint(newComplaint);
      setSuccessMessage(t("production.complaint_created"));
      setComplaintOpen(false);
      setNewComplaint({ customerId: "", unitId: "", title: "", category: "bangunan", description: "" });
      router.refresh();
    } catch (e: any) { setErrorMessage(e.message || "Gagal menyimpan komplain."); }
    finally { setIsSubmitting(false); }
  };

  const handleResolveComplaint = (complaint: any) => {
    setSelectedResolveComplaint(complaint);
    setResolveDialogOpen(true);
  };

  // Bridge: SPK tab requests opening progress dialog
  const handleOpenProgressDialog = (spkId: string, tab: string) => {
    setExternalProgressSpkId(spkId);
    setExternalProgressTab(tab);
    // Switch to progress tab context isn't needed since progress dialog is inside ProgressTab
    // The ProgressTab will pick up the external trigger via prop
  };

  // Bridge: SPK tab requests opening BAST dialog  
  const handleOpenBastDialog = (unit: any, spk: any) => {
    // Trigger it inside the progress tab where BAST dialog lives
    setExternalProgressSpkId(spk?.id || null);
    setExternalProgressTab("bast");
  };

  return (
    <div className="space-y-6 font-sans">
      {/* PREMIUM HEADER */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#DDE8D8]/70 via-white/95 to-[#DDE8D8]/40 border border-[#D6DED2] shadow-sage p-6 mb-6">
        <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-[#8FAF9A]/10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 h-20 w-20 rounded-full bg-[#4F6F52]/8 blur-xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-[#4F6F52] flex items-center justify-center shadow-[0_4px_12px_rgba(79,111,82,0.3)] shrink-0"><HardHat className="h-6 w-6 text-white" /></div>
            <div><h2 className="text-2xl font-black text-[#243028] tracking-tight">{t("production.title")}</h2><p className="text-sm text-[#66736A] mt-0.5">{t("production.subtitle")}</p></div>
          </div>
        </div>
      </div>

      {/* SYSTEM STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-[#8FAF9A]/20 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("production.kpi_active_spk")}</CardTitle><div className="h-8 w-8 rounded-full bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center"><ClipboardList className="h-4 w-4 text-blue-600 dark:text-blue-400" /></div></CardHeader>
          <CardContent><div className="text-3xl font-extrabold tracking-tight text-foreground tabular-nums">{activeSpksCount}</div><p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><span className="text-[#4F6F52] font-semibold">{completedSpksCount} {t("production.kpi_done")}</span> {t("production.kpi_this_year")}</p></CardContent>
        </Card>
        <Card className="border-[#8FAF9A]/20 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("production.kpi_overdue")}</CardTitle><div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center"><AlertTriangle className="h-4 w-4 text-destructive" /></div></CardHeader>
          <CardContent><div className="text-3xl font-extrabold tracking-tight text-destructive tabular-nums">{overdueSpksCount}</div><p className="text-xs text-destructive mt-1 font-medium">{t("production.kpi_overdue_desc")}</p></CardContent>
        </Card>
        <Card className="border-[#8FAF9A]/20 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("production.kpi_avg_progress")}</CardTitle><div className="h-8 w-8 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center"><TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /></div></CardHeader>
          <CardContent><div className="text-3xl font-extrabold tracking-tight text-primary tabular-nums">{avgProgress}%</div><p className="text-xs text-muted-foreground mt-1">{t("production.kpi_avg_desc", { count: constructionUnits.length })}</p></CardContent>
        </Card>
        <Card className="border-[#8FAF9A]/20 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0"><CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("production.kpi_complaints")}</CardTitle><div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center"><MessageSquare className="h-4 w-4 text-amber-500" /></div></CardHeader>
          <CardContent><div className="text-3xl font-extrabold tracking-tight text-amber-500 tabular-nums">{openComplaintsCount}</div><p className="text-xs text-muted-foreground mt-1">{t("production.kpi_complaints_desc")}</p></CardContent>
        </Card>
      </div>

      {/* TAB NAVIGATION */}
      <div className="flex border-b border-border gap-2">
        <button onClick={() => { setActiveTab("spk"); setSearchQuery(""); }} className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors duration-200 flex items-center gap-2 ${activeTab === "spk" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><FileText className="h-4 w-4" />{t("production.tab_spk")}</button>
        <button onClick={() => { setActiveTab("progress"); setSearchQuery(""); }} className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors duration-200 flex items-center gap-2 ${activeTab === "progress" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><Layers className="h-4 w-4" />{t("production.tab_progress")}</button>
        <button onClick={() => { setActiveTab("materials"); setSearchQuery(""); }} className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors duration-200 flex items-center gap-2 ${activeTab === "materials" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><Truck className="h-4 w-4" />{t("production.tab_materials")}</button>
        <button onClick={() => { setActiveTab("complaints"); setSearchQuery(""); }} className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors duration-200 flex items-center gap-2 ${activeTab === "complaints" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}><MessageSquare className="h-4 w-4" />{t("production.tab_complaints")}</button>
      </div>

      {/* TAB CONTENT */}
      <Card className="border-[#8FAF9A]/20 shadow-sm">
        <CardContent className="p-6">
          {activeTab === "spk" && (
            <SpkTab
              spks={spks} spmbs={spmbs} projects={projects} units={units}
              vendors={vendors} workItems={workItems} dpPaidUnitIds={dpPaidUnitIds}
              isSuperAdmin={isSuperAdmin} isPengawas={isPengawas} isVendor={isVendor}
              searchQuery={searchQuery} onSearchChange={setSearchQuery}
              onOpenProgressDialog={handleOpenProgressDialog}
              onOpenBastDialog={handleOpenBastDialog}
            />
          )}

          {activeTab === "progress" && (
            <ProgressTab
              spks={spks} units={units} workItems={workItems}
              isSuperAdmin={isSuperAdmin} isPengawas={isPengawas} isVendor={isVendor}
              externalProgressSpkId={externalProgressSpkId}
              externalProgressTab={externalProgressTab}
              onExternalProgressHandled={() => { setExternalProgressSpkId(null); setExternalProgressTab(null); }}
            />
          )}

          {activeTab === "materials" && (
            <SpmbTab materialRequests={materialRequests} spks={spks} />
          )}

          {activeTab === "complaints" && (
            <ComplaintsTab
              complaints={complaints}
              onNewComplaint={() => setComplaintOpen(true)}
              onResolveComplaint={handleResolveComplaint}
            />
          )}
        </CardContent>
      </Card>

      {/* COMPLAINT DIALOG (shared) */}
      <Dialog open={complaintOpen} onOpenChange={setComplaintOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg rounded-3xl bg-white/98 backdrop-blur-md border border-[#D6DED2] shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden font-sans">
          <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-[#D6DED2]">
            <DialogHeader><DialogTitle className="text-primary font-bold text-lg flex items-center gap-2"><MessageSquare className="h-5 w-5" />{t("production.complaint_form_title")}</DialogTitle><DialogDescription className="text-xs">{t("production.complaint_form_desc")}</DialogDescription></DialogHeader>
          </div>
          <form onSubmit={handleCreateComplaint} className="p-6 space-y-4 pt-4 max-h-[75vh] overflow-y-auto">
            <div className="space-y-3 text-sm">
              <div className="space-y-1"><label className="font-semibold text-foreground text-xs">{t("production.complaint_lbl_customer")}</label>
                <Select value={newComplaint.customerId} onValueChange={(val: string | null) => setNewComplaint(prev => ({ ...prev, customerId: val || "" }))} required items={customers.map(c => ({ label: `${c.name} (${c.phone})`, value: c.id }))}>
                  <SelectTrigger className="w-full h-10 border-[#8FAF9A]/30 focus:ring-primary rounded-xl text-xs bg-white"><SelectValue placeholder={t("production.complaint_lbl_customer")}>{newComplaint.customerId ? (() => { const c = customers.find(cust => cust.id === newComplaint.customerId); return c ? `${c.name} (${c.phone})` : undefined; })() : undefined}</SelectValue></SelectTrigger>
                  <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.phone})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><label className="font-semibold text-foreground text-xs">{t("production.complaint_lbl_unit")}</label>
                <Select value={newComplaint.unitId} onValueChange={(val: string | null) => setNewComplaint(prev => ({ ...prev, unitId: val || "" }))} required items={units.map(u => ({ label: `${u.code} — status ${u.status}`, value: u.id }))}>
                  <SelectTrigger className="w-full h-10 border-[#8FAF9A]/30 focus:ring-primary rounded-xl text-xs bg-white"><SelectValue placeholder={t("production.complaint_lbl_unit")}>{newComplaint.unitId ? (() => { const u = units.find(unit => unit.id === newComplaint.unitId); return u ? `${u.code} — status ${u.status}` : undefined; })() : undefined}</SelectValue></SelectTrigger>
                  <SelectContent>{units.map(u => <SelectItem key={u.id} value={u.id}>{u.code} &mdash; status {u.status}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><label className="font-semibold text-foreground text-xs">Judul Komplain</label><Input type="text" required placeholder="Contoh: Plafon kamar mandi bocor..." className="border-[#8FAF9A]/30 focus-visible:ring-primary text-xs rounded-xl" value={newComplaint.title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewComplaint(prev => ({ ...prev, title: e.target.value }))} /></div>
              <div className="space-y-1"><label className="font-semibold text-foreground text-xs">{t("production.complaint_lbl_category")}</label>
                <Select value={newComplaint.category} onValueChange={(val: string | null) => setNewComplaint(prev => ({ ...prev, category: (val || "") as any }))} required items={[{ label: "Fisik Bangunan / Plafon / Dinding", value: "bangunan" }, { label: "BAST / Serah Terima", value: "serah_terima" }, { label: "Instalasi Air / Listrik", value: "listrik_air" }, { label: "Legalitas Sertifikat / PBB", value: "legalitas" }, { label: "Fasilitas Umum / Kawasan", value: "fasilitas" }, { label: "Pelayanan Staff", value: "pelayanan" }, { label: "Garansi Pemeliharaan", value: "after_sales" }, { label: "Lain-lain", value: "lainnya" }]}>
                  <SelectTrigger className="w-full h-10 border-[#8FAF9A]/30 focus:ring-primary rounded-xl text-xs bg-white"><SelectValue placeholder={t("production.complaint_lbl_category")}>{newComplaint.category === "bangunan" && "Fisik Bangunan / Plafon / Dinding"}{newComplaint.category === "serah_terima" && "BAST / Serah Terima"}{newComplaint.category === "listrik_air" && "Instalasi Air / Listrik"}{newComplaint.category === "legalitas" && "Legalitas Sertifikat / PBB"}{newComplaint.category === "fasilitas" && "Fasilitas Umum / Kawasan"}{newComplaint.category === "pelayanan" && "Pelayanan Staff"}{newComplaint.category === "after_sales" && "Garansi Pemeliharaan"}{newComplaint.category === "lainnya" && "Lain-lain"}</SelectValue></SelectTrigger>
                  <SelectContent><SelectItem value="bangunan">Fisik Bangunan / Plafon / Dinding</SelectItem><SelectItem value="serah_terima">BAST / Serah Terima</SelectItem><SelectItem value="listrik_air">Instalasi Air / Listrik</SelectItem><SelectItem value="legalitas">Legalitas Sertifikat / PBB</SelectItem><SelectItem value="fasilitas">Fasilitas Umum / Kawasan</SelectItem><SelectItem value="pelayanan">Pelayanan Staff</SelectItem><SelectItem value="after_sales">Garansi Pemeliharaan</SelectItem><SelectItem value="lainnya">Lain-lain</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><label className="font-semibold text-foreground text-xs">{t("production.complaint_lbl_desc")}</label><Textarea required placeholder={t("production.complaint_desc_ph")} className="border-[#8FAF9A]/30 focus-visible:ring-primary text-xs" value={newComplaint.description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewComplaint(prev => ({ ...prev, description: e.target.value }))} /></div>
            </div>
            <DialogFooter className="pt-2"><Button type="button" variant="ghost" onClick={() => setComplaintOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">{t("production.btn_cancel")}</Button><Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-[#4F6F52] text-primary-foreground font-semibold text-xs">{t("production.btn_submit_complaint")}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CustomerComplaintResolveDialog
        complaint={selectedResolveComplaint}
        open={resolveDialogOpen}
        onClose={() => { setResolveDialogOpen(false); setSelectedResolveComplaint(null); }}
        onSuccess={() => { setResolveDialogOpen(false); setSelectedResolveComplaint(null); router.refresh(); }}
      />
    </div>
  );
}
