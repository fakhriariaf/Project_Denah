"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { 
  Building, 
  Clock, 
  Filter, 
  Layers,
  Search,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FolderOpen,
  User,
  Timer,
  CalendarClock
} from "lucide-react";
import KprCardDetailDialog from "./kpr-card-detail-dialog";
import KprDetailViewSheet from "./kpr-detail-view-sheet";
import { useI18n } from "@/lib/i18n";
import { getBankSubmissionStatusLabel, getKprStatusLabel, getSlaStatusLabel } from "@/lib/label-helpers";
import { updateKprStatusDirect } from "@/server/actions/marketing";
import { Progress } from "@/components/ui/progress";
import { KprMilestoneTracker } from "./kpr-milestone-tracker";
import type { KprSlaDisplayResult } from "@/server/services/kpr-sla/dual-read";
import {
  filterKprSlaCardsByStatus,
  aggregateKprSlaKpi,
  type KprSlaFilterValue,
  type KprSlaCardStatus,
} from "@/server/services/kpr-sla/selectors";

/** SLA filter options for the dropdown (Requirement 13.1) */
const SLA_FILTER_OPTIONS: { value: KprSlaFilterValue; label: string }[] = [
  { value: "semua_sla", label: "Semua SLA" },
  { value: "tepat_waktu", label: "Tepat Waktu" },
  { value: "perlu_dicek", label: "Perlu Dicek" },
  { value: "jatuh_tempo_hari_ini", label: "Jatuh Tempo Hari Ini" },
  { value: "terlambat", label: "Terlambat" },
  { value: "belum_dimulai", label: "Belum Dimulai" },
  { value: "tidak_berlaku", label: "Tidak Berlaku" },
];

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

function getKprStageNote(rawNotes: string | null, stage: string): string | null {
  if (!rawNotes?.trim()) return null;

  try {
    const parsed = JSON.parse(rawNotes) as Record<string, unknown>;
    const stageNote = parsed[stage];
    return typeof stageNote === "string" && stageNote.trim()
      ? stageNote.trim()
      : null;
  } catch {
    return rawNotes.trim();
  }
}

