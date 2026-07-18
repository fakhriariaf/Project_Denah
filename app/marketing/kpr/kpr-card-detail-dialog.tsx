"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Eye, 
  Check, 
  Building, 
  AlertCircle, 
  ChevronRight, 
  FileText,
  Upload,
  Calendar,
  XCircle,
  Trash2,
  CreditCard,
  X,
  RotateCcw,
  AlertTriangle,
  Hammer,
  HardHat,
  CheckCircle,
  FolderOpen,
} from "lucide-react";
import { 
  updateKprProcess, 
  submitKprToBank, 
  uploadCustomerDocument, 
  deleteCustomerDocument,
  verifyCustomerDocument,
  updateBankSubmission,
  deleteBankSubmission,
  approveBastKonsumen,
  realizeKprFunds,
  createRealizationAttachment,
} from "@/server/actions/marketing";
import { useI18n } from "@/lib/i18n";
import { getBankSubmissionStatusLabel, getDocumentVerificationStatusLabel } from "@/lib/label-helpers";
import { Translate } from "@/components/translate";
import { Progress } from "@/components/ui/progress";
import { KprMilestoneTracker } from "./kpr-milestone-tracker";

interface Props {
  kpr: any;
  bankPartners: any[];
  submissions: any[];
  documents: any[];
  accounts?: any[];
  canVerifyDocs?: boolean;
  canApproveHandover?: boolean;
}

