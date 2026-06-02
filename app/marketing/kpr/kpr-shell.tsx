"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  Building, 
  Clock, 
  AlertCircle, 
  Filter, 
  Layers,
  Sparkles,
  Search,
  FileText,
  AlertTriangle,
  CheckCircle,
  FolderOpen
} from "lucide-react";
import KprCardDetailDialog from "./kpr-card-detail-dialog";
import KprDetailViewSheet from "./kpr-detail-view-sheet";
import { useI18n } from "@/lib/i18n";
import { updateKprStatusDirect } from "@/server/actions/marketing";
import { Progress } from "@/components/ui/progress";
import { KprMilestoneTracker } from "./kpr-milestone-tracker";

interface KprCard {
  id: string;
  status: string;
  biCheckStatus: string;
  documentStatus: string;
  slaStartAt: Date | null;
  slaDeadlineAt: Date | null;
  bankNotes: string | null;
  akadDate: Date | null;
  bookingId: string;
  bookingNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  projectName: string;
  unitId: string;
  unitCode: string;
  price: number;
  unitStatus: string;
  isReadyStock: boolean;
  readyStockSource: string | null;
  constructionProgress: number | null;
  marketingName?: string | null;
}

interface BankPartner {
  id: string;
  name: string;
  code?: string | null;
}

interface BankSubmission {
  id: string;
  kprProcessId: string;
  bankPartnerId: string;
  submissionDate: Date;
  status: string;
  plafondAmount: number | null;
  tenorYear: number | null;
}

interface CustomerDocument {
  id: string;
  customerId: string;
  bookingId?: string | null;
  documentType: string;
  attachmentId: string;
  fileName?: string;
  fileUrl?: string;
  status: string;
  notes?: string | null;
}