export function KprShell({
  initialKpr,
  bankPartners,
  submissions,
  documents,
  accounts = [],
  canVerifyDocs = false,
  canApproveHandover = false,
  slaDisplayMap = {},
  slaError = null,
}: {
  initialKpr: KprCard[];
  bankPartners: BankPartner[];
  submissions: BankSubmission[];
  documents: CustomerDocument[];
  accounts?: any[];
  canVerifyDocs?: boolean;
  canApproveHandover?: boolean;
  slaDisplayMap?: Record<string, KprSlaDisplayResult>;
  slaError?: string | null;
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

  // Preventive drop-target validation used to dim invalid columns while dragging.
  // Mirrors the (authoritative) guards in handleDrop; it is a UX projection only.
  const STAGE_ORDER = ["bi_checking", "pemberkasan", "proses_bank", "offering", "approved", "akad"];
  const TERMINAL_COLUMNS = ["realisasi", "physical_waiting", "handover_waiting", "bast_developer", "handover_done"];
  const getInvalidDropMessage = (card: KprCard, targetStatus: string): string | null => {
    if (TERMINAL_COLUMNS.includes(targetStatus)) {
      return "Tahap ini dikelola melalui aksi pada detail KPR dan tidak dapat diubah dengan geser kartu.";
    }
    if (card.status === targetStatus) {
      return `Pengajuan sudah berada pada tahap ${getKprStatusLabel(targetStatus)}.`;
    }
    if (card.status === "rejected") {
      return "Pengajuan yang sudah ditolak bersifat terminal dan tidak dapat dipindahkan kembali melalui Kanban.";
    }
    if (card.status === "realisasi" || card.unitStatus === "menunggu_serah_terima" || card.unitStatus === "handover_complete" || card.unitStatus === "sold") {
      return "Tahap pasca-Realisasi dan Serah Terima dikelola melalui aksi pada detail KPR.";
    }
    if (targetStatus === "rejected") {
      return card.status === "approved"
        ? "Pengajuan yang sudah Disetujui tidak dapat dipindahkan ke Ditolak karena tahap persetujuan bersifat satu arah."
        : null;
    }

    const currentIndex = STAGE_ORDER.indexOf(card.status);
    const newIndex = STAGE_ORDER.indexOf(targetStatus);
    if (currentIndex === -1 || newIndex === -1) {
      return "Perpindahan tahap KPR ini tidak tersedia melalui Kanban.";
    }
    if (newIndex < currentIndex) {
      if (card.status === "approved" || card.status === "realisasi") {
        return "Pengajuan yang sudah Disetujui tidak dapat dikembalikan ke tahap sebelumnya.";
      }
      return null;
    }
    if (newIndex !== currentIndex + 1) {
      const nextStage = STAGE_ORDER[currentIndex + 1];
      return `Alur KPR harus bertahap. Lanjutkan lebih dulu ke ${getKprStatusLabel(nextStage)}.`;
    }
    return null;
  };
  const isValidDropTarget = (card: KprCard, targetStatus: string): boolean => {
    if (TERMINAL_COLUMNS.includes(targetStatus)) return false;
    if (card.status === targetStatus) return false;
    // Post-realisasi / handover cards are not draggable at all.
    if (card.status === "realisasi" || card.unitStatus === "menunggu_serah_terima" || card.unitStatus === "handover_complete" || card.unitStatus === "sold") return false;
    // "rejected" is reachable from any active stage except approved.
    if (targetStatus === "rejected") return card.status !== "approved";
    const currentIndex = STAGE_ORDER.indexOf(card.status);
    const newIndex = STAGE_ORDER.indexOf(targetStatus);
    if (currentIndex === -1 || newIndex === -1) return false;
    // Backward allowed (guarded by revision-notes prompt), forward only +1 stage.
    if (newIndex < currentIndex) {
      // approved/realisasi are one-way — cannot go backward.
      if (card.status === "approved" || card.status === "realisasi") return false;
      return true;
    }
    return newIndex === currentIndex + 1;
  };

  // States
  const [projectFilter, setProjectFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [docFilter, setDocFilter] = useState("all");
  const [slaFilter, setSlaFilter] = useState<KprSlaFilterValue>("semua_sla");
  const [viewingKpr, setViewingKpr] = useState<KprCard | null>(null);

  // Drag and Drop States
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggedOverColId, setDraggedOverColId] = useState<string | null>(null);

  // Get unique project names for the filter
  const projects = Array.from(new Set(initialKpr.map(k => k.projectName)));

  // ──────────────────────────────────────────────────────────────────────
  // SLA Status derivation (single source of truth)
  // Uses slaDisplayMap (from server via page.tsx / task 5.1) to derive
  // per-card SLA status. The map is pre-computed server-side.
  // ──────────────────────────────────────────────────────────────────────
  const cardsWithSla = useMemo(() => {
    return initialKpr.map((k) => {
      const display = slaDisplayMap[k.id];
      // Map the display status to KprSlaCardStatus for filter/KPI
      let slaStatus: KprSlaCardStatus;
      if (!display) {
        // Fallback: no SLA data available for this card
        slaStatus = "belum_dimulai";
      } else {
        switch (display.status) {
          case "tepat_waktu":
          case "perlu_dicek":
          case "jatuh_tempo_hari_ini":
          case "terlambat":
          case "belum_dimulai":
          case "tidak_berlaku":
          case "data_legacy_tidak_valid":
            slaStatus = display.status as KprSlaCardStatus;
            break;
          case "selesai_tepat_waktu":
            slaStatus = "tepat_waktu";
            break;
          case "selesai_terlambat":
            slaStatus = "terlambat";
            break;
          default:
            slaStatus = "belum_dimulai";
        }
      }
      return { ...k, slaStatus };
    });
  }, [initialKpr, slaDisplayMap]);

  // ──────────────────────────────────────────────────────────────────────
  // Single-source filtering chain (Req 14.8 — KPI consistent with cards)
  // 1. Apply project/search/doc filters → "base filtered"
  // 2. Compute KPI from base filtered set
  // 3. Apply SLA filter for visible cards
  // ──────────────────────────────────────────────────────────────────────

  // Step 1: Project + Search + Document filters (base)
  const baseFilteredCards = useMemo(() => {
    return cardsWithSla.filter(k => {
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

      return true;
    });
  }, [cardsWithSla, projectFilter, searchQuery, docFilter]);

  // Step 2: KPI aggregation from base filtered (before SLA filter applied)
  const kpiCounts = useMemo(() => {
    return aggregateKprSlaKpi(baseFilteredCards);
  }, [baseFilteredCards]);

  // Step 3: Apply SLA filter on top for visible cards
  const filteredKpr = useMemo(() => {
    return filterKprSlaCardsByStatus(baseFilteredCards, slaFilter);
  }, [baseFilteredCards, slaFilter]);

  // Legacy KPI (kept for backward compat with existing cards)
  const projectScopedKpr = initialKpr.filter(k => projectFilter === "all" || k.projectName === projectFilter);
  const kpiIncompleteDocs = projectScopedKpr.filter(k => k.documentStatus === "incomplete").length;
  const kpiBankApproved = projectScopedKpr.filter(k => 
    submissions.some(sub => sub.kprProcessId === k.id && sub.status === "approved")
  ).length;

  // HTML5 Drag Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    const card = initialKpr.find(k => k.id === id);
    if (card?.status === "rejected") {
      e.preventDefault();
      alert("Pengajuan KPR yang sudah Ditolak bersifat terminal dan tidak dapat dipindahkan kembali melalui Kanban.");
      return;
    }
    if (card && (card.status === "realisasi" || card.unitStatus === "menunggu_serah_terima" || card.unitStatus === "handover_complete" || card.unitStatus === "sold")) {
      e.preventDefault();
      alert("Tahapan pasca-Realisasi dan Serah Terima dikelola melalui Tombol Aksi di Detail Kelola KPR, bukan dengan geser kartu.");
      return;
    }
    setDraggingId(id);
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const resetDragState = () => {
    setDraggingId(null);
    setDraggedOverColId(null);
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
    const id = e.dataTransfer.getData("text/plain") || draggingId;
    resetDragState();
    if (!id) return;

    if (TERMINAL_COLUMNS.includes(targetStatus)) {
      alert("Tahapan ini tidak dapat diubah dengan geser kartu.\n\n• Realisasi Dana → gunakan Form Realisasi di 'Kelola Berkas KPR'\n• Cek Fisik / Serah Terima → dikelola otomatis oleh sistem");
      setDraggingId(null);
      return;
    }

    const targetCard = initialKpr.find(k => k.id === id);
    if (!targetCard) return;

    const invalidDropMessage = getInvalidDropMessage(targetCard, targetStatus);
    if (invalidDropMessage) {
      alert(`Status KPR tidak dapat dipindahkan:\n\n${invalidDropMessage}`);
      return;
    }

    // Check for unverified files — only mandatory KPR docs (KTP, NPWP, Slip Gaji, KK)
    // Supporting docs (BAST, SPJB, kpr_doc) are uploaded AFTER akad/realisasi — do NOT gate here
    const MANDATORY_DOC_TYPES = ["ktp", "npwp", "slip_gaji", "kk"];
    const allClientDocs = documents.filter(d => d.customerId === targetCard.customerId);
    const mandatoryClientDocs = allClientDocs.filter(d => MANDATORY_DOC_TYPES.includes(d.documentType));
    const hasUnverifiedDocs = mandatoryClientDocs.some(d => d.status !== "verified");

    if (targetStatus !== "rejected" && (hasUnverifiedDocs || mandatoryClientDocs.length === 0)) {
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
    const currentIndex = STAGE_ORDER.indexOf(targetCard.status);
    const newIndex = STAGE_ORDER.indexOf(targetStatus);

    // Sequential-forward guard: a pipeline card may only advance ONE stage at a
    // time. Skipping stages (e.g. bi_checking → approved) is not allowed even if
    // per-stage prerequisites happen to be satisfied. Backward moves and moves to
    // the "rejected" column (outside STAGE_ORDER) are handled by their own guards.
    if (currentIndex !== -1 && newIndex !== -1 && newIndex > currentIndex + 1) {
      const nextColName = COLUMNS.find(c => c.id === STAGE_ORDER[currentIndex + 1])?.label || STAGE_ORDER[currentIndex + 1];
      alert(
        "Gagal memindahkan status KPR:\n\n" +
        "Alur KPR harus dijalankan bertahap. Anda tidak dapat melompati tahap.\n\n" +
        `Lanjutkan dulu ke tahap berikutnya: "${nextColName}".`
      );
      setDraggingId(null);
      return;
    }

    let revisionNotes = "";
    if (targetStatus === "rejected") {
      const rejectionReason = prompt(
        `Pengajuan KPR ${targetCard.customerName} akan ditolak.\n\nMasukkan alasan penolakan agar tindak lanjut pembatalan atau refund dapat dipahami oleh pengguna lain:`
      );
      if (rejectionReason === null) return;
      if (!rejectionReason.trim()) {
        alert("Alasan penolakan KPR wajib diisi.");
        return;
      }
      revisionNotes = rejectionReason.trim();
    } else if (currentIndex !== -1 && newIndex !== -1 && newIndex < currentIndex) {
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
      resetDragState();
    }
  };

  return (
    <div className="space-y-6">
      {/* ── PREMIUM HEADER ── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#DDE8D8]/70 via-white/95 to-[#DDE8D8]/40 border border-border shadow-sage p-6">
        <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-[#8FAF9A]/10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 h-20 w-20 rounded-full bg-primary/8 blur-xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center shadow-[0_4px_12px_rgba(79,111,82,0.3)] shrink-0">
              <Layers className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider">{t("kpr_board.module_name")}</span>
              </div>
              <h2 className="text-2xl font-black text-foreground tracking-tight">{t("kpr_board.title")}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{t("kpr_board.subtitle")}</p>
            </div>
          </div>

          {/* Project Filter */}
          <div className="flex items-center gap-2.5 bg-white/90 backdrop-blur-sm border border-border/60 px-4 py-2 rounded-2xl shadow-sm self-end md:self-center">
            <Filter className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:inline">{t("kpr_board.filter_project")}</span>
            <Select value={projectFilter} onValueChange={(val: string | null) => setProjectFilter(val || "all")}>
              <SelectTrigger className="w-[180px] h-8 text-xs bg-card border-input rounded-xl focus:ring-ring/20">
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

      {/* ── SLA KPI METRICS BAR ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* KPI: Tepat Waktu */}
        <Card className="border-border bg-card rounded-2xl shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">Tepat Waktu</span>
              <span className="text-2xl font-black text-primary tabular-nums block">{kpiCounts.tepatWaktu}</span>
            </div>
            <div className="h-10 w-10 bg-secondary/50 text-primary rounded-xl flex items-center justify-center">
              <CheckCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* KPI: Perlu Dicek */}
        <Card className="border-border bg-card rounded-2xl shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">Perlu Dicek</span>
              <span className="text-2xl font-black text-amber-700 tabular-nums block">{kpiCounts.perluDicek}</span>
            </div>
            <div className="h-10 w-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* KPI: Jatuh Tempo Hari Ini */}
        <Card className="border-border bg-card rounded-2xl shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">Jatuh Tempo</span>
              <span className="text-2xl font-black text-orange-700 tabular-nums block">{kpiCounts.jatuhTempoHariIni}</span>
            </div>
            <div className="h-10 w-10 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center">
              <CalendarClock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* KPI: Terlambat */}
        <Card className="border-border bg-card rounded-2xl shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">Terlambat</span>
              <span className="text-2xl font-black text-rose-700 tabular-nums block">{kpiCounts.terlambat}</span>
            </div>
            <div className="h-10 w-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
              <Timer className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* KPI: Total KPR Aktif (excl. terminal SLA) */}
        <Card className="border-border bg-card rounded-2xl shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block">Total KPR Aktif</span>
              <span className="text-2xl font-black text-foreground tabular-nums block">{kpiCounts.totalAktif}</span>
            </div>
            <div className="h-10 w-10 bg-secondary/50 text-primary rounded-xl flex items-center justify-center">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advanced controls and filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-card p-3.5 rounded-2xl border border-border shadow-sm">
        {/* Real-time search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
          <Input
            placeholder={t("kpr_board.search_ph")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs border-border rounded-xl focus-visible:ring-ring/30 focus-visible:border-primary/50"
          />
        </div>

        {/* Doc checklist filter */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-muted-foreground uppercase whitespace-nowrap">{t("kpr_board.filter_doc")}</span>
          <Select value={docFilter} onValueChange={(val: string | null) => setDocFilter(val || "all")}>
            <SelectTrigger className="w-[140px] h-9 text-xs border-border rounded-xl bg-card">
              <SelectValue>
                {docFilter === "all"
                  ? t("kpr_board.doc_all")
                  : docFilter === "complete"
                    ? t("kpr_board.doc_complete")
                    : t("kpr_board.doc_incomplete")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all" className="text-xs">{t("kpr_board.doc_all")}</SelectItem>
              <SelectItem value="complete" className="text-xs">{t("kpr_board.doc_complete")}</SelectItem>
              <SelectItem value="incomplete" className="text-xs">{t("kpr_board.doc_incomplete")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* SLA Status filter (7 options — Req 13.1) */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-muted-foreground uppercase whitespace-nowrap">{t("kpr_board.filter_sla")}</span>
          <Select value={slaFilter} onValueChange={(val: string | null) => setSlaFilter((val as KprSlaFilterValue) || "semua_sla")}>
            <SelectTrigger className="w-[180px] h-9 text-xs border-border rounded-xl bg-card">
              <SelectValue>
                {SLA_FILTER_OPTIONS.find(o => o.value === slaFilter)?.label ?? "Semua SLA"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {SLA_FILTER_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Empty state for SLA filter (Req 13.6) */}
      {filteredKpr.length === 0 && slaFilter !== "semua_sla" && (
        <div className="rounded-2xl border-2 border-dashed border-border/50 bg-card p-8 text-center">
          <Filter className="mx-auto h-8 w-8 text-muted-foreground/50 mb-3" />
          <p className="text-sm font-bold text-muted-foreground">Tidak ada proses KPR yang sesuai dengan filter</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Coba ubah filter SLA atau perumahan untuk melihat data KPR lainnya.
          </p>
        </div>
      )}

      {/* SLA Error Banner (non-destructive, does not block cards) */}
      {slaError && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-xs text-amber-700">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          <span className="font-semibold">{slaError}</span>
          <span className="text-amber-600/70">— Data SLA mungkin tidak ditampilkan pada beberapa kartu.</span>
        </div>
      )}

      {/* Pipeline kanban board */}
      <div className="flex gap-5 overflow-x-auto pb-6 items-start scrollbar-thin scrollbar-thumb-[#8FAF9A]/30 scrollbar-track-[#F7F8F3] w-full">
        {COLUMNS.map((col) => {
          const colCards = filteredKpr.filter((k) => getCardKanbanColumn(k) === col.id);
          const isOver = draggedOverColId === col.id;
          const draggingCard = draggingId ? initialKpr.find((k) => k.id === draggingId) ?? null : null;
          const isInvalidTarget = Boolean(draggingCard) && !isValidDropTarget(draggingCard as KprCard, col.id);

          return (
            <div 
              key={col.id} 
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
              aria-disabled={isInvalidTarget}
              className={`p-3.5 rounded-[26px] flex flex-col h-[calc(100vh-330px)] min-h-[540px] w-[320px] shrink-0 shadow-sm transition-all duration-200 ${
                isInvalidTarget
                  ? "opacity-65 border border-dashed border-border bg-muted/20 cursor-not-allowed"
                  : isOver
                    ? "bg-secondary/60 border-2 border-dashed border-primary scale-[1.01]"
                    : "bg-gradient-to-b from-secondary/35 to-card border border-primary/15 hover:shadow-sage-md"
              }`}
            >
              {/* Column Header */}
              <div className="p-3 rounded-2xl border border-primary/15 flex items-center justify-between font-bold text-xs mb-3 shadow-sm bg-card shrink-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${col.marker}`} />
                  <span className="uppercase tracking-wider font-extrabold text-foreground">{col.label}</span>
                </div>
                <Badge className="bg-secondary/60 text-primary border border-primary/15 font-mono font-bold text-[10px] px-2 py-0.5 rounded-md">
                  {colCards.length}
                </Badge>
              </div>

              {isOver && isInvalidTarget && draggingCard && (
                <div
                  role="status"
                  className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[9px] font-semibold leading-relaxed text-amber-800"
                >
                  {getInvalidDropMessage(draggingCard as KprCard, col.id)}
                </div>
              )}

              {/* Cards List */}
              <div className="space-y-3.5 flex-1 overflow-y-auto pr-1.5 scrollbar-thin scrollbar-thumb-[#D6DED2]">
                {colCards.length > 0 ? (
                  colCards.map((kprCard) => {
                    const clientSubmissions = submissions.filter(sub => sub.kprProcessId === kprCard.id);
                    const clientDocs = documents.filter(doc => doc.customerId === kprCard.customerId);

                    // ── SLA Display from pre-computed server data ──
                    const slaDisplay = slaDisplayMap[kprCard.id];
                    const slaStatus = slaDisplay?.status ?? "belum_dimulai";
                    const isSlaOverdue = slaStatus === "terlambat";
                    const isSlaDueSoon = slaStatus === "perlu_dicek" || slaStatus === "jatuh_tempo_hari_ini";

                    // Derive remaining days for description text (legacy compat)
                    let remainingDays = 0;
                    if (slaDisplay?.deadline) {
                      const limit = new Date(slaDisplay.deadline);
                      remainingDays = Math.ceil((limit.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    }

                    // SLA description and badge label from helper
                    const slaBadgeLabel = getSlaStatusLabel(slaStatus);
                    const slaDescription = slaStatus === "belum_dimulai"
                      ? "Belum Dimulai"
                      : slaStatus === "tidak_berlaku"
                        ? "Tidak Berlaku"
                        : slaStatus === "data_legacy_tidak_valid"
                          ? "Data SLA Lama Tidak Valid"
                          : isSlaOverdue
                            ? `Terlambat ${Math.abs(remainingDays)} hari`
                            : slaStatus === "jatuh_tempo_hari_ini"
                              ? "Jatuh Tempo Hari Ini"
                              : `${Math.max(remainingDays, 0)} hari tersisa`;
                    const isLegacySource = slaDisplay?.source === "legacy";
                    const slaTargetLabel = slaDisplay?.targetWorkingDays
                      ? `Target: ${slaDisplay.targetWorkingDays} hari kerja`
                      : null;

                    // Checklist Documents uploaded indicators (KTP, NPWP, Slip Gaji, KK)
                    const hasKtp = clientDocs.some(d => d.documentType === "ktp" && d.status !== "rejected");
                    const hasNpwp = clientDocs.some(d => d.documentType === "npwp" && d.status !== "rejected");
                    const hasSlip = clientDocs.some(d => d.documentType === "slip_gaji" && d.status !== "rejected");
                    const hasKk = clientDocs.some(d => d.documentType === "kk" && d.status !== "rejected");
                    const uploadedCount = [hasKtp, hasNpwp, hasSlip, hasKk].filter(Boolean).length;
                    const docsComplete = uploadedCount === 4;
                    const primarySubmission =
                      clientSubmissions.find(sub => sub.status === "approved" || sub.status === "offering") ??
                      clientSubmissions[0];
                    const primaryBank = primarySubmission
                      ? bankPartners.find(b => b.id === primarySubmission.bankPartnerId)?.name
                      : null;
                    const colInfo = COLUMNS.find(c => c.id === kprCard.status);
                    const kprStatusLabel = colInfo?.label ?? getKprStatusLabel(kprCard.status);
                    const isRejected = kprCard.status === "rejected";
                    const rejectionReason = isRejected
                      ? getKprStageNote(kprCard.bankNotes, "rejected")
                      : null;
                    const isCardDraggable = !isRejected &&
                      kprCard.status !== "realisasi" &&
                      !["menunggu_serah_terima", "handover_complete", "sold"].includes(kprCard.unitStatus);

                    return (
                      <div
                        key={kprCard.id}
                        draggable={isCardDraggable}
                        onDragStart={(e) => handleDragStart(e, kprCard.id)}
                        onDragEnd={resetDragState}
                      >
                        <Card 
                          onClick={() => setViewingKpr(kprCard)}
                          className={`cursor-pointer active:scale-[0.99] shadow-[0_10px_24px_rgba(79,111,82,0.09)] bg-gradient-to-b from-white to-secondary/20 border rounded-[22px] relative transition-all duration-200 group hover:shadow-sage-md hover:-translate-y-0.5 ${
                            isRejected
                              ? "border-rose-300 bg-gradient-to-b from-rose-50/70 to-white"
                              : isSlaOverdue
                              ? "shadow-[0_0_15px_rgba(215,122,122,0.25)] border-[#D77A7A]/70" 
                              : "border-primary/20 hover:border-primary/45"
                          }`}
                        >
                          {/* SLA Overdue Bar indicator */}
                          {isSlaOverdue && (
                            <div className="absolute top-0 inset-x-0 h-1 rounded-t-2xl bg-gradient-to-r from-[#D77A7A] to-[#E8A0A8]" />
                          )}

                          <CardContent className="p-4 space-y-3.5">
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex min-w-0 flex-1 items-start gap-3">
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/80 text-white shadow-[0_4px_10px_rgba(79,111,82,0.18)] ring-4 ring-secondary/70">
                                    <User className="h-5 w-5" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <h4 className="font-extrabold text-foreground group-hover:text-primary transition text-[13px] truncate leading-tight">
                                      {kprCard.customerName}
                                    </h4>
                                    <p className="text-[10px] text-primary/75 font-semibold mt-1 truncate">
                                      {kprCard.projectName}
                                    </p>
                                  </div>
                                </div>
                                <Badge variant="outline" className="font-mono font-bold bg-secondary/70 border-primary/25 text-primary text-[10px] px-2 py-0.5 rounded-lg shrink-0">
                                  {kprCard.unitCode}
                                </Badge>
                              </div>

                              <div className="text-[10px]">
                                <span className="block font-mono text-muted-foreground truncate">
                                  {kprCard.bookingNumber}
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                              <div className="rounded-xl border border-primary/20 bg-secondary/35 px-2 py-2 text-center">
                                <CheckCircle className="mx-auto mb-1 h-4 w-4 text-primary" />
                                <span className="block text-[8px] uppercase tracking-wider text-foreground font-extrabold">BI Checking</span>
                                <span className={`mt-1 inline-flex rounded-md px-1.5 py-0.5 font-black ${
                                  kprCard.biCheckStatus === "approved" 
                                    ? "bg-secondary text-primary" 
                                    : kprCard.biCheckStatus.startsWith("rejected") 
                                    ? "bg-rose-50 text-rose-700" 
                                    : "bg-amber-50 text-amber-700"
                                }`}>
                                  {getBankSubmissionStatusLabel(kprCard.biCheckStatus)}
                                </span>
                              </div>
                              <div className="rounded-xl border border-primary/20 bg-secondary/35 px-2 py-2 text-center">
                                <FolderOpen className="mx-auto mb-1 h-4 w-4 text-primary" />
                                <span className="block text-[8px] uppercase tracking-wider text-foreground font-extrabold">Dokumen</span>
                                <span className={`mt-1 inline-flex rounded-md px-1.5 py-0.5 font-mono font-black ${docsComplete ? "bg-secondary text-primary" : "bg-amber-50 text-amber-700"}`}>
                                  {uploadedCount}/4
                                </span>
                              </div>
                              <div className="rounded-xl border border-primary/20 bg-secondary/35 px-2 py-2 text-center">
                                <Building className="mx-auto mb-1 h-4 w-4 text-primary" />
                                <span className="block text-[8px] uppercase tracking-wider text-foreground font-extrabold">Bank</span>
                                <span className="mt-1 inline-flex rounded-md bg-secondary px-1.5 py-0.5 font-mono font-black text-primary">
                                  {clientSubmissions.length}
                                </span>
                              </div>
                            </div>
                            <div className={`rounded-xl border px-2.5 py-2.5 text-[10px] ${
                              slaStatus === "belum_dimulai" || slaStatus === "tidak_berlaku"
                                ? "border-slate-200 bg-slate-50/50 text-slate-600"
                                : slaStatus === "data_legacy_tidak_valid"
                                  ? "border-slate-200 bg-slate-50/50 text-slate-500"
                                  : isSlaOverdue
                                    ? "border-rose-200 bg-rose-50 text-rose-700"
                                    : slaStatus === "jatuh_tempo_hari_ini"
                                      ? "border-orange-200 bg-orange-50 text-orange-700"
                                      : isSlaDueSoon
                                        ? "border-amber-200 bg-amber-50 text-amber-700"
                                        : "border-primary/25 bg-secondary/35 text-primary"
                            }`}>
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                                    slaStatus === "belum_dimulai" || slaStatus === "tidak_berlaku" || slaStatus === "data_legacy_tidak_valid"
                                      ? "bg-slate-100 text-slate-500"
                                      : isSlaOverdue
                                        ? "bg-rose-100 text-rose-600"
                                        : slaStatus === "jatuh_tempo_hari_ini"
                                          ? "bg-orange-100 text-orange-600"
                                          : isSlaDueSoon
                                            ? "bg-amber-100 text-amber-600"
                                            : "bg-primary/15 text-primary"
                                  }`}>
                                    <Clock className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <p className="font-extrabold leading-tight">SLA Tahap</p>
                                      {isLegacySource && (
                                        <span className="inline-flex items-center gap-0.5 rounded border border-muted-foreground/20 bg-muted/50 px-1 py-0 text-[8px] font-bold text-muted-foreground">
                                          Legacy
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-0.5 font-semibold text-muted-foreground truncate">
                                      {slaDescription}
                                    </p>
                                    {slaTargetLabel && (
                                      <p className="mt-0.5 font-medium text-muted-foreground/70 text-[9px] tabular-nums">
                                        {slaTargetLabel}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <span className={`shrink-0 rounded-lg border px-2 py-1 font-bold text-[9px] ${
                                  slaStatus === "belum_dimulai"
                                    ? "border-slate-200 bg-slate-50 text-slate-600"
                                    : slaStatus === "tidak_berlaku"
                                      ? "border-slate-200 bg-slate-50 text-slate-500"
                                      : slaStatus === "data_legacy_tidak_valid"
                                        ? "border-slate-200 bg-slate-50 text-slate-500"
                                        : isSlaOverdue
                                          ? "border-rose-200 bg-white/70 text-rose-700"
                                          : slaStatus === "jatuh_tempo_hari_ini"
                                            ? "border-orange-200 bg-white/70 text-orange-700"
                                            : isSlaDueSoon
                                              ? "border-amber-200 bg-white/70 text-amber-700"
                                              : "border-primary/20 bg-white/70 text-primary"
                                }`}>
                                  {slaBadgeLabel}
                                </span>
                              </div>
                            </div>

                            <div className="rounded-xl border border-primary/20 bg-card px-2.5 py-2 text-[10px]">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex min-w-0 flex-1 items-center gap-2">
                                  <Building className="h-4 w-4 shrink-0 text-primary" />
                                  <span className="font-extrabold text-foreground truncate" title={primaryBank || "Belum ada"}>
                                    {primaryBank || "Belum ada"}
                                  </span>
                                </div>
                                <span className="text-primary text-base leading-none">›</span>
                              </div>
                            </div>

                            {isRejected && (
                              <div className="rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-2.5 text-rose-800">
                                <div className="flex items-start gap-2">
                                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-extrabold">Pengajuan KPR Ditolak</p>
                                    <p className="mt-1 text-[9px] font-medium leading-relaxed text-rose-700">
                                      {rejectionReason || "Alasan penolakan belum tercatat pada data lama."}
                                    </p>
                                    <p className="mt-1.5 text-[8px] font-semibold text-rose-600">
                                      Status terminal — tindak lanjut pembatalan atau refund dilakukan melalui detail booking.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                            <div className="hidden">
                            {/* Status Bank Rekanan Terkait */}
                              {(() => {
                                const submittedBanks = clientSubmissions.map(sub => {
                                  const bp = bankPartners.find(b => b.id === sub.bankPartnerId);
                                  return bp?.name;
                                }).filter(Boolean);

                                return submittedBanks.length > 0 ? (
                                  <div className="flex flex-wrap gap-1 pt-1 border-t border-border/20">
                                    {submittedBanks.map((bankName, idx) => (
                                      <Badge key={idx} variant="outline" className="bg-secondary/50 text-primary border-border/60 text-[8px] font-extrabold px-1.5 py-0.5 rounded-md shrink-0 flex items-center gap-1">
                                        <span>🏦</span>
                                        <span>{bankName}</span>
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-[8px] text-muted-foreground/70 font-bold pt-1 border-t border-border/20">
                                    Belum Ada Bank Rekanan
                                  </div>
                                );
                              })()}
                            </div>

                            {/* Ringkasan Finansial Presisi (Harga vs Plafond) */}
                            <div className="hidden">
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
                                <div className="grid grid-cols-2 gap-2 text-[9px] bg-muted/30/80 p-2.5 rounded-xl border border-border/30">
                                  <div>
                                    <span className="text-muted-foreground font-bold block mb-0.5">Harga Unit</span>
                                    <span className="font-mono font-black text-foreground">{formatVal(kprCard.price || 0)}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground font-bold block mb-0.5">Plafond KPR</span>
                                    <span className="font-mono font-black text-primary">
                                      {displayPlafond > 0 ? formatVal(displayPlafond) : "Rp 0"}
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Status KPR & BI Checking */}
                            {(() => {
                              const colInfo = COLUMNS.find(c => c.id === kprCard.status);
                              const kprStatusLabel = colInfo?.label ?? getKprStatusLabel(kprCard.status);
                              return (
                                <div className="grid grid-cols-2 gap-2 text-[9px] font-bold">
                                  <div className="bg-muted/30/70 p-2 rounded-xl border border-border/30 flex flex-col gap-0.5">
                                    <span className="text-[8px] text-muted-foreground uppercase tracking-wider">Status KPR</span>
                                    <span className="text-primary font-black uppercase truncate">
                                      {kprStatusLabel}
                                    </span>
                                  </div>
                                  <div className="bg-muted/30/70 p-2 rounded-xl border border-border/30 flex flex-col gap-0.5">
                                    <span className="text-[8px] text-muted-foreground uppercase tracking-wider">BI Checking</span>
                                    <span className={`font-black uppercase truncate ${
                                      kprCard.biCheckStatus === "approved" 
                                        ? "text-emerald-700" 
                                        : kprCard.biCheckStatus.startsWith("rejected") 
                                        ? "text-rose-700" 
                                        : "text-amber-700"
                                    }`}>
                                      {getBankSubmissionStatusLabel(kprCard.biCheckStatus)}
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Progress Bar Kelengkapan Berkas & Bank Submission Counts */}
                            <div className="flex flex-col gap-2.5 bg-muted/30/40 p-2.5 rounded-xl border border-dashed border-border/50 text-[9px] font-bold">
                              {/* Progress Bar Kelengkapan Berkas */}
                              {(() => {
                                const uploadedCount = [hasKtp, hasNpwp, hasSlip, hasKk].filter(Boolean).length;
                                const percentage = (uploadedCount / 4) * 100;
                                return (
                                  <div className="space-y-1.5 w-full">
                                    <div className="flex justify-between items-center text-[9px] font-bold">
                                      <span className="text-muted-foreground uppercase tracking-wider">Kelengkapan Dokumen</span>
                                      <span className="text-primary font-mono">{uploadedCount}/4 ({percentage}%)</span>
                                    </div>
                                    <Progress value={percentage} className="h-1.5 w-full rounded-full [&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-track]]:bg-slate-100" />
                                  </div>
                                );
                              })()}

                              {/* Row 2: Bank count */}
                              <div className="flex items-center justify-between w-full pt-2 border-t border-border/40">
                                <span className="text-muted-foreground font-extrabold uppercase tracking-wider text-[8px]">Pengajuan Bank</span>
                                <div className="flex items-center gap-1 font-bold text-muted-foreground">
                                  <Building className="h-3 w-3 text-muted-foreground/70 shrink-0" />
                                  <span className="text-foreground">{t("kpr_board.banks_count", { count: clientSubmissions.length })}</span>
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
                                  : "bg-secondary/20 border-primary/20 text-primary"
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
                            </div>

                            <div className="pt-2 border-t border-border/30" onClick={(e) => e.stopPropagation()}>
                              <a
                                href={`https://wa.me/${kprCard.customerPhone.replace(/[^0-9]/g, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hidden"
                                title="Hubungi WhatsApp"
                              >
                                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.73-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436.002 9.858-4.417 9.86-9.858.002-2.637-1.023-5.116-2.884-6.98C16.59 1.908 14.113.882 11.48.882c-5.435 0-9.856 4.418-9.858 9.858-.001 1.716.467 3.391 1.354 4.925l-.993 3.63 3.731-.979zm13.11-6.721c-.333-.167-1.972-.974-2.278-1.085-.306-.113-.53-.167-.752.167-.222.334-.861 1.085-1.055 1.306-.195.222-.389.25-.722.083-1.63-.82-2.802-1.424-3.92-3.35-.117-.203-.043-.314.04-.422.077-.101.167-.222.25-.334.083-.111.111-.19.167-.317.056-.128.028-.24-.014-.323-.042-.083-.752-1.812-1.03-2.482-.27-.655-.544-.567-.752-.578-.195-.01-.417-.012-.64-.012-.222 0-.583.083-.889.417-.306.334-1.167 1.141-1.167 2.784 0 1.642 1.194 3.224 1.361 3.447.167.222 2.35 3.587 5.69 5.032 2.782 1.202 3.411 1.054 3.99.988.583-.067 1.972-.806 2.25-1.584.278-.778.278-1.445.194-1.584-.083-.139-.306-.222-.639-.389z"/>
                                </svg>
                              </a>
                              <div>
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
                  <div className="py-20 text-center text-[10px] text-muted-foreground/70 border-dashed border-2 border-border/40 rounded-2xl bg-white/40 flex flex-col justify-center items-center px-4 space-y-2">
                    <Layers className="w-6 h-6 text-muted-foreground/70 opacity-60" />
                    <p className="font-bold">
                      {col.id === "rejected" ? "Belum Ada Pengajuan Ditolak" : t("kpr_board.empty")}
                    </p>
                    <p className="text-[9px] text-muted-foreground/60 leading-normal">
                      {col.id === "rejected"
                        ? "Pengajuan yang ditolak sebelum tahap Disetujui akan muncul di kolom ini."
                        : t("kpr_board.empty_desc")}
                    </p>
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