export default function KprCardDetailDialog({ 
  kpr, 
  bankPartners, 
  submissions, 
  documents,
  accounts = [],
  canVerifyDocs = false,
  canApproveHandover = false,
}: Props) {
  const { t } = useI18n();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handoverLoading, setHandoverLoading] = useState(false);

  // States for KPR State updates
  const [status, setStatus] = useState(kpr.status);

  const submittedBankPartners = bankPartners.filter((bp) =>
    submissions.some((sub) => {
      if (sub.bankPartnerId !== bp.id) return false;
      if (status === "offering") {
        return sub.status === "offering" || sub.status === "approved";
      }
      if (status === "approved" || status === "akad") {
        return sub.status === "approved";
      }
      return true;
    })
  );
  const [biCheckStatus, setBiCheckStatus] = useState(kpr.biCheckStatus);
  const [docStatus, setDocStatus] = useState(kpr.documentStatus);
  const [deleteDocTarget, setDeleteDocTarget] = useState<string | null>(null);
  const [docsList, setDocsList] = useState(documents);
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
  const [loadingDocType, setLoadingDocType] = useState<string | null>(null);

  // In-place document rejection form states
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState("");

  // States for bank submission (Tab 3)
  const [bankId, setBankId] = useState("");
  const [subDate, setSubDate] = useState("");
  const [plafond, setPlafond] = useState("");
  const [tenor, setTenor] = useState("");
  const [subStatus, setSubStatus] = useState("submitted");
  
  // States for inline bank submission editing
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<"submitted" | "verified" | "offering" | "approved" | "rejected">("submitted");
  const [editPlafond, setEditPlafond] = useState("");
  const [editTenor, setEditTenor] = useState("");

  // Bank Form Validation Errors
  const [plafondError, setPlafondError] = useState<string | null>(null);
  const [tenorError, setTenorError] = useState<string | null>(null);

  // States for Bank Approval Selection (Tab 1 / Left Sidebar)
  const [approvedBankId, setApprovedBankId] = useState(() => {
    const approvedSub = submissions.find(sub => sub.status === "approved" || sub.status === "offering");
    return approvedSub ? approvedSub.bankPartnerId : "";
  });
  const [approvedPlafond, setApprovedPlafond] = useState(() => {
    const approvedSub = submissions.find(sub => sub.status === "approved" || sub.status === "offering");
    return approvedSub && approvedSub.plafondAmount ? String(approvedSub.plafondAmount) : "";
  });
  const [approvedTenor, setApprovedTenor] = useState(() => {
    const approvedSub = submissions.find(sub => sub.status === "approved" || sub.status === "offering");
    return approvedSub && approvedSub.tenorYear ? String(approvedSub.tenorYear) : "";
  });

  const [approvedPlafondError, setApprovedPlafondError] = useState<string | null>(null);
  const [approvedTenorError, setApprovedTenorError] = useState<string | null>(null);

  // States for Realisasi Dana KPR
  const [realizedPlafond, setRealizedPlafond] = useState(approvedPlafond);
  const [realizedDate, setRealizedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [realizedBankFees, setRealizedBankFees] = useState("0");
  const [realizedInsuranceFees, setRealizedInsuranceFees] = useState("0");
  const [realizedWithheldAmount, setRealizedWithheldAmount] = useState("0");
  const [realizedAccountId, setRealizedAccountId] = useState("");
  const [realizedNotes, setRealizedNotes] = useState("");

  // Memo attachment uploading states
  const [memoUploading, setMemoUploading] = useState(false);
  const [memoAttachmentId, setMemoAttachmentId] = useState("");
  const [memoFileName, setMemoFileName] = useState("");
  const [memoFileUrl, setMemoFileUrl] = useState("");

  // Sync realizedPlafond when approvedPlafond changes
  useEffect(() => {
    setRealizedPlafond(approvedPlafond);
  }, [approvedPlafond]);

  const netReceived = (parseFloat(realizedPlafond) || 0) -
    (parseFloat(realizedBankFees) || 0) -
    (parseFloat(realizedInsuranceFees) || 0) -
    (parseFloat(realizedWithheldAmount) || 0);

  const parseNotesMap = (notesStr: string | null, currentStatus: string): Record<string, string> => {
    const map: Record<string, string> = {
      bi_checking: "",
      pemberkasan: "",
      proses_bank: "",
      offering: "",
      approved: "",
      rejected: "",
      akad: "",
    };
    if (!notesStr) return map;
    try {
      if (notesStr.trim().startsWith("{")) {
        const parsed = JSON.parse(notesStr);
        return { ...map, ...parsed };
      }
    } catch (e) {}
    // Fallback if not JSON
    map[currentStatus] = notesStr;
    return map;
  };

  const [notesMap, setNotesMap] = useState<Record<string, string>>(() => 
    parseNotesMap(kpr.bankNotes, kpr.status)
  );
  const [currentNote, setCurrentNote] = useState(notesMap[kpr.status] || "");

  const handleStatusChange = (newStatus: string) => {
    const updatedMap: Record<string, string> = {
      ...notesMap,
      [status]: currentNote,
    };
    setNotesMap(updatedMap);
    setStatus(newStatus);
    setCurrentNote(updatedMap[newStatus] || "");
  };

  const triggerFileSelect = (type: string) => {
    setUploadingDocType(type);
    const input = document.getElementById("kpr-doc-file-input") as HTMLInputElement;
    if (input) {
      input.value = "";
      input.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !uploadingDocType) return;
    const file = files[0];
    await handleUploadDoc(uploadingDocType, file);
    setUploadingDocType(null);
  };

  useEffect(() => {
    setDocsList(documents);
  }, [documents]);

  useEffect(() => {
    setStatus(kpr.status);
    setBiCheckStatus(kpr.biCheckStatus);
    setDocStatus(kpr.documentStatus);
    const newMap = parseNotesMap(kpr.bankNotes, kpr.status);
    setNotesMap(newMap);
    setCurrentNote(newMap[kpr.status] || "");
    
    // Sync approved bank details on change
    const approvedSub = submissions.find(sub => sub.status === "approved" || sub.status === "offering");
    setApprovedBankId(approvedSub ? approvedSub.bankPartnerId : "");
    setApprovedPlafond(approvedSub && approvedSub.plafondAmount ? String(approvedSub.plafondAmount) : "");
    setApprovedTenor(approvedSub && approvedSub.tenorYear ? String(approvedSub.tenorYear) : "");
  }, [kpr, submissions]);

  // Client-Side Transitions Safeguards
  const hasApprovedSubmission = submissions.some(sub => sub.status === "approved");
  const hasOfferingSubmission = submissions.some(sub => sub.status === "offering" || sub.status === "approved");
  const hasVerifiedSubmission = submissions.some(sub => sub.status === "verified" || sub.status === "offering" || sub.status === "approved");
  const isReadyStockUnfinished = false;
  const isConstructionPending =
    kpr.unitStatus === "construction" && (kpr.constructionProgress ?? 0) < 100;
  const isBiCheckRejected = biCheckStatus === "rejected_refund" || biCheckStatus === "rejected_no_refund";
  const isStageRequiringBank = status === "offering" || status === "approved" || status === "akad";

  // Approved is a one-way gate: can only move forward (akad)
  const BACKWARD_FROM_APPROVED = ["bi_checking", "pemberkasan", "proses_bank", "offering"];
  const isCurrentlyApproved = kpr.status === "approved";

  // Realisasi is a terminal gate (RULE 7): cannot go backward at all
  const BACKWARD_FROM_REALISASI = ["bi_checking", "pemberkasan", "proses_bank", "offering", "approved", "akad"];
  const isCurrentlyRealisasi = kpr.status === "realisasi";

  // BAST doc: must be uploaded & verified to proceed to akad or approve handover
  const hasBastDoc = docsList.some(d => d.documentType === "bast");
  const hasBastVerified = docsList.some(d => d.documentType === "bast" && d.status === "verified");

  // Handover eligibility
  const isHandoverDone = kpr.unitStatus === "handover_complete";
  const canShowHandoverSection =
    canApproveHandover &&
    (kpr.status === "akad" || kpr.status === "realisasi") &&
    hasBastVerified &&
    !isHandoverDone;

  let clientValidationError: string | null = null;
  if (isCurrentlyApproved && BACKWARD_FROM_APPROVED.includes(status)) {
    clientValidationError =
      "KPR yang sudah Approved tidak dapat dikembalikan ke tahap sebelumnya. " +
      "Hanya dapat maju ke Akad (dengan syarat pembangunan selesai & BAST terunggah).";
  } else if (isCurrentlyRealisasi && BACKWARD_FROM_REALISASI.includes(status)) {
    // RULE 7: realisasi is terminal gate
    clientValidationError =
      "Status Realisasi Dana tidak dapat dikembalikan ke tahap sebelumnya. " +
      "Dana KPR yang sudah dicairkan tidak dapat dibatalkan melalui sistem ini.";
  } else if ((status === "pemberkasan" || status === "proses_bank") && docStatus !== "complete") {
    clientValidationError = t("kpr_dialog.val_err_doc_incomplete");
  } else if (status === "proses_bank" && !hasVerifiedSubmission) {
    clientValidationError = "Tidak dapat memindahkan status ke Proses Bank. Pengajuan ke bank partner harus berstatus minimal 'Verified' (Diverifikasi oleh analis bank) terlebih dahulu.";
  } else if (isStageRequiringBank && submissions.length === 0) {
    clientValidationError = "Belum ada pengajuan ke bank partner. Silakan tambahkan pengajuan bank terlebih dahulu pada tab 'Pengajuan Bank'.";
  } else if ((status === "approved" || status === "akad") && !hasApprovedSubmission) {
    clientValidationError = "Belum ada pengajuan bank yang berstatus disetujui (Approved). Silakan ubah status salah satu pengajuan bank terlebih dahulu pada tab 'Pengajuan Bank'.";
  } else if (status === "offering" && !hasOfferingSubmission) {
    clientValidationError = "Belum ada pengajuan bank yang berstatus penawaran (Offering) atau disetujui (Approved). Silakan ubah status pengajuan bank terlebih dahulu pada tab 'Pengajuan Bank'.";
  } else if (status === "akad" && isReadyStockUnfinished) {
    clientValidationError = t("kpr_dialog.val_err_ready_stock_unfinished");
  } else if (status === "akad" && isConstructionPending) {
    clientValidationError =
      `Pembangunan fisik unit ${kpr.unitCode} masih berjalan (${kpr.constructionProgress ?? 0}%). ` +
      "Proses Akad hanya bisa dilakukan setelah pembangunan fisik selesai 100%. " +
      "Pantau progress di modul Produksi.";
  // NOTE: BAST gate removed — BAST diupload SETELAH akad/realisasi, bukan sebelum akad.
  // Urutan benar: KPR approved → Akad → Realisasi → Upload BAST → Verifikasi BAST → Serah Terima
  } else if (status === "rejected" && kpr.status === "approved") {
    clientValidationError =
      "KPR yang sudah berstatus Approved tidak dapat dikembalikan ke Ditolak (Rejected). " +
      "Hubungi Super Admin jika diperlukan penanganan khusus.";
  } else if (isBiCheckRejected && status !== "rejected") {
    clientValidationError = t("kpr_dialog.val_err_bi_rejected");
  } else if (isStageRequiringBank && !approvedBankId) {
    clientValidationError = t("kpr_dialog.val_err_bank_required");
  } else if (approvedPlafondError) {
    clientValidationError = approvedPlafondError;
  } else if (approvedTenorError) {
    clientValidationError = approvedTenorError;
  }

  const handleUploadMemo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    setMemoUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/upload-attachment", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json();
        throw new Error(errData.error || "Gagal mengunggah memo pencairan.");
      }

      const fileData = await uploadRes.json();

      const res = await createRealizationAttachment({
        kprProcessId: kpr.id,
        fileName: file.name,
        fileUrl: fileData.url,
        mimeType: file.type,
        fileSize: file.size,
      });

      if (res.success && res.attachmentId) {
        setMemoAttachmentId(res.attachmentId);
        setMemoFileName(file.name);
        setMemoFileUrl(fileData.url);
        setError("✓ Memo pencairan bank berhasil diunggah!");
      }
    } catch (err: any) {
      setError(err.message || "Gagal mengunggah berkas memo pencairan.");
    } finally {
      setMemoUploading(false);
    }
  };

  const triggerMemoSelect = () => {
    const input = document.getElementById("kpr-realization-memo-input") as HTMLInputElement;
    if (input) {
      input.value = "";
      input.click();
    }
  };

  const handleRealizeKpr = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!realizedDate) {
      alert("Tanggal realisasi wajib diisi.");
      return;
    }
    if (!realizedPlafond || parseFloat(realizedPlafond) <= 0) {
      alert("Plafond disetujui harus lebih besar dari 0.");
      return;
    }
    if (!realizedAccountId) {
      alert("Rekening tujuan realisasi wajib dipilih.");
      return;
    }
    if (!memoAttachmentId) {
      alert("Memo pencairan bank wajib diunggah.");
      return;
    }

    const net = parseFloat(realizedPlafond) - parseFloat(realizedBankFees || "0") - parseFloat(realizedInsuranceFees || "0") - parseFloat(realizedWithheldAmount || "0");
    if (net < 0) {
      alert("Dana penerimaan bersih tidak boleh kurang dari nol. Periksa rincian potongan biaya.");
      return;
    }

    if (!confirm(
      "Apakah Anda yakin ingin melakukan Realisasi Dana KPR?\n\n" +
      "⚠️ Aksi ini berdampak pada:\n" +
      "1. Status KPR -> 'Realisasi' (permanen)\n" +
      "2. Buku Kas Finance -> Pencatatan kas masuk bersih Rp " + net.toLocaleString("id-ID") + "\n" +
      "3. Status Unit -> 'Menunggu Serah Terima'\n" +
      "4. Modul Konstruksi -> Mengaktifkan panel upload BAST Konsumen\n" +
      "5. Visual Siteplan -> Kavling berubah warna ungu\n\n" +
      "Lanjutkan?"
    )) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await realizeKprFunds({
        kprProcessId: kpr.id,
        realizedDate: new Date(realizedDate),
        plafondApproved: parseFloat(realizedPlafond),
        realizedBankFees: parseFloat(realizedBankFees || "0"),
        realizedInsuranceFees: parseFloat(realizedInsuranceFees || "0"),
        realizedWithheldAmount: parseFloat(realizedWithheldAmount || "0"),
        realizedAccountId: realizedAccountId,
        realizedAttachmentId: memoAttachmentId,
        realizedNotes: realizedNotes || null,
      });

      if (res.success) {
        alert("Dana KPR berhasil direalisasikan!");
        setOpen(false);
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || "Gagal memproses realisasi dana KPR.");
      alert(`Gagal: ${err.message || "Gagal memproses realisasi dana KPR."}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (clientValidationError) return;

    // Check for unverified files — only mandatory KPR docs (KTP, NPWP, Slip Gaji, KK)
    // Supporting docs like BAST, SPJB, kpr_doc are uploaded AFTER akad/realisasi — do NOT gate here
    const MANDATORY_DOC_TYPES = ["ktp", "npwp", "slip_gaji", "kk"];
    const mandatoryDocs = docsList.filter(d => MANDATORY_DOC_TYPES.includes(d.documentType));
    const hasUnverifiedDocs = mandatoryDocs.some(d => d.status !== "verified");
    if (status !== kpr.status && (hasUnverifiedDocs || mandatoryDocs.length === 0)) {
      alert(
        "Pemberitahuan: Berkas ada yang belum terverifikasi, coba check terlebih dahulu untuk memastikan.\n\n" +
        "Pihak yang perlu/berwenang memverifikasi berkas tersebut adalah:\n" +
        "- Super Admin\n" +
        "- Admin Kantor\n" +
        "- Admin Keuangan\n" +
        "- Direksi / Manager\n\n" +
        "Proses pembaruan ditolak karena seluruh berkas konsumen wajib diverifikasi terlebih dahulu!"
      );
      return;
    }

    // Demotion check: enforce revision note in textarea when moving stage backward
    const STAGE_ORDER = ["bi_checking", "pemberkasan", "proses_bank", "offering", "approved", "akad"];
    const currentIndex = STAGE_ORDER.indexOf(kpr.status);
    const newIndex = STAGE_ORDER.indexOf(status);
    if (currentIndex !== -1 && newIndex !== -1 && newIndex < currentIndex) {
      if (!currentNote.trim()) {
        alert("Catatan revisi wajib diisi jika alur KPR dikembalikan ke tahap sebelumnya! Silakan masukkan apa saja yang perlu direvisi/diperbaiki pada kotak Catatan di sebelah kiri.");
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const finalNotesMap = {
        ...notesMap,
        [status]: currentNote,
      };
      const bankNotesJson = JSON.stringify(finalNotesMap);
      
      const res = await updateKprProcess(kpr.id, {
        status,
        biCheckStatus,
        documentStatus: docStatus,
        bankNotes: bankNotesJson,
        akadDate: status === "akad" ? new Date() : null,
        approvedBankPartnerId: isStageRequiringBank ? approvedBankId : null,
        approvedPlafond: isStageRequiringBank && approvedPlafond ? parseFloat(approvedPlafond) : null,
        approvedTenor: isStageRequiringBank && approvedTenor ? parseInt(approvedTenor) : null,
      });
      if (res.success) {
        alert("Proses alur KPR konsumen berhasil diperbarui!");
        setOpen(false);
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || t("kpr_dialog.error_update"));
    } finally {
      setLoading(false);
    }
  };

  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankId || !subDate) {
      setError(t("kpr_dialog.error_empty"));
      return;
    }

    let isValid = true;
    if (plafond && parseFloat(plafond) <= 0) {
      setPlafondError("Plafond harus bernilai lebih dari 0.");
      isValid = false;
    } else {
      setPlafondError(null);
    }

    if (tenor && (parseInt(tenor) <= 0 || parseInt(tenor) > 30)) {
      setTenorError("Tenor harus antara 1 sampai 30 tahun.");
      isValid = false;
    } else {
      setTenorError(null);
    }

    if (!isValid) return;

    setLoading(true);
    setError(null);
    try {
      const res = await submitKprToBank({
        kprProcessId: kpr.id,
        bankPartnerId: bankId,
        submissionDate: new Date(subDate),
        status: subStatus,
        plafondAmount: plafond ? parseFloat(plafond) : null,
        tenorYear: tenor ? parseInt(tenor) : null,
      });
      if (res.success) {
        setBankId("");
        setSubDate("");
        setPlafond("");
        setTenor("");
        setError(t("kpr_dialog.success_submit"));
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || t("kpr_dialog.error_submit"));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSubmission = async (subId: string) => {
    const plafondVal = editPlafond ? parseFloat(editPlafond) : null;
    const tenorVal = editTenor ? parseInt(editTenor) : null;

    if (plafondVal !== null && (isNaN(plafondVal) || plafondVal <= 0)) {
      setError("Plafond harus bernilai lebih dari 0.");
      return;
    }
    if (tenorVal !== null && (isNaN(tenorVal) || tenorVal <= 0 || tenorVal > 30)) {
      setError("Tenor harus antara 1 sampai 30 tahun.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await updateBankSubmission(subId, {
        status: editStatus,
        plafondAmount: plafondVal,
        tenorYear: tenorVal,
      });
      if (res.success) {
        setEditingSubId(null);
        setError("✓ Status pengajuan bank berhasil diperbarui!");
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || "Gagal memperbarui pengajuan bank.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSubmission = async (subId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus pengajuan bank ini?")) return;

    setLoading(true);
    setError(null);
    try {
      const res = await deleteBankSubmission(subId);
      if (res.success) {
        setEditingSubId(null);
        setError("✓ Pengajuan bank berhasil dihapus!");
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || "Gagal menghapus pengajuan bank.");
    } finally {
      setLoading(false);
    }
  };

  // Direct Document verification handler
  const handleVerifyDoc = async (docId: string, docStatusArg: "verified" | "rejected", notesArg?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await verifyCustomerDocument(docId, docStatusArg, notesArg);
      if (res.success) {
        setRejectingDocId(null);
        setRejectionNotes("");
        
        // Update local docs list state
        setDocsList((prev) => 
          prev.map(d => d.id === docId ? { ...d, status: docStatusArg, notes: notesArg || null } : d)
        );

        // Sync local document status to match core requirements (KTP, NPWP, Slip Gaji, KK)
        const updatedDocs = docsList.map(d => d.id === docId ? { ...d, status: docStatusArg } : d);
        const hasKtp = updatedDocs.some(d => d.documentType === "ktp" && d.status === "verified");
        const hasNpwp = updatedDocs.some(d => d.documentType === "npwp" && d.status === "verified");
        const hasSlip = updatedDocs.some(d => d.documentType === "slip_gaji" && d.status === "verified");
        const hasKk = updatedDocs.some(d => d.documentType === "kk" && d.status === "verified");
        
        if (hasKtp && hasNpwp && hasSlip && hasKk) {
          setDocStatus("complete");
        } else {
          setDocStatus("incomplete");
        }

        setError(`✓ Status dokumen berhasil diperbarui!`);
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || "Gagal memperbarui verifikasi berkas.");
    } finally {
      setLoading(false);
    }
  };

  // File upload helper
  const handleUploadDoc = async (type: string, file: File) => {
    setLoading(true);
    setLoadingDocType(type);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/upload-attachment", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json();
        throw new Error(errData.error || "Gagal mengunggah berkas.");
      }

      const fileData = await uploadRes.json();

      const res = await uploadCustomerDocument({
        customerId: kpr.customerId,
        bookingId: kpr.bookingId,
        documentType: type as "ktp" | "npwp" | "slip_gaji" | "kk" | "spjb" | "kpr_doc" | "other",
        fileName: file.name,
        fileUrl: fileData.url,
        mimeType: file.type,
        fileSize: file.size,
      });

      if (res.success) {
        const newDoc = {
          id: res.id!,
          customerId: kpr.customerId,
          bookingId: kpr.bookingId || null,
          documentType: type,
          status: "uploaded",
          notes: null,
          attachmentId: res.attachmentId!,
          fileName: file.name,
          fileUrl: fileData.url,
        };
        setDocsList((prev) => {
          const filtered = prev.filter(d => d.documentType !== type);
          return [...filtered, newDoc];
        });
        setError(t("kpr_dialog.success_upload", { type: type.toUpperCase() }));
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || t("kpr_dialog.error_upload"));
    } finally {
      setLoading(false);
      setLoadingDocType(null);
    }
  };

  const handleDeleteClick = (type: string) => {
    setDeleteDocTarget(type);
  };

  const executeDeleteDoc = async () => {
    if (!deleteDocTarget) return;
    const type = deleteDocTarget;
    setDeleteDocTarget(null);

    const doc = docsList.find(d => d.documentType === type);
    if (!doc) return;

    setLoading(true);
    setError(null);
    try {
      const res = await deleteCustomerDocument(doc.id);
      if (res.success) {
        setDocsList((prev) => prev.filter((d) => d.id !== doc.id));
        
        // Sync document completeness status locally
        const updatedDocs = docsList.filter((d) => d.id !== doc.id);
        const hasKtp = updatedDocs.some(d => d.documentType === "ktp" && d.status === "verified");
        const hasNpwp = updatedDocs.some(d => d.documentType === "npwp" && d.status === "verified");
        const hasSlip = updatedDocs.some(d => d.documentType === "slip_gaji" && d.status === "verified");
        const hasKk = updatedDocs.some(d => d.documentType === "kk" && d.status === "verified");
        
        if (hasKtp && hasNpwp && hasSlip && hasKk) {
          setDocStatus("complete");
        } else {
          setDocStatus("incomplete");
        }

        setError(t("kpr_dialog.success_delete", { type: type.toUpperCase() }));
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || t("kpr_dialog.error_delete"));
    } finally {
      setLoading(false);
    }
  };

  const handleReuploadDoc = async (type: string, docId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await deleteCustomerDocument(docId);
      if (res.success) {
        setDocsList((prev) => prev.filter((d) => d.id !== docId));
        
        // Sync document completeness status locally
        const updatedDocs = docsList.filter((d) => d.id !== docId);
        const hasKtp = updatedDocs.some(d => d.documentType === "ktp" && d.status === "verified");
        const hasNpwp = updatedDocs.some(d => d.documentType === "npwp" && d.status === "verified");
        const hasSlip = updatedDocs.some(d => d.documentType === "slip_gaji" && d.status === "verified");
        const hasKk = updatedDocs.some(d => d.documentType === "kk" && d.status === "verified");
        
        if (hasKtp && hasNpwp && hasSlip && hasKk) {
          setDocStatus("complete");
        } else {
          setDocStatus("incomplete");
        }
        
        router.refresh();
        
        // Trigger file select for this type
        triggerFileSelect(type);
      }
    } catch (err: any) {
      setError(err.message || t("kpr_dialog.error_delete"));
    } finally {
      setLoading(false);
    }
  };

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    }).format(val);
  };

  const MANDATORY_DOCS = [
    { type: "ktp", label: t("kpr_dialog.doc_ktp") },
    { type: "npwp", label: t("kpr_dialog.doc_npwp") },
    { type: "slip_gaji", label: t("kpr_dialog.doc_slip") },
    { type: "kk", label: t("kpr_dialog.doc_kk") },
  ];

  const handleApproveHandover = async () => {
    if (!window.confirm(
      "Konfirmasi Selesaikan Serah Terima\n\n" +
      "Aksi ini akan mengubah status unit menjadi 'Serah Terima Selesai' secara PERMANEN.\n\n" +
      "Pastikan:\n" +
      "• BAST Developer → Konsumen sudah ditandatangani\n" +
      "• Dokumen BAST sudah diverifikasi Admin\n" +
      "• Konsumen sudah menerima kunci unit\n\n" +
      "Lanjutkan?"
    )) return;

    setHandoverLoading(true);
    setError(null);
    try {
      const res = await approveBastKonsumen(kpr.bookingId);
      if (res.success) {
        setError("✓ Serah Terima Selesai! Status unit telah diperbarui menjadi Handover Complete.");
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || "Gagal menyelesaikan serah terima.");
    } finally {
      setHandoverLoading(false);
    }
  };

  const SUPPORTING_DOCS = [
    { type: "spjb", label: t("kpr_dialog.doc_spjb") },
    { type: "kpr_doc", label: t("kpr_dialog.doc_kpr_doc") },
    { type: "bast", label: t("kpr_dialog.doc_bast") },
    { type: "other", label: t("kpr_dialog.doc_other") },
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div className="grid grid-cols-[1fr_88px] gap-3 mt-2">
        <SheetTrigger nativeButton={true} render={
          <Button size="sm" className="h-9 min-w-0 rounded-xl bg-card hover:bg-secondary/45 text-primary hover:text-primary font-bold border border-primary/25 shadow-sm flex items-center justify-center gap-1.5 px-3 text-[11px]">
            <FolderOpen className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Kelola Berkas</span>
          </Button>
        } />
        <a
          href={`/marketing/kpr/${kpr.id}`}
          className="h-9 rounded-xl bg-primary hover:bg-[#3F5941] text-white font-bold border border-primary text-[11px] flex items-center justify-center gap-1 transition-colors shadow-sm whitespace-nowrap"
          title="Lihat Detail"
        >
          <ChevronRight className="h-3.5 w-3.5" />
          Detail
        </a>
      </div>
      
      <SheetContent side="right" className="w-full sm:max-w-4xl bg-white/98 backdrop-blur-md border-l border-border p-0 overflow-hidden flex flex-col h-full z-[100] sm:rounded-l-3xl shadow-[0_8px_30px_rgba(79,111,82,0.18)]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-5 border-b border-border shrink-0">
          <SheetHeader>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-card border border-border flex items-center justify-center shadow-sm shrink-0">
                  <CreditCard className="h-5.5 w-5.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <SheetTitle className="text-base font-black text-foreground tracking-tight truncate">
                    {t("kpr_dialog.title", { name: kpr.customerName })}
                  </SheetTitle>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground font-semibold">
                      {t("kpr_dialog.unit")}{" "}
                      <span className="font-mono font-bold text-foreground bg-secondary px-1.5 py-0.5 rounded">
                        {kpr.unitCode}
                      </span>
                    </span>
                    <span className="text-[10px] text-muted-foreground/70 font-bold">•</span>
                    <span className="text-xs text-muted-foreground font-bold">{kpr.projectName}</span>
                    {kpr.isReadyStock && (
                      <Badge className="bg-[#4B286D]/15 text-[#4B286D] hover:bg-[#4B286D]/20 border-none font-extrabold text-[9px] px-2 py-0.5 rounded-full shrink-0">
                        Siap Huni
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Milestone Tracker Area */}
              <div className="pt-2 border-t border-border/50">
                <KprMilestoneTracker 
                  data={{
                    unitStatus: kpr.unitStatus,
                    kprStatus: kpr.status,
                    isReadyStock: kpr.isReadyStock,
                    readyStockSource: kpr.readyStockSource || null,
                    constructionProgress: kpr.constructionProgress,
                    bastCustomerStatus: docsList.find(
                      (document) => document.bookingId === kpr.bookingId && document.documentType === "bast"
                    )?.status ?? null,
                  }}
                  orientation="horizontal"
                />
              </div>
            </div>
          </SheetHeader>
        </div>

        {/* Flex Split-Pane Container */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* LEFT SIDEBAR PANEL (2/5 Width) */}
          <div className="w-full md:w-[360px] border-r border-border bg-muted/30/50 p-5 overflow-y-auto flex flex-col shrink-0">
            {status === "realisasi" && kpr.status !== "realisasi" ? (
              <form onSubmit={handleRealizeKpr} className="space-y-4 flex-1 flex flex-col">
                {/* Business alerts */}
                {error && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200/60 rounded-2xl flex items-start gap-2 text-xs text-emerald-800 font-semibold shadow-sm shrink-0">
                    <Check className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="bg-card p-3.5 rounded-2xl border border-violet-200 bg-violet-50/10 shadow-sm space-y-3.5 shrink-0">
                  <div className="flex items-center gap-2 border-b border-violet-100 pb-1.5">
                    <CreditCard className="h-4 w-4 text-violet-600" />
                    <span className="text-xs font-black text-violet-800 uppercase tracking-wider">Form Realisasi Dana KPR</span>
                  </div>

                  {/* Stage selector */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">{t("kpr_dialog.status_stage")}</Label>
                    <select
                      value={status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="flex h-10 w-full rounded-xl border border-border bg-muted/30/60 px-3 py-2 text-sm focus:border-violet-500 focus-visible:outline-none focus:bg-card transition-all font-semibold"
                    >
                      <option value="akad">{t("kpr_dialog.stage_akad")}</option>
                      <option value="realisasi">Realisasi Dana</option>
                    </select>
                  </div>

                  {/* Tanggal Realisasi */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Tanggal Realisasi</Label>
                    <input
                      type="date"
                      value={realizedDate}
                      onChange={(e) => setRealizedDate(e.target.value)}
                      className="flex h-10 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus:border-violet-500 focus-visible:outline-none transition-all font-semibold"
                    />
                  </div>

                  {/* Plafond Disetujui */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Plafond Disetujui (Rp)</Label>
                    <Input
                      type="number"
                      placeholder="Contoh: 450000000"
                      value={realizedPlafond}
                      onChange={(e) => setRealizedPlafond(e.target.value)}
                      className="h-10 text-sm rounded-xl border-border focus-visible:ring-violet-500"
                    />
                  </div>

                  {/* Potongan Admin Bank */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Potongan Provisi/Admin Bank (Rp)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={realizedBankFees}
                      onChange={(e) => setRealizedBankFees(e.target.value)}
                      className="h-10 text-sm rounded-xl border-border focus-visible:ring-violet-500"
                    />
                  </div>

                  {/* Premi Asuransi */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Premi Asuransi KPR (Rp)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={realizedInsuranceFees}
                      onChange={(e) => setRealizedInsuranceFees(e.target.value)}
                      className="h-10 text-sm rounded-xl border-border focus-visible:ring-violet-500"
                    />
                  </div>

                  {/* Hold Amount */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Dana Ditahan / Hold (Rp)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={realizedWithheldAmount}
                      onChange={(e) => setRealizedWithheldAmount(e.target.value)}
                      className="h-10 text-sm rounded-xl border-border focus-visible:ring-violet-500"
                    />
                  </div>

                  {/* Net Received Display */}
                  <div className="p-3 bg-violet-50 border border-violet-100 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-violet-700 block uppercase tracking-wider">Kas Bersih Diterima Developer</span>
                    <span className="font-mono text-sm font-black text-violet-950 block">
                      {formatRupiah(netReceived)}
                    </span>
                  </div>

                  {/* Rekening Tujuan */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Rekening Tujuan</Label>
                    <select
                      value={realizedAccountId}
                      onChange={(e) => setRealizedAccountId(e.target.value)}
                      className="flex h-10 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm focus:border-violet-500 focus-visible:outline-none transition-all font-semibold"
                    >
                      <option value="">-- Pilih Rekening Kas/Bank --</option>
                      {accounts.map((acc: any) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Memo Upload */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Memo Pencairan Bank (Wajib)</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={triggerMemoSelect}
                        disabled={memoUploading}
                        className="text-xs font-bold h-9 px-3 rounded-xl border-violet-200 text-violet-700 hover:bg-violet-50 flex items-center gap-1 shadow-sm"
                      >
                        {memoUploading ? (
                          <>
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-violet-700 border-t-transparent" />
                            <span>Uploading...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4" />
                            <span>Unggah Memo</span>
                          </>
                        )}
                      </Button>
                      <input
                        id="kpr-realization-memo-input"
                        type="file"
                        accept="application/pdf,image/*"
                        className="hidden"
                        onChange={handleUploadMemo}
                      />
                      {memoFileName && (
                        <span className="text-[10px] text-slate-600 font-mono truncate max-w-[150px]" title={memoFileName}>
                          {memoFileName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Catatan Realisasi */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">Catatan</Label>
                    <textarea
                      value={realizedNotes}
                      onChange={(e) => setRealizedNotes(e.target.value)}
                      placeholder="Masukkan catatan realisasi..."
                      className="flex min-h-[60px] w-full rounded-xl border border-border bg-card px-3 py-2 text-xs focus:border-violet-500 focus-visible:outline-none transition-all font-medium"
                    />
                  </div>
                </div>

                {/* Warning Banner */}
                <div className="p-3 bg-amber-50 border border-amber-200/60 rounded-xl space-y-1.5 text-[10px] text-amber-900 font-semibold shadow-sm leading-relaxed shrink-0">
                  <span className="font-bold flex items-center gap-1 text-amber-800">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    TINDAKAN INI BERDAMPAK PADA MULTIMODUL:
                  </span>
                  <ul className="list-decimal pl-3 space-y-1 text-amber-800 font-medium">
                    <li>Status KPR &rarr; <strong>"Realisasi"</strong> (tidak dapat dibatalkan)</li>
                    <li>Buku Kas Finance &rarr; Pemasukan bersih dicatat</li>
                    <li>Status Unit &rarr; <strong>"Menunggu Serah Terima"</strong></li>
                    <li>Modul Konstruksi &rarr; Panel BAST Konsumen aktif</li>
                    <li>Visual Siteplan &rarr; Warna kavling menjadi ungu</li>
                  </ul>
                </div>

                {/* Submit buttons */}
                <div className="pt-3 mt-auto flex gap-3 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 rounded-xl h-10 font-bold border-border text-muted-foreground text-xs"
                    onClick={() => handleStatusChange("akad")}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading || memoUploading || !memoAttachmentId || !realizedAccountId || netReceived < 0}
                    className="flex-1 bg-violet-600 hover:bg-violet-700 text-white rounded-xl h-10 font-bold shadow-sm transition-all text-xs"
                  >
                    {loading ? "Menyimpan..." : "Konfirmasi Realisasi"}
                  </Button>
                </div>
              </form>
            ) : kpr.status === "realisasi" ? (
              <div className="space-y-4 flex-1 flex flex-col">
                <div className="bg-card p-4 rounded-2xl border border-teal-200 bg-teal-50/10 shadow-sm space-y-3">
                  <div className="flex items-center gap-2 border-b border-teal-100 pb-1.5">
                    <CheckCircle className="h-4.5 w-4.5 text-teal-600" />
                    <span className="text-xs font-black text-teal-800 uppercase tracking-wider">Dana KPR Telah Direalisasikan</span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between border-b border-dashed border-slate-100 pb-1.5">
                      <span className="text-slate-500 font-semibold">Tanggal Realisasi:</span>
                      <span className="font-bold text-slate-800">
                        {kpr.realizedDate ? new Date(kpr.realizedDate).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' }) : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-dashed border-slate-100 pb-1.5">
                      <span className="text-slate-500 font-semibold">Plafond Disetujui:</span>
                      <span className="font-mono font-bold text-slate-800">{formatRupiah(kpr.plafondApproved || 0)}</span>
                    </div>
                    <div className="flex justify-between border-b border-dashed border-slate-100 pb-1.5">
                      <span className="text-slate-500 font-semibold">Potongan Provisi/Admin:</span>
                      <span className="font-mono font-bold text-rose-600">-{formatRupiah(kpr.realizedBankFees || 0)}</span>
                    </div>
                    <div className="flex justify-between border-b border-dashed border-slate-100 pb-1.5">
                      <span className="text-slate-500 font-semibold">Premi Asuransi:</span>
                      <span className="font-mono font-bold text-rose-600">-{formatRupiah(kpr.realizedInsuranceFees || 0)}</span>
                    </div>
                    <div className="flex justify-between border-b border-dashed border-slate-100 pb-1.5">
                      <span className="text-slate-500 font-semibold">Dana Ditahan / Hold:</span>
                      <span className="font-mono font-bold text-amber-600">-{formatRupiah(kpr.realizedWithheldAmount || 0)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-teal-50 border border-teal-100 rounded-xl">
                      <span className="text-teal-800 font-bold">Kas Bersih Diterima:</span>
                      <span className="font-mono font-black text-teal-950">{formatRupiah(kpr.realizedNetReceived || 0)}</span>
                    </div>
                    {kpr.realizedNotes && (
                      <div className="space-y-1 p-2 bg-slate-50 rounded-xl">
                        <span className="text-[10px] text-slate-500 font-bold block">Catatan Realisasi:</span>
                        <p className="text-[11px] text-slate-700 font-medium">{kpr.realizedNotes}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 mt-auto flex border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-xl h-10 font-bold border-border text-muted-foreground text-xs"
                    onClick={() => setOpen(false)}
                  >
                    Tutup Detail
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleUpdateProcess} className="space-y-4 flex-1 flex flex-col">
                {/* Business alerts */}
                {clientValidationError && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200/60 rounded-2xl flex items-start gap-2 text-xs text-rose-800 font-semibold shadow-sm shrink-0">
                    <AlertTriangle className="h-4.5 w-4.5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="leading-relaxed">
                      <span className="font-black uppercase tracking-wider text-[8px] text-rose-900 block mb-0.5">Validasi Bisnis</span>
                      {clientValidationError}
                    </div>
                  </div>
                )}

                <div className="bg-card p-3.5 rounded-2xl border border-border shadow-sm space-y-3.5">
                  {/* Stage selector */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">{t("kpr_dialog.status_stage")}</Label>
                    <select
                      value={status}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="flex h-10 w-full rounded-xl border border-border bg-muted/30/60 px-3 py-2 text-sm focus:border-[#4F6F52] focus-visible:outline-none focus:bg-card transition-all font-semibold"
                    >
                      <option value="bi_checking" disabled={isCurrentlyApproved || isCurrentlyRealisasi}>{t("kpr_dialog.stage_bi")}{(isCurrentlyApproved || isCurrentlyRealisasi) ? " (terkunci)" : ""}</option>
                      <option value="pemberkasan" disabled={isCurrentlyApproved || isCurrentlyRealisasi}>{t("kpr_dialog.stage_docs")}{(isCurrentlyApproved || isCurrentlyRealisasi) ? " (terkunci)" : ""}</option>
                      <option value="proses_bank" disabled={isCurrentlyApproved || isCurrentlyRealisasi}>{t("kpr_dialog.stage_bank")}{(isCurrentlyApproved || isCurrentlyRealisasi) ? " (terkunci)" : ""}</option>
                      <option value="offering" disabled={isCurrentlyApproved || isCurrentlyRealisasi}>{t("kpr_dialog.stage_offer")}{(isCurrentlyApproved || isCurrentlyRealisasi) ? " (terkunci)" : ""}</option>
                      <option value="approved">{t("kpr_dialog.stage_appr")}</option>
                      <option value="rejected" disabled={isCurrentlyApproved || isCurrentlyRealisasi}>{t("kpr_dialog.stage_rej")}{(isCurrentlyApproved || isCurrentlyRealisasi) ? " (terkunci)" : ""}</option>
                      <option value="akad">{t("kpr_dialog.stage_akad")}</option>
                      <option value="realisasi">Realisasi Dana</option>
                    </select>
                  </div>

                  {/* BI Checking status selector */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">{t("kpr_dialog.status_bi")}</Label>
                    <select
                      value={biCheckStatus}
                      onChange={(e) => setBiCheckStatus(e.target.value as any)}
                      className="flex h-10 w-full rounded-xl border border-border bg-muted/30/60 px-3 py-2 text-sm focus:border-[#4F6F52] focus-visible:outline-none focus:bg-card transition-all font-semibold"
                    >
                      <option value="pending">{t("kpr_dialog.bi_pending")}</option>
                      <option value="partial">{t("kpr_dialog.bi_partial")}</option>
                      <option value="approved">{t("kpr_dialog.bi_appr")}</option>
                      <option value="rejected_refund">{t("kpr_dialog.bi_rej_ref")}</option>
                      <option value="rejected_no_refund">{t("kpr_dialog.bi_rej_noref")}</option>
                    </select>
                  </div>

                  {/* Document Status completeness selector */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground">{t("kpr_dialog.status_doc")}</Label>
                    <select
                      value={docStatus}
                      onChange={(e) => setDocStatus(e.target.value as any)}
                      className="flex h-10 w-full rounded-xl border border-border bg-muted/30/60 px-3 py-2 text-sm focus:border-[#4F6F52] focus-visible:outline-none focus:bg-card transition-all font-semibold"
                    >
                      <option value="incomplete">{t("kpr_dialog.doc_inc")}</option>
                      <option value="complete">{t("kpr_dialog.doc_comp")}</option>
                    </select>
                  </div>
                </div>

                {/* DYNAMIC SECTION: BANK APPROVAL DETAILS */}
                {isStageRequiringBank && (
                  <div className="bg-card p-3.5 rounded-2xl border border-border shadow-sm space-y-3 animate-fadeIn">
                    <span className="text-[10px] font-black text-primary uppercase tracking-wider block border-b border-slate-100 pb-1">
                      Detail Persetujuan Bank
                    </span>
                    
                    {/* Select Bank Penyetuju */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-foreground">{t("kpr_dialog.approved_bank")}</Label>
                      <select
                        value={approvedBankId}
                        onChange={(e) => setApprovedBankId(e.target.value)}
                        className="flex h-9 w-full rounded-xl border border-border bg-muted/30/60 px-2.5 py-1 text-xs focus:border-[#4F6F52] focus-visible:outline-none font-semibold"
                      >
                        <option value="">{t("kpr_dialog.approved_bank_ph")}</option>
                        {submittedBankPartners.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Plafond Disetujui */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-foreground">{t("kpr_dialog.approved_plafond")}</Label>
                      <Input
                        type="number"
                        placeholder="Contoh: 450000000"
                        value={approvedPlafond}
                        onChange={(e) => {
                          setApprovedPlafond(e.target.value);
                          if (e.target.value && parseFloat(e.target.value) <= 0) {
                            setApprovedPlafondError("Plafond disetujui harus lebih besar dari 0.");
                          } else {
                            setApprovedPlafondError(null);
                          }
                        }}
                        className={`h-9 text-xs rounded-xl ${approvedPlafondError ? "border-red-500 focus-visible:ring-red-500" : "border-border"}`}
                      />
                    </div>

                    {/* Tenor Disetujui */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-foreground">{t("kpr_dialog.approved_tenor")}</Label>
                      <Input
                        type="number"
                        placeholder="Contoh: 15"
                        value={approvedTenor}
                        onChange={(e) => {
                          setApprovedTenor(e.target.value);
                          const val = parseInt(e.target.value);
                          if (e.target.value && (val <= 0 || val > 30)) {
                            setApprovedTenorError("Tenor disetujui harus antara 1 s.d. 30 tahun.");
                          } else {
                            setApprovedTenorError(null);
                          }
                        }}
                        className={`h-9 text-xs rounded-xl ${approvedTenorError ? "border-red-500 focus-visible:ring-red-500" : "border-border"}`}
                      />
                    </div>
                  </div>
                )}

                {/* Notes map textbox */}
                <div className="bg-card p-3.5 rounded-2xl border border-border shadow-sm space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">{t("kpr_dialog.notes")}</Label>
                  <textarea
                    value={currentNote}
                    onChange={(e) => setCurrentNote(e.target.value)}
                    placeholder={t("kpr_dialog.notes_ph")}
                    className="flex min-h-[70px] w-full rounded-xl border border-border bg-muted/30/60 px-3 py-2 text-xs focus:border-[#4F6F52] focus-visible:outline-none focus:bg-card transition-all font-medium leading-normal"
                  />
                </div>

                {/* Left pane form buttons */}
                <div className="pt-3 mt-auto flex gap-3 border-t border-border">
                  <Button type="button" variant="outline" className="flex-1 rounded-xl h-10 font-bold border-border text-muted-foreground text-xs" onClick={() => setOpen(false)}>
                    {t("action.cancel")}
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={loading || !!clientValidationError} 
                    className="flex-1 bg-primary hover:bg-[#3F5941] text-white rounded-xl h-10 font-bold shadow-sm transition-all text-xs"
                  >
                    {loading ? t("kpr_dialog.btn_saving") : t("kpr_dialog.btn_update")}
                  </Button>
                </div>

                {/* Pembangunan progress & handover buttons */}
                {(kpr.status === "approved" || kpr.status === "akad") &&
                 (kpr.unitStatus === "construction" || kpr.unitStatus === "construction_done") && (
                  <div className={`rounded-2xl border p-3.5 space-y-2 shadow-sm ${
                    kpr.unitStatus === "construction_done"
                      ? "border-emerald-200 bg-emerald-50/60"
                      : "border-orange-200 bg-orange-50/60"
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {kpr.unitStatus === "construction_done" ? (
                          <HardHat className="h-4 w-4 text-emerald-600 shrink-0" />
                        ) : (
                          <Hammer className="h-4 w-4 text-orange-600 shrink-0" />
                        )}
                        <span className={`text-[10px] font-black uppercase tracking-wider ${
                          kpr.unitStatus === "construction_done" ? "text-emerald-700" : "text-orange-700"
                        }`}>
                          Status Pembangunan Fisik
                        </span>
                      </div>
                      <span className={`text-xs font-black font-mono ${
                        kpr.unitStatus === "construction_done" ? "text-emerald-700" : "text-orange-700"
                      }`}>
                        {kpr.constructionProgress ?? 0}%
                      </span>
                    </div>
                    <Progress
                      value={kpr.constructionProgress ?? 0}
                      className={`h-2 [&_[data-slot=progress-track]]:h-2 ${
                        kpr.unitStatus === "construction_done"
                          ? "[&_[data-slot=progress-indicator]]:bg-emerald-500"
                          : "[&_[data-slot=progress-indicator]]:bg-orange-500"
                      }`}
                    />
                    <p className={`text-[10px] font-semibold leading-relaxed ${
                      kpr.unitStatus === "construction_done"
                        ? "text-emerald-700"
                        : "text-orange-700"
                    }`}>
                      {kpr.unitStatus === "construction_done"
                        ? "✓ Pembangunan fisik selesai. Unit siap melanjutkan ke Akad."
                        : `⏳ Pembangunan fisik sedang berjalan. Akad baru bisa dilakukan setelah konstruksi selesai 100%.`}
                    </p>
                  </div>
                )}

                {/* ── STATUS: Menunggu Serah Terima ── */}
                {kpr.unitStatus === "menunggu_serah_terima" && !isHandoverDone && (
                  <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-3.5 space-y-2 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-violet-700">Menunggu Serah Terima</span>
                    </div>
                    <p className="text-[10px] font-semibold text-violet-700 leading-relaxed">
                      ⏳ Dana KPR telah direalisasikan. Unit menunggu proses serah terima fisik kepada konsumen.
                    </p>
                  </div>
                )}

                {/* ── SERAH TERIMA — Tombol Approve ── */}
                {canShowHandoverSection && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3.5 space-y-2.5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Serah Terima Konsumen</span>
                    </div>
                    <p className="text-[10px] font-semibold text-emerald-700 leading-relaxed">
                      ✓ BAST Developer → Konsumen telah diverifikasi. Unit siap untuk diserahterimakan.
                    </p>
                    <Button
                      type="button"
                      disabled={handoverLoading}
                      onClick={handleApproveHandover}
                      className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-sm transition-all disabled:opacity-60"
                    >
                      {handoverLoading ? "Memproses..." : "✅ Selesaikan Serah Terima"}
                    </Button>
                  </div>
                )}

                {/* ── STATUS: Serah Terima Selesai ── */}
                {isHandoverDone && (
                  <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-3.5 space-y-1.5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-teal-500" />
                      <span className="text-[10px] font-black uppercase tracking-wider text-teal-700">Serah Terima Selesai</span>
                    </div>
                    <p className="text-[10px] font-semibold text-teal-700 leading-relaxed">
                      ✓ Unit telah resmi diserahterimakan kepada konsumen. BAST Developer → Konsumen telah disetujui.
                    </p>
                  </div>
                )}
              </form>
            )}
          </div>

          {/* RIGHT TAB CONTAINER (3/5 Width) */}
          <div className="flex-1 p-5 overflow-y-auto flex flex-col">
            <Tabs defaultValue="docs" className="w-full flex-1 flex flex-col">
              <TabsList className="h-10 group-data-horizontal/tabs:h-10 grid w-full grid-cols-2 bg-[#E7E9E7]/60 border border-border rounded-xl p-1 mb-4 shrink-0">
                <TabsTrigger value="docs" className="h-full font-extrabold text-xs font-sans py-2 rounded-lg data-active:bg-card data-active:text-primary data-active:shadow-sm text-slate-500 hover:text-slate-800">
                  {t("kpr_dialog.tab_docs")}
                </TabsTrigger>
                <TabsTrigger value="bank" className="h-full font-extrabold text-xs font-sans py-2 rounded-lg data-active:bg-card data-active:text-primary data-active:shadow-sm text-slate-500 hover:text-slate-800">
                  {t("kpr_dialog.tab_bank")}
                </TabsTrigger>
              </TabsList>

              {/* TAB CONTENT: Berkas Syarat */}
              <TabsContent value="docs" className="space-y-4 focus-visible:outline-none flex-1">
                {error && !clientValidationError && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center gap-1.5 shadow-sm">
                    <Check className="h-4.5 w-4.5 text-emerald-600" />
                    <span>{error}</span>
                  </div>
                )}
                
                <div className="p-3.5 bg-secondary/40 rounded-2xl border border-border/80 text-xs text-foreground font-sans space-y-1 shadow-sm">
                  <span className="font-extrabold text-primary">{t("kpr_dialog.req_title")}</span>
                  <p className="leading-relaxed text-muted-foreground font-medium text-[11px]">{t("kpr_dialog.req_desc")}</p>
                </div>

                {/* Mandatories */}
                <div className="space-y-2.5">
                  <div className="text-[9px] font-black text-primary uppercase tracking-wider pl-1">
                    {t("kpr_dialog.sec_mandatory")}
                  </div>
                  {MANDATORY_DOCS.map((doc) => renderDocRow(doc))}
                </div>

                {/* Supportings */}
                <div className="space-y-2.5 pt-1">
                  <div className="text-[9px] font-black text-primary uppercase tracking-wider pl-1">
                    {t("kpr_dialog.sec_supporting")}
                  </div>
                  {SUPPORTING_DOCS.map((doc) => renderDocRow(doc))}
                </div>
              </TabsContent>

              {/* TAB CONTENT: Pengajuan Bank */}
              <TabsContent value="bank" className="space-y-4 focus-visible:outline-none flex-1">
                {error && !clientValidationError && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center gap-1.5 shadow-sm">
                    <Check className="h-4.5 w-4.5 text-emerald-600" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleBankSubmit} className="p-3.5 bg-card border border-border rounded-2xl space-y-3 shadow-sm">
                  <div className="text-[10px] font-black text-primary uppercase tracking-wider font-sans">{t("kpr_dialog.bank_submit")}</div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-muted-foreground">{t("kpr_dialog.bank_choose")}</Label>
                      <select
                        value={bankId}
                        onChange={(e) => setBankId(e.target.value)}
                        className="flex h-8.5 w-full rounded-xl border border-border bg-muted/30/60 px-2.5 py-1 text-xs focus:border-[#4F6F52] focus-visible:outline-none font-semibold"
                      >
                        <option value="">{t("kpr_dialog.bank_ph")}</option>
                        {bankPartners.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-muted-foreground">{t("kpr_dialog.date")}</Label>
                      <input
                        type="date"
                        value={subDate}
                        onChange={(e) => setSubDate(e.target.value)}
                        className="flex h-8.5 w-full rounded-xl border border-border bg-muted/30/60 px-2.5 py-1 text-xs focus:border-[#4F6F52] focus-visible:outline-none font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-muted-foreground">{t("kpr_dialog.plafond")}</Label>
                      <Input
                        type="number"
                        placeholder={t("kpr_dialog.plafond_ph")}
                        value={plafond}
                        onChange={(e) => {
                          setPlafond(e.target.value);
                          if (parseFloat(e.target.value) <= 0) {
                            setPlafondError("Plafond harus bernilai lebih dari 0.");
                          } else {
                            setPlafondError(null);
                          }
                        }}
                        className={`h-8.5 text-xs rounded-xl focus-visible:ring-ring/30 ${plafondError ? "border-red-500 focus-visible:ring-red-500" : "border-border"}`}
                      />
                      {plafondError && (
                        <p className="text-[8px] font-bold text-destructive pl-0.5 mt-0.5">{plafondError}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-bold text-muted-foreground">{t("kpr_dialog.tenor")}</Label>
                      <Input
                        type="number"
                        placeholder={t("kpr_dialog.tenor_ph")}
                        value={tenor}
                        onChange={(e) => {
                          setTenor(e.target.value);
                          const val = parseInt(e.target.value);
                          if (val <= 0 || val > 30) {
                            setTenorError("Tenor harus antara 1 s.d. 30 tahun.");
                          } else {
                            setTenorError(null);
                          }
                        }}
                        className={`h-8.5 text-xs rounded-xl focus-visible:ring-ring/30 ${tenorError ? "border-red-500 focus-visible:ring-red-500" : "border-border"}`}
                      />
                      {tenorError && (
                        <p className="text-[8px] font-bold text-destructive pl-0.5 mt-0.5">{tenorError}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button 
                      type="submit" 
                      disabled={loading || !!plafondError || !!tenorError || !bankId || !subDate} 
                      size="sm" 
                      className="bg-primary hover:bg-[#3F5941] text-white text-[10px] font-bold rounded-xl px-4 h-8.5 shadow-sm"
                    >
                      {loading ? t("kpr_dialog.btn_saving") : t("kpr_dialog.btn_send")}
                    </Button>
                  </div>
                </form>

                {/* Submissions list */}
                <div className="space-y-2.5">
                  <div className="text-[10px] font-black text-primary uppercase tracking-wider font-sans pl-1">{t("kpr_dialog.history")}</div>
                  {submissions.length > 0 ? (
                    submissions.map((sub) => {
                      const partner = bankPartners.find(b => b.id === sub.bankPartnerId);
                      
                      if (editingSubId === sub.id) {
                        return (
                          <div key={sub.id} className="p-3.5 bg-card border-2 border-primary/50 rounded-2xl text-xs shadow-md space-y-3 animate-fadeIn">
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-foreground">{partner?.name || "Bank Partner"}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteSubmission(sub.id)}
                                className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg shrink-0"
                                title="Hapus Pengajuan"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[9px] font-bold text-muted-foreground">Status</Label>
                                <select
                                  value={editStatus}
                                  onChange={(e) => setEditStatus(e.target.value as any)}
                                  className="flex h-8 w-full rounded-xl border border-border bg-muted/30/60 px-2 py-1 text-[11px] focus:border-[#4F6F52] focus-visible:outline-none font-semibold"
                                >
                                  <option value="submitted">{getBankSubmissionStatusLabel("submitted")}</option>
                                  <option value="verified">{getBankSubmissionStatusLabel("verified")}</option>
                                  <option value="offering">{getBankSubmissionStatusLabel("offering")}</option>
                                  <option value="approved">{getBankSubmissionStatusLabel("approved")}</option>
                                  <option value="rejected">{getBankSubmissionStatusLabel("rejected")}</option>
                                </select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[9px] font-bold text-muted-foreground">{t("kpr_dialog.plafond")}</Label>
                                <Input
                                  type="number"
                                  placeholder="Plafond"
                                  value={editPlafond}
                                  onChange={(e) => setEditPlafond(e.target.value)}
                                  className="h-8 text-[11px] rounded-xl border-border"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[9px] font-bold text-muted-foreground">{t("kpr_dialog.tenor")}</Label>
                                <Input
                                  type="number"
                                  placeholder="Tenor"
                                  value={editTenor}
                                  onChange={(e) => setEditTenor(e.target.value)}
                                  className="h-8 text-[11px] rounded-xl border-border"
                                />
                              </div>
                            </div>

                            <div className="flex justify-end gap-1.5 pt-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingSubId(null)}
                                className="text-muted-foreground font-bold h-8 rounded-xl text-[10px]"
                              >
                                {t("action.cancel")}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleSaveSubmission(sub.id)}
                                disabled={loading}
                                className="bg-primary hover:bg-[#3F5941] text-white font-bold h-8 rounded-xl px-3 text-[10px]"
                              >
                                {loading ? t("kpr_dialog.btn_saving") : "Simpan"}
                              </Button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={sub.id} className="p-3 bg-card border border-border rounded-2xl flex items-center justify-between text-xs shadow-sm hover:border-primary/50/60 transition-all">
                          <div>
                            <div className="font-extrabold text-foreground font-sans text-xs">{partner?.name || "Bank Partner"}</div>
                            <div className="text-muted-foreground font-mono text-[9px] mt-1 flex flex-wrap gap-x-2">
                              <span>{t("kpr_dialog.date_val", { date: new Date(sub.submissionDate).toLocaleDateString("id-ID") })}</span>
                              {sub.plafondAmount && (
                                <>
                                  <span className="text-[#D6DED2]">•</span>
                                  <span className="font-semibold text-foreground">{formatRupiah(sub.plafondAmount)}</span>
                                </>
                              )}
                              {sub.tenorYear && (
                                <>
                                  <span className="text-[#D6DED2]">•</span>
                                  <span>{t("kpr_dialog.tenor_val", { val: sub.tenorYear })}</span>
                                </>
                              )}
                            </div>
                          </div>
                          
                          <div className="shrink-0 flex items-center gap-1.5">
                            <Badge variant="outline" className={`text-[8px] uppercase font-bold rounded-md px-1.5 py-0.5 border ${
                              sub.status === "approved" 
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                                : sub.status === "rejected" 
                                ? "bg-rose-50 text-rose-700 border-rose-200" 
                                : "bg-slate-50 text-slate-600 border-slate-200"
                            }`}>
                              {getBankSubmissionStatusLabel(sub.status)}
                            </Badge>
                            
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSubId(sub.id);
                                setEditStatus(sub.status as any);
                                setEditPlafond(sub.plafondAmount ? String(sub.plafondAmount) : "");
                                setEditTenor(sub.tenorYear ? String(sub.tenorYear) : "");
                              }}
                              className="h-7 w-7 rounded-xl bg-slate-50 hover:bg-secondary/50 border border-border/50 text-primary flex items-center justify-center transition-all shadow-sm"
                              title="Edit Pengajuan"
                            >
                              <FileText className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-6 text-center text-xs text-muted-foreground italic bg-card rounded-2xl border border-border shadow-sm">
                      {t("kpr_dialog.history_empty")}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

        </div>

        {/* Document Delete Confirmation Dialog */}
        <Dialog open={!!deleteDocTarget} onOpenChange={(open) => !open && setDeleteDocTarget(null)}>
          <DialogContent className="max-w-sm rounded-3xl bg-card border border-border shadow-[0_8px_30px_rgba(79,111,82,0.15)] p-0 overflow-hidden z-[150]">
            <div className="flex flex-col items-center pt-7 pb-4 px-6 bg-gradient-to-b from-rose-50/60 to-transparent">
              <div className="h-11 w-11 rounded-full bg-rose-100 flex items-center justify-center mb-3 shadow-[0_0_0_4px_rgba(239,68,68,0.2)]">
                <Trash2 className="h-5 w-5 text-rose-600" />
              </div>
              <DialogTitle className="text-base font-black text-foreground text-center">{t("kpr_dialog.del_confirm")}</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground text-center mt-1 leading-relaxed max-w-[280px]">
                <Translate namespace="kpr_dialog" translationKey="del_desc" values={{ type: deleteDocTarget?.toUpperCase() || "" }} components={{ strong: <strong /> }} />
              </DialogDescription>
            </div>
            <div className="flex gap-3 px-6 pb-6 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeleteDocTarget(null)}
                className="flex-1 border-border text-muted-foreground hover:bg-muted/30 rounded-xl h-10 font-bold text-xs"
              >
                {t("action.cancel")}
              </Button>
              <Button
                onClick={executeDeleteDoc}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white rounded-xl h-10 text-xs font-bold shadow-sm"
              >
                {t("kpr_dialog.btn_del")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Hidden File Input for KPR Document Upload */}
        <input
          id="kpr-doc-file-input"
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </SheetContent>
    </Sheet>
  );

  // Helper row renderer for document items
  function renderDocRow(doc: { type: string; label: string }) {
    const docObj = docsList.find((d: any) => d.documentType === doc.type);
    const uploaded = !!docObj;
    const isRejectingThis = rejectingDocId === docObj?.id;

    // Dot Status color helpers
    let dotColorClass = "bg-slate-300"; // not uploaded
    if (uploaded) {
      if (docObj.status === "verified") dotColorClass = "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]";
      else if (docObj.status === "rejected") dotColorClass = "bg-rose-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]";
      else dotColorClass = "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]"; // uploaded
    }

    return (
      <div 
        key={doc.type} 
        className="p-3 rounded-2xl border transition-all duration-200 bg-card border-input/80 shadow-sm hover:shadow-md hover:border-primary/50/60"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Status Dot */}
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColorClass}`} />
            
            {/* Details */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-extrabold text-foreground block truncate max-w-[150px] sm:max-w-[200px]">{doc.label}</span>
                {uploaded && (
                  <Badge 
                    variant="outline" 
                    className={`text-[8px] font-black px-1.5 py-0 border rounded-md uppercase tracking-wider ${
                      docObj.status === "verified"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : docObj.status === "rejected"
                        ? "bg-rose-50 border-rose-200 text-rose-700"
                        : "bg-amber-50 border-amber-200 text-amber-700"
                    }`}
                  >
                    {docObj.status === "verified"
                      ? getDocumentVerificationStatusLabel("verified")
                      : docObj.status === "rejected"
                      ? getDocumentVerificationStatusLabel("rejected")
                      : "Menunggu Diverifikasi"}
                  </Badge>
                )}
              </div>
              {uploaded ? (
                <span className="text-[9px] text-muted-foreground font-mono block truncate max-w-[120px] sm:max-w-[175px] mt-0.5" title={docObj.fileName}>
                  {docObj.fileName || "dokumen.pdf"}
                </span>
              ) : (
                <span className="text-[9px] text-muted-foreground/70 font-semibold mt-0.5 block">
                  PDF, JPG, PNG (Maks. 5MB)
                </span>
              )}
            </div>
          </div>

          {/* Action Row */}
          <div className="shrink-0 flex items-center gap-1">
            {uploaded ? (
              <>
                {/* View */}
                {docObj.fileUrl && (
                  <a
                    href={docObj.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-8 px-2 rounded-xl bg-slate-50 hover:bg-secondary/50 border border-border/50 text-primary flex items-center justify-center transition-all shadow-sm"
                    title="Lihat Berkas"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </a>
                )}

                {/* Re-upload button for rejected files */}
                {docObj.status === "rejected" && (
                  <button
                    type="button"
                    onClick={() => handleReuploadDoc(doc.type, docObj.id)}
                    disabled={loading}
                    className="h-8 px-2 rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200/50 flex items-center justify-center transition-all shadow-sm font-bold text-[9px] gap-1"
                    title="Upload Ulang Berkas"
                  >
                    <Upload className="h-3.5 w-3.5 text-sky-600" />
                    <span className="hidden sm:inline">Upload Ulang</span>
                  </button>
                )}
                
                {/* Verification controls */}
                {canVerifyDocs && (
                  <>
                    {docObj.status !== "verified" && (
                      <button
                        type="button"
                        onClick={() => handleVerifyDoc(docObj.id, "verified")}
                        disabled={loading}
                        className="h-8 px-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/50 flex items-center justify-center transition-all shadow-sm font-bold text-[9px] gap-1"
                        title={t("kpr_dialog.btn_verify")}
                      >
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="hidden sm:inline">{t("kpr_dialog.btn_verify")}</span>
                      </button>
                    )}
                    {docObj.status !== "rejected" && !isRejectingThis && (
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingDocId(docObj.id);
                          setRejectionNotes("");
                        }}
                        disabled={loading}
                        className="h-8 px-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/50 flex items-center justify-center transition-all shadow-sm font-bold text-[9px] gap-1"
                        title={t("kpr_dialog.btn_reject")}
                      >
                        <X className="h-3.5 w-3.5 text-rose-600" />
                        <span className="hidden sm:inline">{t("kpr_dialog.btn_reject")}</span>
                      </button>
                    )}
                    {docObj.status === "verified" && (
                      <button
                        type="button"
                        onClick={() => handleVerifyDoc(docObj.id, "rejected", "Dibatalkan verifikasi")}
                        disabled={loading}
                        className="h-8 w-8 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200/50 flex items-center justify-center transition-all shadow-sm"
                        title="Batalkan & Tolak"
                      >
                        <RotateCcw className="h-3.5 w-3.5 text-rose-600" />
                      </button>
                    )}
                  </>
                )}

                {/* Delete */}
                {docObj.status !== "verified" && (
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(doc.type)}
                    disabled={loading}
                    className="h-8 w-8 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200/50 flex items-center justify-center transition-all shadow-sm disabled:opacity-50"
                    title="Hapus Berkas"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                  </button>
                )}
              </>
            ) : (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => triggerFileSelect(doc.type)}
                disabled={loading}
                className="text-[9px] font-extrabold h-8 px-2.5 rounded-xl border-border hover:bg-secondary/40 text-primary flex items-center gap-1 shadow-sm"
              >
                {loadingDocType === doc.type ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#4F6F52] border-t-transparent" />
                    <span>Upload...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-3 w-3" />
                    <span>{t("kpr_dialog.btn_upload")}</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Inline Rejection text area */}
        {uploaded && isRejectingThis && (
          <div className="mt-2.5 p-3 bg-rose-50/50 border border-rose-200/60 rounded-xl space-y-2 animate-fadeIn">
            <Label className="text-[10px] font-black text-rose-800 uppercase tracking-wide">
              {t("kpr_dialog.reject_reason_label")}
            </Label>
            <textarea
              value={rejectionNotes}
              onChange={(e) => setRejectionNotes(e.target.value)}
              placeholder={t("kpr_dialog.reject_reason_ph")}
              className="w-full text-xs p-2 rounded-lg border border-rose-200 bg-card focus:outline-none focus:border-rose-400 font-semibold"
            />
            <div className="flex justify-end gap-1.5 text-[9px]">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setRejectingDocId(null)}
                className="text-rose-700 hover:bg-rose-100/50 font-bold h-7 rounded-lg"
              >
                {t("action.cancel")}
              </Button>
              <Button
                size="sm"
                disabled={loading || !rejectionNotes.trim()}
                onClick={() => handleVerifyDoc(docObj.id, "rejected", rejectionNotes)}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold h-7 rounded-lg shadow-sm"
              >
                {t("kpr_dialog.btn_submit_reject")}
              </Button>
            </div>
          </div>
        )}

        {/* Rejection reason banner */}
        {uploaded && docObj.status === "rejected" && docObj.notes && !isRejectingThis && (
          <div className="mt-2.5 p-2.5 bg-rose-50/60 border border-rose-200/40 rounded-xl text-[10px] text-rose-700 font-semibold flex items-start gap-1.5 shadow-inner">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-black block text-[8px] uppercase tracking-wider text-rose-800">
                {t("kpr_dialog.reject_reason_label")}
              </span>
              <p className="mt-0.5 font-bold leading-relaxed">{docObj.notes}</p>
            </div>
          </div>
        )}
      </div>
    );
  }
}