export function KprShell({
  initialKpr,
  bankPartners,
  submissions,
  documents,
  accounts = [],
  canVerifyDocs = false,
  canApproveHandover = false,
}: {
  initialKpr: KprCard[];
  bankPartners: BankPartner[];
  submissions: BankSubmission[];
  documents: CustomerDocument[];
  accounts?: any[];
  canVerifyDocs?: boolean;
  canApproveHandover?: boolean;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const now = new Date();

  // Kanban Columns configuration
  const COLUMNS = [
    { id: "bi_checking", label: t("kpr_board.col_bichecking"), color: "border-indigo-200 bg-indigo-50/20 text-indigo-800", marker: "bg-indigo-500" },
    { id: "pemberkasan", label: t("kpr_board.col_pemberkasan"), color: "border-amber-200 bg-amber-50/20 text-amber-800", marker: "bg-amber-500" },
    { id: "proses_bank", label: t("kpr_board.col_proses_bank"), color: "border-blue-200 bg-blue-50/20 text-blue-800", marker: "bg-blue-500" },
    { id: "offering", label: t("kpr_board.col_offering"), color: "border-purple-200 bg-purple-50/20 text-purple-800", marker: "bg-purple-500" },
    { id: "approved", label: t("kpr_board.col_approved"), color: "border-teal-200 bg-teal-50/20 text-teal-800", marker: "bg-teal-500" },
    { id: "rejected", label: t("kpr_board.col_rejected"), color: "border-rose-200 bg-rose-50/20 text-rose-800", marker: "bg-rose-500" },
    { id: "akad", label: t("kpr_board.col_akad"), color: "border-emerald-200 bg-emerald-50/20 text-emerald-800", marker: "bg-emerald-500" },
    { id: "realisasi", label: "Realisasi Dana", color: "border-cyan-200 bg-cyan-50/20 text-cyan-800", marker: "bg-cyan-500" },
    { id: "physical_waiting", label: "Cek Fisik Unit", color: "border-orange-200 bg-orange-50/20 text-orange-800", marker: "bg-orange-500" },
    { id: "handover_waiting", label: "Menunggu Serah Terima", color: "border-fuchsia-200 bg-fuchsia-50/20 text-fuchsia-800", marker: "bg-fuchsia-500" },
    { id: "bast_developer", label: "BAST Dev ke Konsumen", color: "border-pink-200 bg-pink-50/20 text-pink-800", marker: "bg-pink-500" },
    { id: "handover_done", label: "Serah Terima Selesai", color: "border-emerald-200 bg-emerald-50/20 text-emerald-800", marker: "bg-emerald-500" },
  ];

  // Helper to map card to the correct column dynamically (supporting terminal Serah Terima columns)
  const getCardKanbanColumn = (k: KprCard): string => {
    if (k.unitStatus === "handover_complete") {
      return "handover_done";
    }

    if (k.status === "realisasi") {
      const bastDoc = documents.find(d => d.bookingId === k.bookingId && d.documentType === "bast");
      if (bastDoc) {
        if (bastDoc.status === "verified") {
          return "handover_done";
        }
        return "bast_developer";
      }

      const isReady = k.isReadyStock === true || k.readyStockSource === "legacy_ready_stock" || k.readyStockSource === "manual_ready_stock";
      if (!isReady && (k.constructionProgress ?? 0) < 100) {
        return "physical_waiting";
      }

      return "realisasi";
    }

    if (k.unitStatus === "menunggu_serah_terima") {
      const bastDoc = documents.find(d => d.bookingId === k.bookingId && d.documentType === "bast");
      if (bastDoc) {
        if (bastDoc.status === "verified") {
          return "handover_done";
        }
        return "bast_developer";
      }
      return "handover_waiting";
    }

    return k.status;
  };

  // States
  const [projectFilter, setProjectFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [docFilter, setDocFilter] = useState("all");
  const [slaFilter, setSlaFilter] = useState("all");
  const [viewingKpr, setViewingKpr] = useState<KprCard | null>(null);

  // Drag and Drop States
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggedOverColId, setDraggedOverColId] = useState<string | null>(null);

  // Get unique project names for the filter
  const projects = Array.from(new Set(initialKpr.map(k => k.projectName)));

  // Filtering Logic
  const filteredKpr = initialKpr.filter(k => {
    // 1. Project Filter
    if (projectFilter !== "all" && k.projectName !== projectFilter) return false;

    // 2. Text Search (Customer Name or Unit Code)
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = k.customerName.toLowerCase().includes(q);
      const matchCode = k.unitCode.toLowerCase().includes(q);
      if (!matchName && !matchCode) return false;
    }

    // 3. Document Status Filter
    if (docFilter !== "all" && k.documentStatus !== docFilter) return false;

    // 4. SLA Status Filter
    if (slaFilter !== "all") {
      let isOverdue = false;
      if (k.slaDeadlineAt && k.status === "pemberkasan") {
        isOverdue = new Date(k.slaDeadlineAt) < now;
      }
      if (slaFilter === "overdue" && !isOverdue) return false;
      if (slaFilter === "safe" && isOverdue) return false;
      if (slaFilter === "safe" && k.status === "pemberkasan" && !k.slaDeadlineAt) return false;
    }

    return true;
  });

  // KPI Calculations (based on current project filter for relevance)
  const projectScopedKpr = initialKpr.filter(k => projectFilter === "all" || k.projectName === projectFilter);
  const kpiTotalActive = projectScopedKpr.filter(k => k.status !== "akad" && k.status !== "rejected").length;
  const kpiIncompleteDocs = projectScopedKpr.filter(k => k.documentStatus === "incomplete").length;
  
  const kpiSlaOverdue = projectScopedKpr.filter(k => {
    if (k.status === "pemberkasan" && k.slaDeadlineAt) {
      return new Date(k.slaDeadlineAt) < now;
    }
    return false;
  }).length;

  const kpiBankApproved = projectScopedKpr.filter(k => 
    submissions.some(sub => sub.kprProcessId === k.id && sub.status === "approved")
  ).length;

  // HTML5 Drag Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    const card = initialKpr.find(k => k.id === id);
    if (card && (card.status === "realisasi" || card.unitStatus === "menunggu_serah_terima" || card.unitStatus === "handover_complete" || card.unitStatus === "sold")) {
      e.preventDefault();
      alert("Tahapan pasca-Realisasi dan Serah Terima dikelola melalui Tombol Aksi di Detail Kelola KPR, bukan dengan geser kartu.");
      return;
    }
    setDraggingId(id);
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    if (draggedOverColId !== colId) {
      setDraggedOverColId(colId);
    }
  };

  const handleDragLeave = () => {
    setDraggedOverColId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    setDraggedOverColId(null);
    const id = e.dataTransfer.getData("text/plain") || draggingId;
    if (!id) return;

    const TERMINAL_COLUMNS = ["realisasi", "physical_waiting", "handover_waiting", "bast_developer", "handover_done"];
    if (TERMINAL_COLUMNS.includes(targetStatus)) {
      alert("Tahapan ini tidak dapat diubah dengan geser kartu.\n\n• Realisasi Dana → gunakan Form Realisasi di 'Kelola Berkas KPR'\n• Cek Fisik / Serah Terima → dikelola otomatis oleh sistem");
      setDraggingId(null);
      return;
    }

    const targetCard = initialKpr.find(k => k.id === id);
    if (!targetCard || targetCard.status === targetStatus) return;

    // Check for unverified files — only mandatory KPR docs (KTP, NPWP, Slip Gaji, KK)
    // Supporting docs (BAST, SPJB, kpr_doc) are uploaded AFTER akad/realisasi — do NOT gate here
    const MANDATORY_DOC_TYPES = ["ktp", "npwp", "slip_gaji", "kk"];
    const allClientDocs = documents.filter(d => d.customerId === targetCard.customerId);
    const mandatoryClientDocs = allClientDocs.filter(d => MANDATORY_DOC_TYPES.includes(d.documentType));
    const hasUnverifiedDocs = mandatoryClientDocs.some(d => d.status !== "verified");

    if (hasUnverifiedDocs || mandatoryClientDocs.length === 0) {
      alert(
        "Pemberitahuan: Berkas wajib KPR (KTP, NPWP, Slip Gaji, KK) belum lengkap atau belum terverifikasi.\n\n" +
        "Pihak yang perlu/berwenang memverifikasi berkas tersebut adalah:\n" +
        "- Super Admin\n" +
        "- Admin Kantor\n" +
        "- Admin Keuangan\n" +
        "- Direksi / Manager\n\n" +
        "Proses pemindahan ditolak karena seluruh berkas wajib konsumen harus diverifikasi terlebih dahulu!"
      );
      setDraggingId(null);
      return;
    }

    // Check for bank partner submission status requirements
    const clientSubmissions = submissions.filter(sub => sub.kprProcessId === targetCard.id);

    if (targetStatus === "proses_bank") {
      const hasVerified = clientSubmissions.some(
        sub => sub.status === "verified" || sub.status === "offering" || sub.status === "approved"
      );
      if (!hasVerified) {
        alert(
          "Gagal memindahkan status KPR:\n\n" +
          "Untuk memindahkan ke tahap 'Proses Bank', pengajuan ke bank partner harus berstatus minimal 'Verified' (Diverifikasi oleh analis bank).\n\n" +
          "Status saat ini masih 'Submitted' (Diajukan) atau belum ada pengajuan sama sekali."
        );
        setDraggingId(null);
        return;
      }
    }

    if (targetStatus === "offering") {
      const hasOffering = clientSubmissions.some(
        sub => sub.status === "offering" || sub.status === "approved"
      );
      if (!hasOffering) {
        alert(
          "Gagal memindahkan status KPR:\n\n" +
          "Untuk memindahkan ke tahap 'Offering', harus ada minimal satu pengajuan bank partner yang sudah menerbitkan penawaran (berstatus 'Offering' atau 'Approved').\n\n" +
          "Status saat ini masih 'Verified' / 'Submitted' atau belum ada pengajuan sama sekali."
        );
        setDraggingId(null);
        return;
      }
    }

    // Guard: approved is a one-way gate — cannot go backward
    const BACKWARD_FROM_APPROVED = ["bi_checking", "pemberkasan", "proses_bank", "offering"];
    if (targetCard.status === "approved" && BACKWARD_FROM_APPROVED.includes(targetStatus)) {
      alert(
        "Gagal memindahkan status KPR:\n\n" +
        "KPR yang sudah berstatus 'Approved' tidak dapat dikembalikan ke tahap sebelumnya.\n\n" +
        "Dari Approved, alur hanya dapat maju ke tahap Akad (setelah pembangunan selesai & BAST diunggah)."
      );
      setDraggingId(null);
      return;
    }

    // Guard: realisasi is a terminal gate — RULE 7: cannot go backward at all
    const BACKWARD_FROM_REALISASI = ["bi_checking", "pemberkasan", "proses_bank", "offering", "approved", "akad"];
    if (targetCard.status === "realisasi" && BACKWARD_FROM_REALISASI.includes(targetStatus)) {
      alert(
        "Gagal memindahkan status KPR:\n\n" +
        "Status 'Realisasi Dana' tidak dapat dikembalikan ke tahap sebelumnya.\n\n" +
        "Dana KPR yang sudah dicairkan dari bank tidak dapat dibatalkan melalui sistem ini."
      );
      setDraggingId(null);
      return;
    }

    if (targetStatus === "approved") {
      const hasApproved = clientSubmissions.some(
        sub => sub.status === "approved"
      );
      if (!hasApproved) {
        alert(
          "Gagal memindahkan status KPR:\n\n" +
          "Untuk memindahkan ke tahap 'Approved', pengajuan KPR harus sudah disetujui secara resmi oleh minimal satu bank rekanan (status pengajuan bank adalah 'Approved')."
        );
        setDraggingId(null);
        return;
      }
    }

    if (targetStatus === "rejected" && targetCard.status === "approved") {
      alert(
        "Gagal memindahkan status KPR:\n\n" +
        "KPR yang sudah berstatus 'Approved' tidak dapat dikembalikan ke 'Ditolak (Rejected)'.\n\n" +
        "Jika terdapat permasalahan serius, hubungi Super Admin untuk penanganan lebih lanjut."
      );
      setDraggingId(null);
      return;
    }

    if (targetStatus === "akad") {
      const isConstPending =
        targetCard.unitStatus === "construction" &&
        (targetCard.constructionProgress ?? 0) < 100;
      if (isConstPending) {
        alert(
          `Gagal memindahkan ke Akad:\n\n` +
          `Pembangunan fisik unit ${targetCard.unitCode} masih berjalan ` +
          `(${targetCard.constructionProgress ?? 0}%).\n\n` +
          `Selesaikan pembangunan fisik unit terlebih dahulu di modul Produksi sebelum melanjutkan ke tahap Akad.`
        );
        setDraggingId(null);
        return;
      }
    }

    // Demotion check: prompt for revision notes when moving KPR card backward
    const STAGE_ORDER = ["bi_checking", "pemberkasan", "proses_bank", "offering", "approved", "akad"];
    const currentIndex = STAGE_ORDER.indexOf(targetCard.status);
    const newIndex = STAGE_ORDER.indexOf(targetStatus);

    let revisionNotes = "";
    if (currentIndex !== -1 && newIndex !== -1 && newIndex < currentIndex) {
      const targetColName = COLUMNS.find(c => c.id === targetStatus)?.label || targetStatus;
      const notesInput = prompt(
        `Anda sedang mengembalikan alur KPR konsumen ${targetCard.customerName} ke tahap sebelumnya (${targetColName}).\n\n` +
        `Silakan masukkan catatan pemberitahuan apa saja yang perlu direvisi/diperbaiki:`
      );
      if (notesInput === null) {
        setDraggingId(null);
        return; // Abort move
      }
      if (!notesInput.trim()) {
        alert("Catatan revisi wajib diisi jika alur KPR dikembalikan ke tahap sebelumnya!");
        setDraggingId(null);
        return; // Abort move
      }
      revisionNotes = notesInput.trim();
    }

    try {
      const res = await updateKprStatusDirect(id, targetStatus, revisionNotes);
      if (res.success) {
        router.refresh();
      }
    } catch (err: any) {
      alert(`Gagal memindahkan status KPR: ${err.message}`);
    } finally {
      setDraggingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── PREMIUM HEADER ── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#DDE8D8]/70 via-white/95 to-[#DDE8D8]/40 border border-[#D6DED2] shadow-sage p-6">
        <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-[#8FAF9A]/10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 h-20 w-20 rounded-full bg-[#4F6F52]/8 blur-xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-[#4F6F52] flex items-center justify-center shadow-[0_4px_12px_rgba(79,111,82,0.3)] shrink-0">
              <Layers className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-1.5 w-1.5 rounded-full bg-[#4F6F52] animate-pulse" />
                <span className="text-[10px] font-bold text-[#4F6F52] uppercase tracking-wider">{t("kpr_board.module_name")}</span>
              </div>
              <h2 className="text-2xl font-black text-[#243028] tracking-tight">{t("kpr_board.title")}</h2>
              <p className="text-sm text-[#66736A] mt-0.5">{t("kpr_board.subtitle")}</p>
            </div>
          </div>

          {/* Project Filter */}
          <div className="flex items-center gap-2.5 bg-white/90 backdrop-blur-sm border border-[#D6DED2]/60 px-4 py-2 rounded-2xl shadow-sm self-end md:self-center">
            <Filter className="w-4 h-4 text-[#4F6F52] shrink-0" />
            <span className="text-xs font-bold text-[#66736A] uppercase tracking-wider hidden sm:inline">{t("kpr_board.filter_project")}</span>
            <Select value={projectFilter} onValueChange={(val: string | null) => setProjectFilter(val || "all")}>
              <SelectTrigger className="w-[180px] h-8 text-xs bg-white border-[#D6DED2] rounded-xl focus:ring-[#8FAF9A]/20">
                <SelectValue placeholder={t("kpr_board.all_projects")}>
                  {projectFilter === "all" ? t("kpr_board.all_projects") : projectFilter}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all" className="text-xs">{t("kpr_board.all_projects")}</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* ── KPI METRICS BAR (Opsi B) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Active KPR */}
        <Card className="border-[#D6DED2] bg-white rounded-2xl shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-[#66736A] uppercase tracking-wider block">{t("kpr_board.kpi_active")}</span>
              <span className="font-mono text-2xl font-black text-[#243028] block">{kpiTotalActive}</span>
            </div>
            <div className="h-10 w-10 bg-[#DDE8D8]/50 text-[#4F6F52] rounded-xl flex items-center justify-center">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Incomplete Docs */}
        <Card className="border-[#D6DED2] bg-white rounded-2xl shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-[#66736A] uppercase tracking-wider block">{t("kpr_board.kpi_incomplete")}</span>
              <span className="font-mono text-2xl font-black text-amber-700 block">{kpiIncompleteDocs}</span>
            </div>
            <div className="h-10 w-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
              <FolderOpen className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: SLA Overdue */}
        <Card className="border-[#D6DED2] bg-white rounded-2xl shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-[#66736A] uppercase tracking-wider block">{t("kpr_board.kpi_overdue")}</span>
              <span className="font-mono text-2xl font-black text-rose-700 block">{kpiSlaOverdue}</span>
            </div>
            <div className="h-10 w-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Bank Approved */}
        <Card className="border-[#D6DED2] bg-white rounded-2xl shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-[#66736A] uppercase tracking-wider block">{t("kpr_board.kpi_approved")}</span>
              <span className="font-mono text-2xl font-black text-emerald-700 block">{kpiBankApproved}</span>
            </div>
            <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
              <CheckCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── ADVANCED CONTROLS & FILTER BAR (Opsi C) ── */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-3.5 rounded-2xl border border-[#D6DED2] shadow-sm">
        {/* Real-time search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#66736A]/60" />
          <Input
            placeholder={t("kpr_board.search_ph")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs border-[#D6DED2] rounded-xl focus-visible:ring-[#8FAF9A]/30 focus-visible:border-[#8FAF9A]"
          />
        </div>

        {/* Doc checklist filter */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-[#66736A] uppercase whitespace-nowrap">{t("kpr_board.filter_doc")}</span>
          <Select value={docFilter} onValueChange={(val: string | null) => setDocFilter(val || "all")}>
            <SelectTrigger className="w-[140px] h-9 text-xs border-[#D6DED2] rounded-xl bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all" className="text-xs">{t("kpr_board.doc_all")}</SelectItem>
              <SelectItem value="complete" className="text-xs">{t("kpr_board.doc_complete")}</SelectItem>
              <SelectItem value="incomplete" className="text-xs">{t("kpr_board.doc_incomplete")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* SLA Warning filter */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-[#66736A] uppercase whitespace-nowrap">{t("kpr_board.filter_sla")}</span>
          <Select value={slaFilter} onValueChange={(val: string | null) => setSlaFilter(val || "all")}>
            <SelectTrigger className="w-[140px] h-9 text-xs border-[#D6DED2] rounded-xl bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all" className="text-xs">{t("kpr_board.sla_all")}</SelectItem>
              <SelectItem value="safe" className="text-xs">{t("kpr_board.sla_safe")}</SelectItem>
              <SelectItem value="overdue" className="text-xs">{t("kpr_board.sla_overdue_filter")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── PIPELINE KANBAN BOARD ── */}
      <div className="flex gap-4 overflow-x-auto pb-6 items-start scrollbar-thin scrollbar-thumb-[#8FAF9A]/30 scrollbar-track-[#F7F8F3] w-full">
        {COLUMNS.map((col) => {
          const colCards = filteredKpr.filter((k) => getCardKanbanColumn(k) === col.id);
          const isOver = draggedOverColId === col.id;

          return (
            <div 
              key={col.id} 
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`p-3 rounded-2xl flex flex-col h-[calc(100vh-340px)] min-h-[500px] w-[280px] shrink-0 shadow-sm transition-all duration-200 ${
                isOver 
                  ? "bg-[#DDE8D8]/50 border-2 border-dashed border-[#4F6F52] scale-[1.01]" 
                  : "bg-[#F7F8F3]/60 border border-[#D6DED2]/60 hover:shadow-md"
              }`}
            >
              {/* Column Header */}
              <div className={`p-3 rounded-xl border flex items-center justify-between font-bold text-xs mb-3 shadow-sm bg-white shrink-0 ${col.color}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${col.marker}`} />
                  <span className="uppercase tracking-wider font-extrabold">{col.label}</span>
                </div>
                <Badge className="bg-[#F7F8F3] text-[#243028] border border-[#D6DED2]/60 font-mono font-bold text-[10px] px-2 py-0.5 rounded-md">
                  {colCards.length}
                </Badge>
              </div>

              {/* Cards List */}
              <div className="space-y-3 flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200">
                {colCards.length > 0 ? (
                  colCards.map((kprCard) => {
                    const clientSubmissions = submissions.filter(sub => sub.kprProcessId === kprCard.id);
                    const clientDocs = documents.filter(doc => doc.customerId === kprCard.customerId);

                    // SLA Countdown calculations
                    let remainingDays = 0;
                    let isSlaOverdue = false;
                    if (kprCard.slaDeadlineAt && kprCard.status === "pemberkasan") {
                      const limit = new Date(kprCard.slaDeadlineAt);
                      remainingDays = Math.ceil((limit.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                      if (remainingDays <= 0) {
                        isSlaOverdue = true;
                      }
                    }

                    // Checklist Documents uploaded indicators (KTP, NPWP, Slip Gaji, KK)
                    const hasKtp = clientDocs.some(d => d.documentType === "ktp" && d.status !== "rejected");
                    const hasNpwp = clientDocs.some(d => d.documentType === "npwp" && d.status !== "rejected");
                    const hasSlip = clientDocs.some(d => d.documentType === "slip_gaji" && d.status !== "rejected");
                    const hasKk = clientDocs.some(d => d.documentType === "kk" && d.status !== "rejected");

                    return (
                      <div
                        key={kprCard.id}
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, kprCard.id)}
                      >
                        <Card 
                          onClick={() => setViewingKpr(kprCard)}
                          className={`cursor-pointer hover:shadow-sage-lg active:scale-[0.99] shadow-sage-md bg-white border rounded-2xl relative transition-all duration-200 group hover:-translate-y-1 ${
                            isSlaOverdue 
                              ? "shadow-[0_0_15px_rgba(215,122,122,0.25)] border-[#D77A7A]/70" 
                              : "border-[#D6DED2]/80 hover:border-[#8FAF9A]"
                          }`}
                        >
                          {/* SLA Overdue Bar indicator */}
                          {isSlaOverdue && (
                            <div className="absolute top-0 inset-x-0 h-1 rounded-t-2xl bg-gradient-to-r from-[#D77A7A] to-[#E8A0A8]" />
                          )}

                          <CardContent className="p-4 pt-5 space-y-3">
                            {/* Customer Avatar & Name */}
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-inner ${
                                isSlaOverdue ? "bg-[#F8D4DA] text-[#8B3443]" : "bg-[#DDE8D8] text-[#4F6F52]"
                              }`}>
                                {kprCard.customerName.substring(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="font-bold text-[#243028] group-hover:text-[#4F6F52] transition text-xs truncate leading-tight">
                                  {kprCard.customerName}
                                </h4>
                                <p className="text-[9px] text-[#66736A] font-semibold mt-0.5">
                                  {t("kpr_board.card_booking")} <span className="font-mono text-[#4F6F52]">{kprCard.bookingNumber}</span>
                                </p>
                              </div>
                            </div>

                            {/* Unit Specifications info */}
                            <div className="flex flex-col gap-1.5 bg-[#F7F8F3] p-2.5 rounded-xl border border-[#D6DED2]/30">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-[#66736A] font-bold truncate pr-2">{kprCard.projectName}</span>
                                <Badge variant="outline" className="font-mono font-black bg-white border-[#D6DED2] text-[#4F6F52] text-[9px] px-2 py-0.5 rounded-md shrink-0">
                                  {kprCard.unitCode}
                                </Badge>
                              </div>
                              {/* Status Bank Rekanan Terkait */}
                              {(() => {
                                const submittedBanks = clientSubmissions.map(sub => {
                                  const bp = bankPartners.find(b => b.id === sub.bankPartnerId);
                                  return bp?.name;
                                }).filter(Boolean);

                                return submittedBanks.length > 0 ? (
                                  <div className="flex flex-wrap gap-1 pt-1 border-t border-[#D6DED2]/20">
                                    {submittedBanks.map((bankName, idx) => (
                                      <Badge key={idx} variant="outline" className="bg-[#DDE8D8]/50 text-[#4F6F52] border-[#D6DED2]/60 text-[8px] font-extrabold px-1.5 py-0.5 rounded-md shrink-0 flex items-center gap-1">
                                        <span>🏦</span>
                                        <span>{bankName}</span>
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-[8px] text-[#A8B0AA] font-bold pt-1 border-t border-[#D6DED2]/20">
                                    Belum Ada Bank Rekanan
                                  </div>
                                );
                              })()}
                            </div>

                            {/* Ringkasan Finansial Presisi (Harga vs Plafond) */}
                            {(() => {
                              const approvedSub = clientSubmissions.find(sub => sub.status === "approved" || sub.status === "offering");
                              const approvedPlafond = approvedSub?.plafondAmount;
                              const initialPlafond = clientSubmissions[0]?.plafondAmount;
                              const displayPlafond = approvedPlafond || initialPlafond || 0;

                              const formatVal = (val: number) => {
                                return new Intl.NumberFormat("id-ID", {
                                  style: "currency",
                                  currency: "IDR",
                                  maximumFractionDigits: 0
                                }).format(val);
                              };

                              return (
                                <div className="grid grid-cols-2 gap-2 text-[9px] bg-[#F7F8F3]/80 p-2.5 rounded-xl border border-[#D6DED2]/30">
                                  <div>
                                    <span className="text-[#66736A] font-bold block mb-0.5">Harga Unit</span>
                                    <span className="font-mono font-black text-[#243028]">{formatVal(kprCard.price || 0)}</span>
                                  </div>
                                  <div>
                                    <span className="text-[#66736A] font-bold block mb-0.5">Plafond KPR</span>
                                    <span className="font-mono font-black text-[#4F6F52]">
                                      {displayPlafond > 0 ? formatVal(displayPlafond) : "Rp 0"}
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Status KPR & BI Checking */}
                            {(() => {
                              const colInfo = COLUMNS.find(c => c.id === kprCard.status);
                              const kprStatusLabel = colInfo?.label || kprCard.status;
                              return (
                                <div className="grid grid-cols-2 gap-2 text-[9px] font-bold">
                                  <div className="bg-[#F7F8F3]/70 p-2 rounded-xl border border-[#D6DED2]/30 flex flex-col gap-0.5">
                                    <span className="text-[8px] text-[#66736A] uppercase tracking-wider">Status KPR</span>
                                    <span className="text-[#4F6F52] font-black uppercase truncate">
                                      {kprStatusLabel}
                                    </span>
                                  </div>
                                  <div className="bg-[#F7F8F3]/70 p-2 rounded-xl border border-[#D6DED2]/30 flex flex-col gap-0.5">
                                    <span className="text-[8px] text-[#66736A] uppercase tracking-wider">BI Checking</span>
                                    <span className={`font-black uppercase truncate ${
                                      kprCard.biCheckStatus === "approved" 
                                        ? "text-emerald-700" 
                                        : kprCard.biCheckStatus.startsWith("rejected") 
                                        ? "text-rose-700" 
                                        : "text-amber-700"
                                    }`}>
                                      {kprCard.biCheckStatus === "approved" 
                                        ? "Approved" 
                                        : kprCard.biCheckStatus === "rejected_refund" 
                                        ? "Rejected (Rfd)" 
                                        : kprCard.biCheckStatus === "rejected_no_refund" 
                                        ? "Rejected (NoRfd)" 
                                        : kprCard.biCheckStatus === "partial"
                                        ? "Partial"
                                        : "Pending"}
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Progress Bar Kelengkapan Berkas & Bank Submission Counts */}
                            <div className="flex flex-col gap-2.5 bg-[#F7F8F3]/40 p-2.5 rounded-xl border border-dashed border-[#D6DED2]/50 text-[9px] font-bold">
                              {/* Progress Bar Kelengkapan Berkas */}
                              {(() => {
                                const uploadedCount = [hasKtp, hasNpwp, hasSlip, hasKk].filter(Boolean).length;
                                const percentage = (uploadedCount / 4) * 100;
                                return (
                                  <div className="space-y-1.5 w-full">
                                    <div className="flex justify-between items-center text-[9px] font-bold">
                                      <span className="text-[#66736A] uppercase tracking-wider">Kelengkapan Dokumen</span>
                                      <span className="text-[#4F6F52] font-mono">{uploadedCount}/4 ({percentage}%)</span>
                                    </div>
                                    <Progress value={percentage} className="h-1.5 w-full rounded-full [&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-track]]:bg-slate-100" />
                                  </div>
                                );
                              })()}

                              {/* Row 2: Bank count */}
                              <div className="flex items-center justify-between w-full pt-2 border-t border-[#D6DED2]/40">
                                <span className="text-[#66736A] font-extrabold uppercase tracking-wider text-[8px]">Pengajuan Bank</span>
                                <div className="flex items-center gap-1 font-bold text-[#66736A]">
                                  <Building className="h-3 w-3 text-[#A8B0AA] shrink-0" />
                                  <span className="text-[#243028]">{t("kpr_board.banks_count", { count: clientSubmissions.length })}</span>
                                </div>
                              </div>
                            </div>

                            {/* Milestone Tracker Mini */}
                            <div className="pt-2">
                              <KprMilestoneTracker 
                                data={{
                                  unitStatus: kprCard.unitStatus,
                                  kprStatus: kprCard.status,
                                  isReadyStock: kprCard.isReadyStock,
                                  readyStockSource: kprCard.readyStockSource || null,
                                  constructionProgress: kprCard.constructionProgress || 0
                                }}
                                orientation="horizontal"
                              />
                            </div>

                            {/* SLA WARNING ALERTS */}
                            {kprCard.status === "pemberkasan" && kprCard.slaDeadlineAt && (
                              <div className={`p-2 rounded-xl flex items-center gap-2 text-[9px] font-extrabold border ${
                                isSlaOverdue 
                                  ? "bg-[#D77A7A]/10 border-[#D77A7A]/30 text-[#D77A7A]" 
                                  : remainingDays <= 1 
                                  ? "bg-amber-50 border-amber-200 text-amber-700"
                                  : "bg-[#DDE8D8]/20 border-[#8FAF9A]/20 text-[#4F6F52]"
                              }`}>
                                {isSlaOverdue ? (
                                  <>
                                    <AlertTriangle className="h-3.5 w-3.5 text-[#D77A7A] shrink-0" />
                                    <span className="tracking-wide">{t("kpr_board.sla_overdue")} <span className="font-mono tabular-nums">{t("kpr_board.days", { days: Math.abs(remainingDays) })}</span></span>
                                  </>
                                ) : (
                                  <>
                                    <Clock className="h-3.5 w-3.5 shrink-0" />
                                    <span className="tracking-wide">{t("kpr_board.sla_remaining")} <span className="font-mono tabular-nums">{t("kpr_board.days", { days: remainingDays })}</span></span>
                                  </>
                                )}
                              </div>
                            )}

                            {/* INTEGRATED DIALOG & WHATSAPP QUICK-LINK */}
                            <div className="pt-2 border-t border-[#D6DED2]/30 flex gap-2" onClick={(e) => e.stopPropagation()}>
                              <a
                                href={`https://wa.me/${kprCard.customerPhone.replace(/[^0-9]/g, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="h-8.5 w-8.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700 border border-emerald-200/50 rounded-xl flex items-center justify-center transition shadow-sm shrink-0"
                                title="Hubungi WhatsApp"
                              >
                                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.73-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436.002 9.858-4.417 9.86-9.858.002-2.637-1.023-5.116-2.884-6.98C16.59 1.908 14.113.882 11.48.882c-5.435 0-9.856 4.418-9.858 9.858-.001 1.716.467 3.391 1.354 4.925l-.993 3.63 3.731-.979zm13.11-6.721c-.333-.167-1.972-.974-2.278-1.085-.306-.113-.53-.167-.752.167-.222.334-.861 1.085-1.055 1.306-.195.222-.389.25-.722.083-1.63-.82-2.802-1.424-3.92-3.35-.117-.203-.043-.314.04-.422.077-.101.167-.222.25-.334.083-.111.111-.19.167-.317.056-.128.028-.24-.014-.323-.042-.083-.752-1.812-1.03-2.482-.27-.655-.544-.567-.752-.578-.195-.01-.417-.012-.64-.012-.222 0-.583.083-.889.417-.306.334-1.167 1.141-1.167 2.784 0 1.642 1.194 3.224 1.361 3.447.167.222 2.35 3.587 5.69 5.032 2.782 1.202 3.411 1.054 3.99.988.583-.067 1.972-.806 2.25-1.584.278-.778.278-1.445.194-1.584-.083-.139-.306-.222-.639-.389z"/>
                                </svg>
                              </a>
                              <div className="flex-1">
                                <KprCardDetailDialog 
                                  kpr={kprCard}
                                  bankPartners={bankPartners}
                                  submissions={clientSubmissions}
                                  documents={clientDocs}
                                  accounts={accounts}
                                  canVerifyDocs={canVerifyDocs}
                                  canApproveHandover={canApproveHandover}
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-20 text-center text-[10px] text-[#A8B0AA] border-dashed border-2 border-[#D6DED2]/40 rounded-2xl bg-white/40 flex flex-col justify-center items-center px-4 space-y-2">
                    <Layers className="w-6 h-6 text-[#A8B0AA] opacity-60" />
                    <p className="font-bold">{t("kpr_board.empty")}</p>
                    <p className="text-[9px] text-[#66736A]/60 leading-normal">{t("kpr_board.empty_desc")}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* DETAILED VIEW SHEET */}
      {viewingKpr && (
        <KprDetailViewSheet
          kpr={viewingKpr}
          bankPartners={bankPartners}
          submissions={submissions.filter(s => s.kprProcessId === viewingKpr.id)}
          documents={documents.filter(d => d.customerId === viewingKpr.customerId)}
          open={!!viewingKpr}
          onOpenChange={(open) => !open && setViewingKpr(null)}
          canVerifyDocs={canVerifyDocs}
        />
      )}
    </div>
  );
}
