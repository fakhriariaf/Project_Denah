"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  HardHat,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  FileText,
  AlertTriangle,
  UploadCloud,
  FileBox,
  Truck,
  MessageSquare,
  Sparkles,
  Calendar,
  Layers,
  Wrench,
  TrendingUp,
  ClipboardList,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Camera,
  Clock,
  Loader2,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import {
  createSpk,
  activateSpk,
  inputProgress,
  checkOverdueSpks,
  createMaterialRequest,
  submitMaterialRequest,
  createHandoverEstimation,
  createCustomerComplaint,
  resolveComplaint,
  getSpkDetails,
  getHandoverEstimations,
  deleteSpk,
  updateSpk,
  uploadProgressPhotoAttachment,
  completeConstruction,
  uploadBastAttachment,
  getBastAttachmentForSpk,
  getCustomerBastForUnit,
  uploadCustomerBastFromProduction,
  deleteCustomerBastDocument,
} from "@/server/actions/production";
import { CustomerComplaintResolveDialog } from "@/components/dashboard/customer-complaint-resolve-dialog";

const SPK_STATUS_LABELS: Record<string, string> = {
  active: "Aktif",
  proses_konstruksi: "Proses Konstruksi",
  selesai_konstruksi: "Selesai Konstruksi",
  overdue: "Terlambat",
  completed: "Selesai",
  cancelled: "Batal",
  draft: "Draft",
};

interface ProductionShellProps {
  activeUser: { id: string; name: string; email: string; roleId?: string | null };
  projects: Array<{ id: string; name: string; code: string }>;
  units: Array<{ id: string; code: string; projectId: string | null; price: number; status: string; constructionProgress: number; readyStockSource?: string | null; isReadyStock?: boolean }>;
  customers: Array<{ id: string; name: string; phone: string }>;
  vendors: Array<{ id: string; name: string; phone: string | null }>;
  workItems: Array<{ id: string; code: string; name: string; defaultWeightPct: number }>;
  spks: Array<{
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
  }>;
  spmbs: Array<{
    id: string;
    spmbNumber: string;
    spkId: string | null;
    issueDate: Date;
    startWorkDate: Date;
    targetEndDate: Date;
    status: "issued" | "active" | "completed" | "cancelled";
    notes: string | null;
    createdAt: Date;
    spkNumber: string;
    spkTitle: string;
    projectName: string;
    unitCode: string;
  }>;
  materialRequests: Array<{
    id: string;
    requestNumber: string;
    spkId: string | null;
    projectId: string | null;
    unitId: string | null;
    vendorId: string | null;
    description: string;
    estimatedAmount: number;
    status: "draft" | "submitted" | "finance_pending" | "approved" | "rejected" | "purchased";
    transactionId: string | null;
    createdAt: Date;
    spkNumber: string;
    projectName: string;
    unitCode: string;
    vendorName: string | null;
  }>;
  complaints: Array<{
    id: string;
    complaintNumber: string;
    customerId: string | null;
    unitId: string | null;
    category: string;
    description: string;
    status: string;
    resolvedAt: Date | null;
    createdAt: Date;
    customerName: string;
    unitCode: string;
    projectName: string;
  }>;
  /** Set of unit IDs that have at least one paid DP invoice (Fase 6 gate) */
  dpPaidUnitIds: string[];
  isSuperAdmin?: boolean;
  isPengawas?: boolean;
  defaultTab?: "spk" | "progress" | "materials" | "complaints";
}

export default function ProductionShell({
  activeUser,
  isSuperAdmin = false,
  isPengawas = false,
  projects,
  units,
  customers,
  vendors,
  workItems,
  spks,
  spmbs,
  materialRequests,
  complaints,
  dpPaidUnitIds,
  defaultTab,
}: ProductionShellProps) {
  const router = useRouter();
  const { t } = useI18n();
  const dpPaidUnitIdsSet = React.useMemo(() => new Set(dpPaidUnitIds), [dpPaidUnitIds]);
  const [activeTab, setActiveTab] = React.useState<"spk" | "progress" | "materials" | "complaints">(defaultTab || "spk");

  React.useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  // Modal Dialog states
  const [spkOpen, setSpkOpen] = React.useState(false);
  const [editingSpkId, setEditingSpkId] = React.useState<string | null>(null);
  const [spmbOpen, setSpmbOpen] = React.useState(false);
  const [progressOpen, setProgressOpen] = React.useState(false);
  const [materialOpen, setMaterialOpen] = React.useState(false);
  const [complaintOpen, setComplaintOpen] = React.useState(false);
  const [handoverOpen, setHandoverOpen] = React.useState(false);
  const [selectedResolveComplaint, setSelectedResolveComplaint] = React.useState<any | null>(null);
  const [resolveDialogOpen, setResolveDialogOpen] = React.useState(false);
  const [spkFormError, setSpkFormError] = React.useState<string | null>(null);



  // BAST Upload Dialog states
  const [bastDialogOpen, setBastDialogOpen] = React.useState(false);
  const [bastUnit, setBastUnit] = React.useState<any | null>(null);
  const [bastSpk, setBastSpk] = React.useState<any | null>(null);
  const [bastPdfFile, setBastPdfFile] = React.useState<File | null>(null);
  const [activeUnitBast, setActiveUnitBast] = React.useState<any | null>(null);
  const [customerBast, setCustomerBast] = React.useState<any | null>(null);

  // New TUGAS 9 states
  const [materialStep, setMaterialStep] = React.useState(1);
  const [materialNecessity, setMaterialNecessity] = React.useState(50);

  // Role-based access: who can manage (hapus/re-upload) BAST Konsumen
  // Server-side action also enforces this independently
  const canManageBast = isSuperAdmin || isPengawas;

  // Interactive detail viewing state
  const [selectedSpkId, setSelectedSpkId] = React.useState<string | null>(null);
  const [lastSelectedSpkId, setLastSelectedSpkId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (selectedSpkId) {
      setLastSelectedSpkId(selectedSpkId);
    }
  }, [selectedSpkId]);

  const [selectedUnitId, setSelectedUnitId] = React.useState<string | null>(null);
  const [spkWeights, setSpkWeights] = React.useState<Array<{ workItemId: string; name: string; weightPct: number; currentProgress: number }>>([]);
  const [handoverEstimations, setHandoverEstimations] = React.useState<Array<any>>([]);
  const [formWeights, setFormWeights] = React.useState<Array<{ workItemId: string; weightPct: number }>>([]);

  // Form states
  const [newSpk, setNewSpk] = React.useState<{
    projectId: string;
    unitId: string;
    vendorId: string;
    title: string;
    workDescription: string;
    specification: string;
    rabAmount: string;
    startDate: string;
    targetEndDate: string;
  }>({
    projectId: "",
    unitId: "",
    vendorId: "",
    title: "",
    workDescription: "",
    specification: "",
    rabAmount: "",
    startDate: "",
    targetEndDate: "",
  });

  const [newProgress, setNewProgress] = React.useState<{
    spkId: string;
    workItemId: string;
    percentageAdded: number;
    progressDate: string;
    notes: string;
  }>({
    spkId: "",
    workItemId: "",
    percentageAdded: 10,
    progressDate: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const [newMaterial, setNewMaterial] = React.useState<{
    spkId: string;
    projectId: string;
    unitId: string;
    vendorId: string;
    description: string;
    estimatedAmount: string;
  }>({
    spkId: "",
    projectId: "",
    unitId: "",
    vendorId: "",
    description: "",
    estimatedAmount: "",
  });

  const [newComplaint, setNewComplaint] = React.useState<{
    customerId: string;
    unitId: string;
    title: string;
    category: "bangunan" | "serah_terima" | "listrik_air" | "legalitas" | "fasilitas" | "pelayanan" | "after_sales" | "lainnya";
    description: string;
  }>({
    customerId: "",
    unitId: "",
    title: "",
    category: "bangunan",
    description: "",
  });

  const [newHandover, setNewHandover] = React.useState<{
    unitId: string;
    spkId: string;
    handoverType: "vendor_to_developer" | "developer_to_customer";
    estimatedHandoverDate: string;
    calculationNote: string;
  }>({
    unitId: "",
    spkId: "",
    handoverType: "vendor_to_developer",
    estimatedHandoverDate: "",
    calculationNote: "",
  });

  const handoverValidationError = React.useMemo(() => {
    if (!newHandover.unitId) return null;
    const selectedUnit = units.find(u => u.id === newHandover.unitId);
    if (!selectedUnit) return null;

    if (newHandover.handoverType === "vendor_to_developer") {
      const statusStr = selectedUnit.status as string;
      if (statusStr === "construction_done" || statusStr === "sold" || statusStr === "menunggu_serah_terima" || statusStr === "handover_complete") {
        return "⚠️ BAST Vendor ke Developer untuk unit ini sudah selesai dilakukan. Silakan pilih BAST Developer ke Konsumen.";
      }
      if (selectedUnit.constructionProgress < 100) {
        return "⚠️ BAST Vendor ke Developer hanya dapat dikalkulasikan jika progres pembangunan unit sudah mencapai 100%.";
      }
    } else if (newHandover.handoverType === "developer_to_customer") {
      const statusStr = selectedUnit.status as string;
      if (statusStr === "available" || statusStr === "belum_siap") {
        return "⚠️ Unit belum terbooking oleh konsumen aktif.";
      }
      if (statusStr === "construction") {
        return "⚠️ Pembangunan unit fisik harus diserahterimakan oleh Vendor terlebih dahulu (Status unit harus 'Selesai Bangun').";
      }
    }
    return null;
  }, [newHandover.unitId, newHandover.handoverType, units]);

  // Photos dropzone state
  const [uploadedPhotos, setUploadedPhotos] = React.useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
  const [spkLogs, setSpkLogs] = React.useState<Array<any>>([]);


  // Calculate high-level stats
  const activeSpksCount = spks.filter(s => s.status === "active" || s.status === "proses_konstruksi").length;
  const overdueSpksCount = spks.filter(s => s.status === "overdue").length;
  const completedSpksCount = spks.filter(s => s.status === "completed" || s.status === "selesai_konstruksi").length;
  const openComplaintsCount = complaints.filter(c => c.status === "open").length;
  
  const constructionUnits = units.filter(u => u.status === "construction");
  const avgProgress = constructionUnits.length > 0
    ? Math.round(constructionUnits.reduce((sum, u) => sum + u.constructionProgress, 0) / constructionUnits.length)
    : 0;

  // Group active SPKs by vendor/contractor (Leaderboard / Performance)
  const vendorPerformance = React.useMemo(() => {
    const perfMap = new Map<string, {
      id: string;
      name: string;
      activeSpks: number;
      completedSpks: number;
      totalProgress: number;
      overdueSpks: number;
    }>();

    // Initialize with all vendors
    vendors.forEach(v => {
      perfMap.set(v.id, {
        id: v.id,
        name: v.name,
        activeSpks: 0,
        completedSpks: 0,
        totalProgress: 0,
        overdueSpks: 0,
      });
    });

    // Populate data from spks
    spks.forEach(s => {
      if (!s.vendorId) return;
      let p = perfMap.get(s.vendorId);
      if (!p) {
        p = {
          id: s.vendorId,
          name: s.vendorName || "Kontraktor Tanpa Nama",
          activeSpks: 0,
          completedSpks: 0,
          totalProgress: 0,
          overdueSpks: 0,
        };
        perfMap.set(s.vendorId, p);
      }

      if (s.status === "active" || s.status === "proses_konstruksi") {
        p.activeSpks += 1;
        p.totalProgress += s.progressPct;
      } else if (s.status === "completed" || s.status === "selesai_konstruksi") {
        p.completedSpks += 1;
        p.totalProgress += 100;
      } else if (s.status === "overdue") {
        p.overdueSpks += 1;
        p.totalProgress += s.progressPct;
      }
    });

    return Array.from(perfMap.values())
      .map(p => {
        const totalSpks = p.activeSpks + p.completedSpks + p.overdueSpks;
        const avgSpkProgress = totalSpks > 0 ? Math.round(p.totalProgress / totalSpks) : 0;
        
        // Calculate efficiency rating based on progress vs target end date SLA
        let rating = "A";
        let ratingColor = "bg-[#DDE8D8] text-[#4F6F52]";
        if (p.overdueSpks > 0) {
          rating = "C";
          ratingColor = "bg-red-50 text-red-700 border border-red-200";
        } else if (avgSpkProgress < 50 && p.activeSpks > 0) {
          rating = "B";
          ratingColor = "bg-amber-50 text-amber-700 border border-amber-200";
        } else {
          ratingColor = "bg-[#DDE8D8] text-[#4F6F52] border border-[#8FAF9A]/30";
        }

        return {
          ...p,
          totalSpks,
          avgSpkProgress,
          rating,
          ratingColor,
        };
      })
      .filter(p => p.totalSpks > 0); // Only show active/historical contractors
  }, [spks, vendors]);

  // Dynamic SPK components list for the currently selected SPK in progress modal
  const currentSpkComponents = React.useMemo(() => {
    if (newProgress.spkId && selectedSpkId === newProgress.spkId && spkWeights.length > 0) {
      return spkWeights.map(w => ({
        id: w.workItemId,
        name: w.name,
        weightPct: w.weightPct,
        currentProgress: w.currentProgress,
      }));
    }
    return workItems.map(item => ({
      id: item.id,
      name: item.name,
      weightPct: item.defaultWeightPct,
      currentProgress: 0,
    }));
  }, [newProgress.spkId, selectedSpkId, spkWeights, workItems]);

  const selectedComponent = React.useMemo(() => {
    return currentSpkComponents.find(c => c.id === newProgress.workItemId);
  }, [currentSpkComponents, newProgress.workItemId]);

  const currentProgressPct = selectedComponent ? selectedComponent.currentProgress : 0;
  const componentWeightPct = selectedComponent ? selectedComponent.weightPct : 0;
  const newTotalProgress = Math.min(100, currentProgressPct + (newProgress.percentageAdded || 0));
  const isOverLimit = (currentProgressPct + (newProgress.percentageAdded || 0)) > 100;

  // Handle run overdue scanner
  const handleRunOverdueScanner = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await checkOverdueSpks();
      setSuccessMessage(`Scanner selesai! Berhasil memperbarui ${res.updatedCount} SPK & Unit menjadi Terlambat (Overdue).`);
      router.refresh();
    } catch (e: any) {
      setErrorMessage(e.message || "Gagal menjalankan scanner.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle SPK deletion
  const handleDeleteSpk = async (id: string, spkNumber: string) => {
    const confirmed = window.confirm(`Apakah Anda yakin ingin menghapus SPK "${spkNumber}"? Tindakan ini tidak dapat dibatalkan.`);
    if (!confirmed) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await deleteSpk(id);
      if (res.success) {
        setSuccessMessage(`Surat Perintah Kerja (SPK) "${spkNumber}" berhasil dihapus.`);
        if (selectedSpkId === id) {
          setSelectedSpkId(null);
        }
        router.refresh();
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Gagal menghapus SPK.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle SPK edit trigger click
  const handleEditSpkClick = async (s: any) => {
    setEditingSpkId(s.id);
    setNewSpk({
      projectId: s.projectId || "",
      unitId: s.unitId || "",
      vendorId: s.vendorId || "",
      title: s.title || "",
      workDescription: s.workDescription || "",
      specification: s.specification || "",
      rabAmount: String(s.rabAmount || ""),
      startDate: new Date(s.startDate).toISOString().slice(0, 10),
      targetEndDate: new Date(s.targetEndDate).toISOString().slice(0, 10),
    });

    try {
      const details = await getSpkDetails(s.id);
      if (details && details.weights && details.weights.length > 0) {
        const weightsMap = details.weights.map(w => ({
          workItemId: w.workItem.id,
          weightPct: w.weight.weightPct,
        }));
        setFormWeights(weightsMap);
      } else {
        setFormWeights(workItems.map(item => ({
          workItemId: item.id,
          weightPct: item.defaultWeightPct,
        })));
      }
    } catch (err) {
      console.error("Gagal memuat bobot SPK:", err);
      setFormWeights(workItems.map(item => ({
        workItemId: item.id,
        weightPct: item.defaultWeightPct,
      })));
    }

    setSpkOpen(true);
  };

  // Handle SPK creation/update submit
  const handleCreateSpk = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const totalFormWeight = formWeights.reduce((sum, w) => sum + (w.weightPct || 0), 0);
    if (totalFormWeight !== 100) {
      setSpkFormError(`Total bobot komponen harus tepat 100%. Saat ini: ${totalFormWeight}%. Silakan sesuaikan kembali.`);
      setIsSubmitting(false);
      return;
    }

    try {
      if (editingSpkId) {
        // Edit SPK Mode
        await updateSpk(editingSpkId, {
          projectId: newSpk.projectId,
          unitId: newSpk.unitId,
          vendorId: newSpk.vendorId,
          title: newSpk.title,
          workDescription: newSpk.workDescription,
          specification: newSpk.specification || null,
          rabAmount: Number(newSpk.rabAmount),
          startDate: new Date(newSpk.startDate),
          targetEndDate: new Date(newSpk.targetEndDate),
          customWeights: formWeights,
        });
        setSuccessMessage(`Surat Perintah Kerja (SPK) berhasil diperbarui!`);
      } else {
        // Create SPK Mode
        await createSpk({
          projectId: newSpk.projectId,
          unitId: newSpk.unitId,
          vendorId: newSpk.vendorId,
          title: newSpk.title,
          workDescription: newSpk.workDescription,
          specification: newSpk.specification || null,
          rabAmount: Number(newSpk.rabAmount),
          startDate: new Date(newSpk.startDate),
          targetEndDate: new Date(newSpk.targetEndDate),
          customWeights: formWeights,
        });
        setSuccessMessage("Surat Perintah Kerja (SPK) baru berhasil diterbitkan dengan status AKTIF!");
      }
      
      setSpkFormError(null);
      setSpkOpen(false);
      setEditingSpkId(null);
      setNewSpk({
        projectId: "",
        unitId: "",
        vendorId: "",
        title: "",
        workDescription: "",
        specification: "",
        rabAmount: "",
        startDate: "",
        targetEndDate: "",
      });
      router.refresh();
    } catch (e: any) {
      // Parse Zod validation errors into readable messages
      let msg = "Gagal memproses SPK.";
      try {
        const parsed = JSON.parse(e.message);
        if (Array.isArray(parsed)) {
          msg = parsed.map((err: any) => err.message || err.path?.join(".")).join(", ");
        } else if (parsed.message) {
          msg = parsed.message;
        }
      } catch {
        msg = e.message || msg;
      }
      setSpkFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle SPK activation (Mulai Konstruksi, transitions from active to proses_konstruksi, auto generates SPMB)
  const handleActivateSpk = async (spkId: string) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await activateSpk(spkId);
      setSuccessMessage("Pembangunan unit berhasil dimulai dan Surat Perintah Mulai Bekerja (SPMB) diterbitkan secara otomatis!");
      router.refresh();
    } catch (e: any) {
      setErrorMessage(e.message || "Gagal memulai konstruksi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle field progress update submit
  const handleInputProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      let photoAttachmentId: string | null = null;
      const photoAttachmentIds: string[] = [];

      // If physical files have been selected, upload all of them
      if (selectedFiles.length > 0) {
        for (const fileToUpload of selectedFiles) {
          const formData = new FormData();
          formData.append("file", fileToUpload);

          const uploadRes = await fetch("/api/upload-attachment", {
            method: "POST",
            body: formData,
          });

          if (!uploadRes.ok) {
            const errData = await uploadRes.json();
            throw new Error(errData.error || "Gagal mengunggah foto progress ke storage.");
          }

          const fileData = await uploadRes.json();

          // Save metadata to attachments table
          const attachmentRes = await uploadProgressPhotoAttachment(newProgress.spkId, {
            fileName: fileToUpload.name,
            fileUrl: fileData.url,
            mimeType: fileToUpload.type,
            fileSize: fileToUpload.size,
          });

          if (attachmentRes.success) {
            photoAttachmentIds.push(attachmentRes.attachmentId);
          }
        }

        if (photoAttachmentIds.length > 0) {
          photoAttachmentId = photoAttachmentIds[0];
        }
      }

      await inputProgress({
        spkId: newProgress.spkId,
        workItemId: newProgress.workItemId,
        percentageAdded: Number(newProgress.percentageAdded),
        progressDate: new Date(newProgress.progressDate),
        photoAttachmentId: photoAttachmentId || null,
        photoAttachmentIds: photoAttachmentIds.length > 0 ? photoAttachmentIds : null,
        notes: newProgress.notes || null,
      });

      setSuccessMessage("Progress lapangan berhasil dicatat dan bobot total terupdate!");
      setProgressOpen(false);
      setUploadedPhotos([]); // Clear photos on success
      setSelectedFiles([]); // Clear raw files on success

      // Refresh details if visible
      if (selectedSpkId === newProgress.spkId) {
        handleViewSpkDetails(newProgress.spkId);
      }
      setNewProgress({
        spkId: "",
        workItemId: "",
        percentageAdded: 10,
        progressDate: new Date().toISOString().slice(0, 10),
        notes: "",
      });
      router.refresh();
    } catch (e: any) {
      setErrorMessage(e.message || "Gagal menginput progress.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle material request submit
  const handleCreateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const selectedSpk = spks.find(s => s.id === newMaterial.spkId);
      if (!selectedSpk) throw new Error("SPK tidak ditemukan");

      await createMaterialRequest({
        spkId: newMaterial.spkId,
        projectId: selectedSpk.projectId,
        unitId: selectedSpk.unitId,
        vendorId: selectedSpk.vendorId || null,
        description: newMaterial.description,
        estimatedAmount: Number(newMaterial.estimatedAmount),
      });
      setSuccessMessage("Request kebutuhan material baru berhasil diajukan dengan status DRAFT!");
      setMaterialOpen(false);
      setNewMaterial({
        spkId: "",
        projectId: "",
        unitId: "",
        vendorId: "",
        description: "",
        estimatedAmount: "",
      });
      router.refresh();
    } catch (e: any) {
      setErrorMessage(e.message || "Gagal mengajukan material.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle material submit to finance
  const handleSubmitMaterialToFinance = async (requestId: string) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await submitMaterialRequest(requestId);
      setSuccessMessage("Request material berhasil diteruskan ke departemen Keuangan untuk persetujuan Kas Keluar (Expense)!");
      router.refresh();
    } catch (e: any) {
      setErrorMessage(e.message || "Gagal meneruskan request ke keuangan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle complaint intake submit
  const handleCreateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await createCustomerComplaint(newComplaint);
      setSuccessMessage("Komplain kualitas/keterlambatan berhasil dimasukkan ke sistem!");
      setComplaintOpen(false);
      setNewComplaint({
        customerId: "",
        unitId: "",
        title: "",
        category: "bangunan",
        description: "",
      });
      router.refresh();
    } catch (e: any) {
      setErrorMessage(e.message || "Gagal menyimpan komplain.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle complaint resolution trigger (open dialog)
  const handleResolveComplaint = (complaint: any) => {
    setSelectedResolveComplaint(complaint);
    setResolveDialogOpen(true);
  };

  // Handle handover estimation submit
  const handleCreateHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await createHandoverEstimation({
        unitId: newHandover.unitId,
        spkId: newHandover.spkId,
        handoverType: newHandover.handoverType,
        estimatedHandoverDate: new Date(newHandover.estimatedHandoverDate),
        calculationNote: newHandover.calculationNote || null,
      });
      setSuccessMessage("Kalkulasi estimasi serah terima unit berhasil disimpan!");
      setHandoverOpen(false);
      setNewHandover({
        unitId: "",
        spkId: "",
        handoverType: "vendor_to_developer",
        estimatedHandoverDate: "",
        calculationNote: "",
      });
      // reload estimations if showing
      if (selectedUnitId === newHandover.unitId) {
        handleViewUnitProgress(newHandover.unitId);
      }
      router.refresh();
    } catch (e: any) {
      setErrorMessage(e.message || "Gagal menyimpan estimasi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle unit construction completion with BAST upload
  const handleCompleteConstructionWithBast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bastUnit || !bastSpk || !bastPdfFile) {
      setErrorMessage("⚠️ Silakan pilih file PDF Berita Acara Serah Terima (BAST) terlebih dahulu.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // 1. Upload PDF file to storage
      const formData = new FormData();
      formData.append("file", bastPdfFile);

      const uploadRes = await fetch("/api/upload-attachment", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json();
        throw new Error(errData.error || "Gagal mengunggah PDF BAST ke storage.");
      }

      const fileData = await uploadRes.json();

      // 2. Save metadata to attachments table
      const attachmentRes = await uploadBastAttachment(bastSpk.id, {
        fileName: bastPdfFile.name,
        fileUrl: fileData.url,
        mimeType: bastPdfFile.type,
        fileSize: bastPdfFile.size,
      });

      if (!attachmentRes.success) {
        throw new Error("Gagal menyimpan metadata BAST ke database.");
      }

      // 3. Complete construction with the attachment ID
      const res = await completeConstruction(bastUnit.id, attachmentRes.attachmentId);
      if (res.success) {
        setSuccessMessage(`Unit "${bastUnit.code}" berhasil dinyatakan selesai pembangunan dan status berubah menjadi Tersedia - Ready Stock!`);
        setBastDialogOpen(false);
        setBastUnit(null);
        setBastSpk(null);
        setBastPdfFile(null);
        router.refresh();
      }
    } catch (e: any) {
      setErrorMessage(e.message || "Gagal menyelesaikan pembangunan unit.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fetch SPK details dynamically — data real dari DB
  const handleViewSpkDetails = async (spkId: string) => {
    setSelectedSpkId(spkId);
    setSelectedUnitId(null);
    try {
      const details = await getSpkDetails(spkId);
      if (!details) return;

      setSpkLogs(details.logs || []);

      // Hitung progress per work item dari progress logs nyata
      const items = details.weights.map(w => {
        // Sum semua log progress untuk work item ini
        const totalProgress = details.logs
          .filter(l => l.log.workItemId === w.weight.workItemId)
          .reduce((sum, l) => sum + l.log.percentageAdded, 0);

        return {
          workItemId: w.workItem.id,
          name: w.workItem.name,
          weightPct: w.weight.weightPct,
          currentProgress: Math.min(100, totalProgress),
        };
      });

      setSpkWeights(items);
    } catch (e) {
      console.error("Gagal memuat detail SPK:", e);
      setErrorMessage(e instanceof Error ? e.message : "Gagal memuat detail SPK.");
    }
  };

  // Show visual unit progress & real handover estimations from DB
  const handleViewUnitProgress = async (unitId: string) => {
    setSelectedUnitId(unitId);
    setSelectedSpkId(null);
    
    // Auto populate handover form dengan linked SPK
    const linkedSpk = spks.find(s => s.unitId === unitId && s.status !== "cancelled");
    setNewHandover(prev => ({
      ...prev,
      unitId,
      spkId: linkedSpk?.id || "",
    }));

    // Ambil estimasi serah terima nyata dari DB & SPK weights
    try {
      try {
        const custBast = await getCustomerBastForUnit(unitId);
        setCustomerBast(custBast);
      } catch (err) {
        console.error("Gagal memuat BAST Konsumen:", err);
        setCustomerBast(null);
      }

      const estimations = await getHandoverEstimations(unitId);
      setHandoverEstimations(
        estimations.map(e => ({
          id: e.estimation.id,
          estimatedHandoverDate: new Date(e.estimation.estimatedHandoverDate),
          calculationNote: e.estimation.calculationNote || null,
          createdAt: new Date(e.estimation.createdAt ?? Date.now()),
        }))
      );

      if (linkedSpk) {
        try {
          const bast = await getBastAttachmentForSpk(linkedSpk.id);
          setActiveUnitBast(bast);
        } catch (err) {
          console.error("Gagal memuat BAST:", err);
          setActiveUnitBast(null);
        }

        const details = await getSpkDetails(linkedSpk.id);
        if (details) {
          setSpkLogs(details.logs || []);
          const items = details.weights.map(w => {
            const totalProgress = details.logs
              .filter(l => l.log.workItemId === w.weight.workItemId)
              .reduce((sum, l) => sum + l.log.percentageAdded, 0);
            return {
              workItemId: w.workItem.id,
              name: w.workItem.name,
              weightPct: w.weight.weightPct,
              currentProgress: Math.min(100, totalProgress),
            };
          });
          setSpkWeights(items);
        } else {
          setSpkWeights([]);
          setSpkLogs([]);
        }
      } else {
        setSpkWeights([]);
        setSpkLogs([]);
        setActiveUnitBast(null);
      }
    } catch (err) {
      console.error("Gagal memuat detail unit:", err);
      setErrorMessage(err instanceof Error ? err.message : "Gagal memuat detail unit.");
      setHandoverEstimations([]);
      setSpkWeights([]);
    }
  };

  // Filter SPK lists
  const filteredSpks = spks.filter(s => {
    const q = searchQuery.toLowerCase();
    return (
      s.spkNumber.toLowerCase().includes(q) ||
      s.title.toLowerCase().includes(q) ||
      s.unitCode.toLowerCase().includes(q) ||
      s.vendorName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 font-sans">
      {/* ── PREMIUM HEADER ── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#DDE8D8]/70 via-white/95 to-[#DDE8D8]/40 border border-[#D6DED2] shadow-sage p-6 mb-6">
        <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-[#8FAF9A]/10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 h-20 w-20 rounded-full bg-[#4F6F52]/8 blur-xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-[#4F6F52] flex items-center justify-center shadow-[0_4px_12px_rgba(79,111,82,0.3)] shrink-0">
              <HardHat className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-[#243028] tracking-tight">{t("production.title")}</h2>
              <p className="text-sm text-[#66736A] mt-0.5">{t("production.subtitle")}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-end md:self-center">
            <Button
              onClick={handleRunOverdueScanner}
              disabled={isSubmitting}
              variant="outline"
              className="bg-white/90 backdrop-blur-sm border-[#D6DED2] text-[#4F6F52] hover:bg-[#8FAF9A]/10 font-bold rounded-xl h-10 shadow-sm"
            >
              <Calendar className="mr-2 h-4 w-4 text-[#4F6F52]" />
              {t("production.btn_scan_overdue")}
            </Button>

            <Button
              onClick={() => {
                setEditingSpkId(null);
                setNewSpk({
                  projectId: "",
                  unitId: "",
                  vendorId: "",
                  title: "",
                  workDescription: "",
                  specification: "",
                  rabAmount: "",
                  startDate: "",
                  targetEndDate: "",
                });
                setFormWeights(workItems.map(item => ({
                  workItemId: item.id,
                  weightPct: item.defaultWeightPct,
                })));
                setSpkOpen(true);
              }}
              className="bg-[#4F6F52] hover:bg-[#3D563F] text-white font-bold rounded-xl h-10 shadow-[0_4px_14px_rgba(79,111,82,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("production.btn_new_spk")}
            </Button>
          </div>
        </div>
      </div>

      {/* ALERT BANNERS */}
      {errorMessage && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
          <XCircle className="h-5 w-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-[#DDE8D8] border border-[#8FAF9A]/40 text-[#4F6F52] text-sm font-medium animate-fade-in">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* 2. SYSTEM STATS GRID (PREMIUM CARD DESIGN) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-[#8FAF9A]/20 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("production.kpi_active_spk")}
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <ClipboardList className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-foreground tabular-nums">
              {activeSpksCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <span className="text-[#4F6F52] font-semibold">{completedSpksCount} {t("production.kpi_done")}</span> {t("production.kpi_this_year")}
            </p>
          </CardContent>
        </Card>

        <Card className="border-[#8FAF9A]/20 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("production.kpi_overdue")}
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-destructive tabular-nums">
              {overdueSpksCount}
            </div>
            <p className="text-xs text-destructive mt-1 font-medium">
              {t("production.kpi_overdue_desc")}
            </p>
          </CardContent>
        </Card>

        <Card className="border-[#8FAF9A]/20 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("production.kpi_avg_progress")}
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-primary tabular-nums">
              {avgProgress}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("production.kpi_avg_desc", { count: constructionUnits.length })}
            </p>
          </CardContent>
        </Card>

        <Card className="border-[#8FAF9A]/20 shadow-sm hover:shadow-md transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("production.kpi_complaints")}
            </CardTitle>
            <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold tracking-tight text-amber-500 tabular-nums">
              {openComplaintsCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t("production.kpi_complaints_desc")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3. TABS SELECTION CONTROLS */}
      <div className="flex border-b border-border gap-2">
        <button
          onClick={() => { setActiveTab("spk"); setSearchQuery(""); }}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors duration-200 flex items-center gap-2 ${
            activeTab === "spk"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <FileText className="h-4 w-4" />
          {t("production.tab_spk")}
        </button>

        <button
          onClick={() => { setActiveTab("progress"); setSearchQuery(""); }}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors duration-200 flex items-center gap-2 ${
            activeTab === "progress"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="h-4 w-4" />
          {t("production.tab_progress")}
        </button>

        <button
          onClick={() => { setActiveTab("materials"); setSearchQuery(""); }}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors duration-200 flex items-center gap-2 ${
            activeTab === "materials"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Truck className="h-4 w-4" />
          {t("production.tab_materials")}
        </button>

        <button
          onClick={() => { setActiveTab("complaints"); setSearchQuery(""); }}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors duration-200 flex items-center gap-2 ${
            activeTab === "complaints"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          {t("production.tab_complaints")}
        </button>
      </div>

      {/* 4. ACTIVE TAB CONTENT PANEL */}
      <Card className="border-[#8FAF9A]/20 shadow-sm">
        <CardContent className="p-6">
          {/* TAB 1: SPK TAB PANEL */}
          {activeTab === "spk" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("production.spk_search_ph")}
                    className="pl-8 border-[#8FAF9A]/30 focus-visible:ring-primary"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="text-xs text-muted-foreground font-medium">
                  {t("production.spk_showing", { shown: filteredSpks.length, total: spks.length })}
                </div>
              </div>

              {/* PAPAN PERFORMA KONTRAKTOR LAPANGAN */}
              {vendorPerformance.length > 0 && (
                <div className="bg-[#F7F8F3]/80 p-5 rounded-3xl border border-[#8FAF9A]/30 space-y-4 shadow-[0_4px_20px_-2px_rgba(143,175,154,0.1)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                        <HardHat className="h-4 w-4 text-primary" />
                        {t("production.perf_board_title")}
                      </h4>
                      <p className="text-[11px] text-muted-foreground">{t("production.perf_board_desc")}</p>
                    </div>
                    <Badge className="bg-[#DDE8D8] text-[#4F6F52] font-semibold text-[10px] rounded-full border border-[#8FAF9A]/30 hover:bg-[#DDE8D8] shadow-none">
                      Live Audit
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {vendorPerformance.slice(0, 3).map((vp) => (
                      <div
                        key={vp.id}
                        className="bg-white/90 p-4 rounded-2xl border border-[#8FAF9A]/20 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-3 group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{t("production.perf_contractor_lbl")}</span>
                            <h5 className="font-bold text-sm text-[#243028] group-hover:text-primary transition-colors">{vp.name}</h5>
                          </div>
                          <Badge className={`${vp.ratingColor} font-extrabold text-[10px] px-2 py-0.5 rounded-md shadow-none border`}>
                            Grade {vp.rating}
                          </Badge>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-muted-foreground">{t("production.perf_avg_progress")}</span>
                            <span className="text-primary font-bold">{vp.avgSpkProgress}%</span>
                          </div>
                          <Progress value={vp.avgSpkProgress} className="h-1.5 bg-muted" />
                        </div>

                        <div className="grid grid-cols-3 gap-1 text-center border-t border-[#8FAF9A]/10 pt-2 text-[10px] font-semibold text-muted-foreground">
                          <div className="space-y-0.5">
                            <div className="text-foreground font-bold font-mono tabular-nums text-xs">{vp.totalSpks}</div>
                            <div>{t("production.perf_total_spk")}</div>
                          </div>
                          <div className="space-y-0.5 border-x border-[#8FAF9A]/10">
                            <div className="text-[#4F6F52] font-bold font-mono tabular-nums text-xs">{vp.completedSpks}</div>
                            <div>{t("production.perf_done")}</div>
                          </div>
                          <div className="space-y-0.5">
                            <div className="text-red-600 font-bold font-mono tabular-nums text-xs">{vp.overdueSpks}</div>
                            <div>{t("production.perf_overdue")}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          {t("production.spk_empty")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSpks.map((s) => (
                        <TableRow
                          key={s.id}
                          className="hover:bg-[#8FAF9A]/5 cursor-pointer transition-colors duration-150"
                          onClick={() => handleViewSpkDetails(s.id)}
                        >
                          <TableCell className="font-bold font-mono text-[#243028] text-xs">{s.spkNumber}</TableCell>
                          <TableCell>
                            <div className="font-extrabold text-[#243028] text-xs">{s.projectName}</div>
                            <div className="text-[10px] font-bold text-muted-foreground font-mono mt-0.5">Unit: {s.unitCode}</div>
                          </TableCell>
                          <TableCell className="font-semibold text-[#243028] text-xs">{s.vendorName}</TableCell>
                          <TableCell>
                            <div className="font-bold text-[#243028] text-xs">{s.title}</div>
                            <div className="text-[10px] text-muted-foreground truncate max-w-[150px] font-medium mt-0.5">{s.workDescription}</div>
                          </TableCell>
                          <TableCell className="font-bold font-mono text-xs">
                            {s.rabAmount === 0 ? (
                              <span className="text-rose-600 flex items-center gap-1">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                Rp 0
                              </span>
                            ) : (
                              <span className="text-[#4F6F52]">
                                Rp {s.rabAmount.toLocaleString("id-ID")}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-[10px] font-bold font-mono">
                            {new Date(s.targetEndDate).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' })}
                          </TableCell>
                          <TableCell className="align-middle">
                            <div className="flex flex-col items-center gap-1 w-20 mx-auto">
                              <Progress value={s.progressPct} className="h-1.5 w-16 bg-muted" />
                              <span className="text-[10px] font-extrabold text-primary font-mono">{s.progressPct}%</span>
                            </div>
                          </TableCell>
                           <TableCell>
                            <Badge
                              className={`shadow-none font-semibold text-[10px] ${
                                s.status === "completed" || s.status === "selesai_konstruksi"
                                  ? "bg-[#DDE8D8] text-[#4F6F52] border border-[#8FAF9A]/30"
                                  : s.status === "proses_konstruksi"
                                  ? "bg-purple-50 text-purple-700 border border-purple-200"
                                  : s.status === "active"
                                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                                  : s.status === "overdue"
                                  ? "bg-red-50 text-red-700 border border-red-200 animate-pulse"
                                  : "bg-gray-100 text-gray-700 border border-gray-200"
                              }`}
                            >
                              {s.status === "completed" || s.status === "selesai_konstruksi"
                                ? (s.status === "selesai_konstruksi" ? t("production.status_selesai_konstruksi") : t("production.status_done"))
                                : s.status === "proses_konstruksi"
                                ? t("production.status_proses_konstruksi")
                                : s.status === "active"
                                ? t("production.status_active")
                                : s.status === "overdue"
                                ? t("production.status_overdue")
                                : t("production.status_draft")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              {isSuperAdmin && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => handleEditSpkClick(s)}
                                    className="bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs h-7 px-2.5 rounded-md"
                                    title="Ubah Rincian SPK"
                                  >
                                    Ubah
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleDeleteSpk(s.id, s.spkNumber)}
                                    className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs h-7 px-2.5 rounded-md"
                                    title="Hapus SPK"
                                  >
                                    Hapus
                                  </Button>
                                </>
                              )}
                              {s.status === "active" && (
                                <Button
                                  size="sm"
                                  onClick={() => handleActivateSpk(s.id)}
                                  className="bg-primary hover:bg-[#4F6F52] text-primary-foreground font-semibold text-xs h-7"
                                >
                                  {t("production.btn_start_work")}
                                </Button>
                              )}
                              <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    if (selectedSpkId === s.id) {
                                      setSelectedSpkId(null);
                                    } else {
                                      handleViewSpkDetails(s.id);
                                    }
                                  }}
                                  className={`border-[#8FAF9A] text-primary hover:bg-[#8FAF9A]/10 text-xs h-7 flex items-center gap-1.5 transition-all duration-200 ${
                                    selectedSpkId === s.id 
                                      ? "bg-[#DDE8D8]/50 border-primary shadow-sm" 
                                      : ""
                                  }`}
                                >
                                  {t("production.btn_detail")}
                                  {selectedSpkId === s.id ? (
                                    <ChevronUp className="h-3.5 w-3.5 text-primary shrink-0 transition-transform duration-200" />
                                  ) : (
                                    <ChevronDown className="h-3.5 w-3.5 text-[#66736A] shrink-0 transition-transform duration-200" />
                                  )}
                                </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* DYNAMIC SIDE DRAWER FOR SPK DETAILS & WEIGHTED LOGS */}
              <div 
                className={`overflow-hidden transition-all duration-500 ease-in-out ${
                  selectedSpkId 
                    ? "max-h-[1200px] opacity-100 p-6 border-[#8FAF9A]/40 mt-6 bg-gradient-to-r from-background to-[#DDE8D8]/10 rounded-xl border space-y-6 shadow-sm" 
                    : "max-h-0 opacity-0 p-0 m-0 border-transparent pointer-events-none"
                }`}
              >
                {(() => {
                  const spk = spks.find(s => s.id === (selectedSpkId || lastSelectedSpkId));
                  if (!spk) return null;
                  return (
                    <div className="space-y-6">
                      {spk.rabAmount === 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <h5 className="font-bold text-amber-900 text-sm">Nilai RAB Belum Diverifikasi</h5>
                              <p className="text-amber-700 text-xs mt-1">
                                SPK ini dibuat secara otomatis dengan nilai RAB Rp 0. Silakan verifikasi dan ubah nilai RAB sesuai harga kontrak yang benar.
                              </p>
                            </div>
                          </div>
                          {isSuperAdmin && (
                            <Button
                              size="sm"
                              onClick={() => handleEditSpkClick(spk)}
                              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs whitespace-nowrap self-start sm:self-center"
                            >
                              Ubah Nilai RAB
                            </Button>
                          )}
                        </div>
                      )}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#8FAF9A]/20">
                        <div>
                          <div className="text-xs font-bold text-primary uppercase tracking-wider">{t("production.spk_detail_lbl")}</div>
                          <h3 className="text-xl font-bold text-foreground mt-1 flex items-center gap-2">
                            <span className="font-mono text-primary">{spk.spkNumber}</span> &mdash; {spk.title}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2">
                          {(() => {
                            const spkSpmb = spmbs.find(b => b.spkId === spk.id);
                            return spkSpmb ? (
                              <a
                                href={`/production/spmb/${spkSpmb.id}/print`}
                                className="border border-amber-500/50 text-amber-700 hover:bg-amber-50 font-semibold text-xs h-9 px-4 rounded-md flex items-center justify-center gap-1.5 transition-colors bg-background"
                              >
                                <FileText className="h-4 w-4 text-amber-600" />
                                {t("production.btn_print_spmb")}
                              </a>
                            ) : null;
                          })()}
                          {(spk.status === "completed" || spk.status === "selesai_konstruksi") && (
                            <a
                              href={`/production/spk/${spk.id}/bast/print`}
                              className="border border-emerald-500/50 text-emerald-700 hover:bg-emerald-50 font-semibold text-xs h-9 px-4 rounded-md flex items-center justify-center gap-1.5 transition-colors bg-background"
                            >
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              Cetak BAST
                            </a>
                          )}
                          {spk.status === "active" && (
                            <Button
                              size="sm"
                              onClick={() => handleActivateSpk(spk.id)}
                              className="bg-primary hover:bg-[#4F6F52] text-primary-foreground font-semibold text-xs h-9"
                            >
                              {t("production.btn_start_work")}
                            </Button>
                          )}
                          {(spk.status === "proses_konstruksi" || spk.status === "overdue") && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setNewProgress(prev => ({ ...prev, spkId: spk.id }));
                                handleViewSpkDetails(spk.id);
                                setProgressOpen(true);
                              }}
                              className="bg-[#4F6F52] hover:bg-[#3D563F] text-white font-semibold text-xs h-9"
                            >
                              <Wrench className="mr-1.5 h-3.5 w-3.5" />
                              {t("production.btn_input_progress")}
                            </Button>
                          )}

                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* COMPONENT WEIGHT BREAKDOWNS */}
                        <div className="md:col-span-2 space-y-4">
                          <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                            <Layers className="h-4 w-4 text-primary" />
                            Struktur Komponen & Bobot SLA Pembangunan
                          </h4>
                          <div className="space-y-3 bg-background p-4 rounded-lg border border-[#8FAF9A]/20">
                            {spkWeights.map((w) => (
                              <div key={w.workItemId} className="space-y-1">
                                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                                  <span>{w.name} <span className="text-muted-foreground">({t("production.weight_lbl")}: {w.weightPct}%)</span></span>
                                  <span className="text-primary font-bold">{w.currentProgress}%</span>
                                </div>
                                <Progress value={w.currentProgress} className="h-2 bg-muted" />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* DETAILS INFO CARD */}
                        <div className="space-y-4">
                          <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                            <Sparkles className="h-4 w-4 text-primary" />
                            Informasi SPK
                          </h4>
                          <div className="bg-background p-4 rounded-lg border border-[#8FAF9A]/20 space-y-3 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{t("production.info_project")}:</span>
                              <span className="font-semibold text-foreground">{spk.projectName}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{t("production.info_kavling")}:</span>
                              <span className="font-bold text-foreground font-mono">{spk.unitCode}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{t("production.info_contractor")}:</span>
                              <span className="font-semibold text-foreground">{spk.vendorName}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{t("production.info_value")}:</span>
                              <span className="font-bold text-primary font-mono tabular-nums">Rp {spk.rabAmount.toLocaleString("id-ID")}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">{t("production.info_duration")}:</span>
                              <span className="font-semibold text-foreground">
                                {new Date(spk.startDate).toLocaleDateString("id-ID")} s/d {new Date(spk.targetEndDate).toLocaleDateString("id-ID")}
                              </span>
                            </div>
                            {spk.specification && (
                              <div className="pt-2 border-t border-[#8FAF9A]/10">
                                <div className="text-muted-foreground mb-1">{t("production.info_spec")}:</div>
                                <p className="bg-[#8FAF9A]/5 p-2 rounded text-foreground italic font-medium leading-relaxed">
                                  {spk.specification}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* TAB 2: PROGRESS TAB PANEL */}
          {activeTab === "progress" && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground">{t("production.progress_title")}</h3>
                  <p className="text-xs text-muted-foreground">{t("production.progress_desc")}</p>
                </div>
                <Button
                  onClick={() => setHandoverOpen(true)}
                  className="bg-primary hover:bg-[#4F6F52] text-primary-foreground font-semibold text-xs"
                >
                  <Calendar className="mr-1.5 h-3.5 w-3.5" />
                  {t("production.btn_handover_calc")}
                </Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LIST OF UNITS IN CONSTRUCTION */}
                <div className="space-y-4 lg:col-span-1 border-r border-border pr-0 lg:pr-6">
                  <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    {t("production.construction_units_title")}
                  </h4>
                  <div className="space-y-2 max-h-[480px] overflow-y-auto">
                    {units.filter(u => 
                      u.status === "construction" || 
                      u.status === "construction_done" || 
                      u.status === "overdue" ||
                      spks.some(s => s.unitId === u.id && s.status !== "cancelled")
                    ).map((u) => (
                      <div
                        key={u.id}
                        onClick={() => handleViewUnitProgress(u.id)}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 flex items-center justify-between gap-4 ${
                          selectedUnitId === u.id
                            ? "bg-[#DDE8D8]/20 border-primary shadow-[0_4px_20px_-2px_rgba(143,175,154,0.15)] ring-1 ring-primary/30"
                            : "border-border bg-background hover:border-primary/30 hover:bg-[#8FAF9A]/5 hover:shadow-sm"
                        }`}
                      >
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-base text-foreground tracking-tight">{u.code}</span>
                            <Badge
                              className={`shadow-none font-semibold text-[10px] rounded-full px-2 py-0.5 ${
                                u.status === "construction_done" || (u.status === "available" && u.constructionProgress === 100)
                                  ? "bg-[#DDE8D8] text-[#4F6F52] border border-[#8FAF9A]/30"
                                  : u.status === "overdue"
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : u.status === "sold"
                                  ? "bg-red-50 text-red-700 border border-red-200"
                                  : "bg-blue-50 text-blue-700 border border-blue-200"
                              }`}
                            >
                              {u.status === "construction_done" || (u.status === "available" && u.constructionProgress === 100)
                                ? t("production.status_done")
                                : u.status === "sold"
                                ? "Terjual"
                                : u.status === "overdue"
                                ? t("production.status_overdue")
                                : t("production.status_construction")}
                            </Badge>
                          </div>
                          <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                            <HardHat className="h-3 w-3 text-muted-foreground/60" />
                            <span>{t("production.field_weight")}</span>
                          </div>
                        </div>

                        {/* Circular Radial Progress Ring */}
                        <div className="relative flex items-center justify-center h-12 w-12 flex-shrink-0">
                          {/* Background Ring */}
                          <svg className="w-full h-full transform -rotate-90">
                            <circle
                              cx="24"
                              cy="24"
                              r="18"
                              className="stroke-muted"
                              strokeWidth="3.5"
                              fill="transparent"
                            />
                            {/* Animated Foreground Ring */}
                            <circle
                              cx="24"
                              cy="24"
                              r="18"
                              className="stroke-primary transition-all duration-500 ease-out"
                              strokeWidth="3.5"
                              fill="transparent"
                              strokeDasharray={2 * Math.PI * 18}
                              strokeDashoffset={2 * Math.PI * 18 * (1 - u.constructionProgress / 100)}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-extrabold text-foreground tabular-nums">
                            {u.constructionProgress}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* VISUAL COMPONENT TRACKING & ESTIMATED DATE METRICS */}
                <div className="lg:col-span-2 space-y-6">
                  {selectedUnitId ? (
                    (() => {
                      const unit = units.find(u => u.id === selectedUnitId);
                      if (!unit) return null;
                      
                      const spk = spks.find(s => s.unitId === unit.id && s.status !== "cancelled");
                      
                      return (
                        <div className="space-y-6 animate-fade-in">
                          <div className="pb-4 border-b border-border flex justify-between items-center">
                            <div>
                              <h3 className="text-xl font-bold text-foreground">{t("production.unit_detail_title")}: {unit.code}</h3>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {t("production.unit_linked_spk")}: {spk ? `${spk.spkNumber} (${spk.title})` : t("production.unit_no_spk")}
                              </p>
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {unit.readyStockSource === "construction_flow" && (
                                  <span className="bg-[#EAF2EC] text-[#4F6F52] border border-[#8FAF9A]/30 text-[10px] font-extrabold px-2 py-0.5 rounded-lg">
                                    🏗️ Konstruksi ERP
                                  </span>
                                )}
                                {unit.readyStockSource === "legacy_ready_stock" && (
                                  <span className="bg-[#F4F6F0] text-[#606C5A] border border-[#8FAF9A]/20 text-[10px] font-extrabold px-2 py-0.5 rounded-lg">
                                    🏠 Legacy Ready Stock
                                  </span>
                                )}
                                {unit.readyStockSource === "manual_ready_stock" && (
                                  <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-extrabold px-2 py-0.5 rounded-lg">
                                    ⚙️ Manual Ready
                                  </span>
                                )}
                                {unit.isReadyStock ? (
                                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold px-2 py-0.5 rounded-lg">
                                    ✓ Ready Stock
                                  </span>
                                ) : (
                                  <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-extrabold px-2 py-0.5 rounded-lg">
                                    Indent
                                  </span>
                                )}
                              </div>
                            </div>
                            {((unit.status === "construction_done") || 
                              ((unit.status === "construction" || unit.status === "overdue") && unit.constructionProgress === 100)) && (
                              <Button
                                size="sm"
                                disabled={isSubmitting}
                                onClick={() => {
                                  setBastUnit(unit);
                                  setBastSpk(spk);
                                  setBastPdfFile(null);
                                  setBastDialogOpen(true);
                                }}
                                className="bg-[#4F6F52] hover:bg-[#3D563F] text-white font-extrabold text-xs h-9 rounded-xl flex items-center gap-1.5 shadow-[0_4px_12px_rgba(79,111,82,0.25)] transition-all"
                              >
                                <CheckCircle2 className="h-4 w-4 text-white" />
                                Selesai Pembangunan
                              </Button>
                            )}
                          </div>
                          <div className="space-y-2">
                            <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#66736A] px-1">
                              {unit.readyStockSource === "construction_flow" ? "BAST Vendor ke Developer (Wajib)" : "BAST Vendor ke Developer (Opsional / Arsip)"}
                            </p>
                            {activeUnitBast ? (
                              <div className="p-3.5 bg-[#4F6F52]/5 border border-[#4F6F52]/10 rounded-2xl flex items-center justify-between text-xs transition-all hover:bg-[#4F6F52]/10">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="p-2 bg-[#4F6F52]/10 text-[#4F6F52] rounded-xl shrink-0">
                                    <UploadCloud className="h-4.5 w-4.5" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="font-extrabold text-[#243028] text-xs truncate">
                                      Dokumen Terunggah
                                    </p>
                                    <p className="text-[10px] text-[#66736A] font-mono truncate max-w-[280px] mt-0.5">
                                      {activeUnitBast.fileName}
                                    </p>
                                  </div>
                                </div>
                                <a
                                  href={activeUnitBast.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="bg-[#4F6F52] hover:bg-[#3D563F] text-white font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-sm transition-all hover:scale-[1.02] flex items-center gap-1.5 shrink-0 ml-2 animate-premium-hover"
                                >
                                  <ExternalLink className="h-3.5 w-3.5 text-white" />
                                  Lihat PDF
                                </a>
                              </div>
                            ) : (
                              (unit.readyStockSource === "legacy_ready_stock" || unit.readyStockSource === "manual_ready_stock") && (
                                <div className="p-3.5 bg-gray-50/50 border border-gray-200/80 rounded-2xl flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-gray-100 text-gray-400 rounded-lg">
                                      <FileText className="h-4.5 w-4.5" />
                                    </div>
                                    <div>
                                      <p className="font-bold text-[#66736A] text-xs">Arsip BAST Vendor Kosong</p>
                                      <p className="text-[9px] text-muted-foreground mt-0.5">Tidak wajib untuk unit ready stock legacy.</p>
                                    </div>
                                  </div>
                                </div>
                              )
                            )}
                          </div>

                          {/* PANEL BAST DEVELOPER KE KONSUMEN TERINTEGRASI */}
                          <div className="bg-white border border-[#D6DED2] rounded-2xl p-5 shadow-[0_4px_20px_rgba(143,175,154,0.08)] space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="font-extrabold text-sm text-[#243028] flex items-center gap-2">
                                <FileText className="h-4.5 w-4.5 text-[#4F6F52]" />
                                BAST Konsumen (Developer ke Konsumen)
                              </h4>
                              {customerBast && customerBast.customerName && (
                                <span className="bg-[#EAF2EC] text-[#4F6F52] border border-[#8FAF9A]/30 text-[9px] font-extrabold px-2 py-0.5 rounded-lg">
                                  Terhubung KPR
                                </span>
                              )}
                            </div>

                            {/* Deteksi Status & Validasi Pembeli */}
                            {(() => {
                              if (!customerBast || !customerBast.bookingId) {
                                return (
                                  <div className="text-center py-5 border border-dashed border-[#D6DED2] rounded-xl bg-[#F7F8F3]/40">
                                    <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto mb-2 animate-pulse" />
                                    <p className="text-xs font-bold text-[#243028]">Unit Belum Terjual / Booking Tidak Aktif</p>
                                    <p className="text-[10px] text-[#66736A] mt-1 px-4 leading-relaxed">
                                      Unggah BAST Konsumen dinonaktifkan karena unit belum memiliki booking/penjualan yang aktif.
                                    </p>
                                  </div>
                                );
                              }

                              const isEligibleForHandover = unit.status === "sold" || unit.status === "menunggu_serah_terima" || unit.status === "handover_complete" || unit.constructionProgress === 100;

                              if (!isEligibleForHandover) {
                                return (
                                  <div className="p-4 border border-rose-100 rounded-xl bg-rose-50/50 space-y-2">
                                    <div className="flex gap-2">
                                      <AlertTriangle className="h-4.5 w-4.5 text-rose-600 shrink-0 mt-0.5" />
                                      <div>
                                        <p className="text-xs font-bold text-rose-800">Belum Siap Serah Terima</p>
                                        <p className="text-[10px] text-rose-600 mt-0.5 leading-relaxed">
                                          Pembangunan unit kavling ini masih berjalan (Progres: {unit.constructionProgress}%). Pembangunan fisik wajib 100% dan disetujui BAST Vendor terlebih dahulu sebelum serah terima ke konsumen dapat dilakukan.
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-[10px] text-[#66736A] pl-6 border-t border-rose-100/50 pt-2 font-mono space-y-0.5">
                                      <p>Konsumen: <span className="font-bold">{customerBast.customerName}</span></p>
                                      <p>No. Booking: <span className="font-bold">{customerBast.bookingNumber}</span></p>
                                    </div>
                                  </div>
                                );
                              }

                              const docStatus = customerBast.docStatus;

                              return (
                                <div className="space-y-3">
                                  {/* Info Pembeli */}
                                  <div className="p-3 bg-[#F7F8F3]/60 border border-[#D6DED2] rounded-xl text-xs space-y-1.5 font-sans">
                                    <div className="grid grid-cols-3 gap-1">
                                      <span className="text-[#66736A]">Konsumen:</span>
                                      <span className="col-span-2 font-extrabold text-[#243028]">{customerBast.customerName}</span>
                                      <span className="text-[#66736A]">No. Booking:</span>
                                      <span className="col-span-2 font-mono font-bold text-[#4F6F52]">{customerBast.bookingNumber}</span>
                                      <span className="text-[#66736A]">Status Unit:</span>
                                      <span className="col-span-2">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                          unit.status === "handover_complete" ? "bg-[#EAF2EC] text-[#4F6F52] border border-[#8FAF9A]/30" : "bg-amber-50 text-amber-800 border border-amber-200"
                                        }`}>
                                          {unit.status === "handover_complete" ? "Selesai Serah Terima" : "Menunggu Serah Terima"}
                                        </span>
                                      </span>
                                    </div>
                                  </div>

                                  {/* Tampilan Status Unggahan */}
                                  {!customerBast.fileName ? (
                                    <div className="space-y-3">
                                      <div className="text-center py-4 border border-dashed border-[#8FAF9A]/40 rounded-xl bg-white space-y-2">
                                        <UploadCloud className="h-6 w-6 text-[#8FAF9A] mx-auto animate-bounce" />
                                        <p className="text-xs font-bold text-[#243028]">Unggah PDF BAST Konsumen</p>
                                        <p className="text-[9px] text-[#66736A] px-6 leading-relaxed">
                                          Unggah berkas BAST resmi yang ditandatangani oleh konsumen. Berkas ini akan terintegrasi langsung dengan modul KPR marketing!
                                        </p>
                                        
                                        <div className="px-6 pt-2">
                                          <input
                                            type="file"
                                            id="customer-bast-file"
                                            accept="application/pdf"
                                            className="hidden"
                                            onChange={async (e) => {
                                              const file = e.target.files?.[0];
                                              if (!file) return;
                                              
                                              setIsSubmitting(true);
                                              setErrorMessage(null);
                                              setSuccessMessage(null);
                                              
                                              try {
                                                const formData = new FormData();
                                                formData.append("file", file);
                                                
                                                const uploadRes = await fetch("/api/upload-attachment", {
                                                  method: "POST",
                                                  body: formData,
                                                });
                                                
                                                if (!uploadRes.ok) {
                                                  const errData = await uploadRes.json();
                                                  throw new Error(errData.error || "Gagal mengunggah berkas BAST.");
                                                }
                                                
                                                const fileData = await uploadRes.json();
                                                
                                                const res = await uploadCustomerBastFromProduction(
                                                  unit.id,
                                                  customerBast.bookingId,
                                                  customerBast.customerId,
                                                  {
                                                    fileName: file.name,
                                                    fileUrl: fileData.url,
                                                    mimeType: file.type,
                                                    fileSize: file.size,
                                                  }
                                                );
                                                
                                                if (res.success) {
                                                  setSuccessMessage("✓ Berkas BAST Konsumen berhasil diunggah dan disinkronkan ke KPR!");
                                                  await handleViewUnitProgress(unit.id);
                                                }
                                              } catch (err: any) {
                                                setErrorMessage(err.message || "Gagal mengunggah BAST.");
                                              } finally {
                                                setIsSubmitting(false);
                                              }
                                            }}
                                          />
                                          <label
                                            htmlFor="customer-bast-file"
                                            className="inline-flex items-center justify-center bg-[#4F6F52] hover:bg-[#3D563F] text-white font-extrabold text-xs px-4 py-2 rounded-xl shadow-md cursor-pointer transition-all active:scale-95 hover:scale-[1.02] gap-1.5"
                                          >
                                            <UploadCloud className="h-4 w-4" />
                                            Pilih Berkas PDF BAST
                                          </label>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-3">
                                      {/* Dokumen Sudah Terunggah */}
                                      <div className={`p-3 border rounded-xl flex items-center justify-between text-xs ${
                                        docStatus === "verified" ? "bg-emerald-50/50 border-emerald-200" :
                                        docStatus === "rejected" ? "bg-rose-50/50 border-rose-200" :
                                        "bg-[#F7F8F3] border-[#D6DED2]"
                                      }`}>
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <div className={`p-2 rounded-xl shrink-0 ${
                                            docStatus === "verified" ? "bg-emerald-100 text-emerald-800" :
                                            docStatus === "rejected" ? "bg-rose-100 text-rose-800" :
                                            "bg-amber-100 text-amber-800"
                                          }`}>
                                            <FileText className="h-4 w-4" />
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <p className="font-extrabold text-[#243028] truncate text-xs">
                                              BAST Konsumen Terunggah
                                            </p>
                                            <p className="text-[10px] text-[#66736A] font-mono truncate max-w-[160px] mt-0.5">
                                              {customerBast.fileName}
                                            </p>
                                            <div className="flex items-center gap-1.5 mt-1">
                                              <span className={`inline-flex items-center text-[9px] font-black uppercase ${
                                                docStatus === "verified" ? "text-emerald-700" :
                                                docStatus === "rejected" ? "text-rose-700" :
                                                "text-amber-700"
                                              }`}>
                                                {
                                                  docStatus === "verified" ? "Terverifikasi / Approved" :
                                                  docStatus === "rejected" ? "Ditolak / Perlu Revisi" :
                                                  "Menunggu Verifikasi"
                                                }
                                              </span>
                                            </div>
                                            {customerBast.docNotes && (
                                              <p className="text-[9px] text-rose-600 font-medium italic mt-1 leading-normal">
                                                Revisi: "{customerBast.docNotes}"
                                              </p>
                                            )}
                                          </div>
                                        </div>

                                        <div className="flex flex-col gap-1.5 shrink-0 ml-2">
                                          <a
                                            href={customerBast.fileUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="bg-[#4F6F52] hover:bg-[#3D563F] text-white font-extrabold text-[10px] px-2.5 py-1.5 rounded-lg shadow-sm transition-all text-center flex items-center justify-center gap-1 hover:scale-[1.02]"
                                          >
                                            <ExternalLink className="h-3 w-3 text-white" />
                                            Unduh
                                          </a>
                                          {docStatus !== "verified" && (
                                            <>
                                              <input
                                                type="file"
                                                id="reupload-customer-bast-file"
                                                accept="application/pdf"
                                                className="hidden"
                                                onChange={async (e) => {
                                                  const file = e.target.files?.[0];
                                                  if (!file) return;
                                                  
                                                  setIsSubmitting(true);
                                                  setErrorMessage(null);
                                                  setSuccessMessage(null);
                                                  
                                                  try {
                                                    const formData = new FormData();
                                                    formData.append("file", file);
                                                    
                                                    const uploadRes = await fetch("/api/upload-attachment", {
                                                      method: "POST",
                                                      body: formData,
                                                    });
                                                    
                                                    if (!uploadRes.ok) {
                                                      const errData = await uploadRes.json();
                                                      throw new Error(errData.error || "Gagal mengunggah berkas BAST.");
                                                    }
                                                    
                                                    const fileData = await uploadRes.json();
                                                    
                                                    const res = await uploadCustomerBastFromProduction(
                                                      unit.id,
                                                      customerBast.bookingId,
                                                      customerBast.customerId,
                                                      {
                                                        fileName: file.name,
                                                        fileUrl: fileData.url,
                                                        mimeType: file.type,
                                                        fileSize: file.size,
                                                      }
                                                    );
                                                    
                                                    if (res.success) {
                                                      setSuccessMessage("✓ Berkas BAST Konsumen berhasil diperbarui!");
                                                      await handleViewUnitProgress(unit.id);
                                                    }
                                                  } catch (err: any) {
                                                    setErrorMessage(err.message || "Gagal mengunggah BAST.");
                                                  } finally {
                                                    setIsSubmitting(false);
                                                  }
                                                }}
                                              />
                                              {canManageBast && (
                                                <label
                                                  htmlFor="reupload-customer-bast-file"
                                                  className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[10px] px-2.5 py-1.5 rounded-lg shadow-sm transition-all text-center cursor-pointer flex items-center justify-center gap-1 hover:scale-[1.02]"
                                                >
                                                  <UploadCloud className="h-3 w-3" />
                                                  Re-Upload
                                                </label>
                                              )}
                                            </>
                                          )}
                                          {/* Tombol Hapus BAST — hanya untuk Super Admin, Admin Kantor, atau Pengawas, dan tidak untuk dokumen yang sudah verified */}
                                          {canManageBast && docStatus !== "verified" && customerBast.docId && (
                                            <button
                                              type="button"
                                              title="Hapus dokumen BAST Konsumen ini"
                                              className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[10px] px-2.5 py-1.5 rounded-lg shadow-sm transition-all text-center flex items-center justify-center gap-1 hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed"
                                              disabled={isSubmitting}
                                              onClick={async () => {
                                                const confirmed = window.confirm(
                                                  "Apakah Anda yakin ingin menghapus dokumen BAST Konsumen ini?\n\nTindakan ini tidak dapat dibatalkan."
                                                );
                                                if (!confirmed) return;

                                                setIsSubmitting(true);
                                                setErrorMessage(null);
                                                setSuccessMessage(null);
                                                try {
                                                  const res = await deleteCustomerBastDocument(customerBast.docId);
                                                  if (res.success) {
                                                    setSuccessMessage("✓ Dokumen BAST Konsumen berhasil dihapus.");
                                                    await handleViewUnitProgress(unit.id);
                                                  }
                                                } catch (err: any) {
                                                  setErrorMessage(err.message || "Gagal menghapus dokumen BAST.");
                                                } finally {
                                                  setIsSubmitting(false);
                                                }
                                              }}
                                            >
                                              <Trash2 className="h-3 w-3" />
                                              Hapus
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Tombol Cetak Draft BAST Konsumen */}
                                  <div className="pt-1.5 flex gap-2">
                                    <a
                                      href={`/marketing/bookings/${customerBast.bookingId}/bast/print`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="w-full inline-flex items-center justify-center bg-white border border-[#D6DED2] text-[#4F6F52] hover:bg-[#F7F8F3]/50 font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-sm transition-all gap-1.5"
                                    >
                                      <FileText className="h-4 w-4" />
                                      Cetak Berita Acara BAST
                                    </a>
                                  </div>
                                </div>
                              );
                            })()}

                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* WORK PARTS WITH PILL GAUGE AND INTAKE CONTROL */}
                            <div className="space-y-4">
                              <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                                <Wrench className="h-4 w-4 text-primary" />
                                {t("production.spk_component_title")}
                              </h4>
                              <div className="space-y-4 bg-[#8FAF9A]/5 p-4 rounded-xl border border-[#8FAF9A]/20">
                                {spkWeights.length === 0 ? (
                                  <div className="text-center py-4 text-xs text-muted-foreground border border-dashed border-[#8FAF9A]/30 rounded-lg">
                                    {t("production.component_empty")}
                                  </div>
                                ) : (
                                  spkWeights.map((w) => {
                                    return (
                                      <div key={w.workItemId} className="space-y-1">
                                        <div className="flex justify-between text-xs font-semibold text-foreground">
                                          <span>{w.name} <span className="text-muted-foreground font-normal">({t("production.weight_lbl")} {w.weightPct}%)</span></span>
                                          <span className="text-primary font-bold">{w.currentProgress}%</span>
                                        </div>
                                        <Progress value={w.currentProgress} className="h-2 bg-muted" />
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                            {/* ESTIMATION TRACKER LOGS */}
                            <div className="space-y-4">
                              <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                                <Calendar className="h-4 w-4 text-primary" />
                                {t("production.handover_est_title")}
                              </h4>
                              <div className="space-y-3">
                                {handoverEstimations.length === 0 ? (
                                  <div className="text-center py-6 border border-dashed border-[#8FAF9A]/30 rounded-lg text-xs text-muted-foreground">
                                    {t("production.handover_empty")}
                                  </div>
                                ) : (
                                  handoverEstimations.map((est) => (
                                    <div key={est.id} className="bg-background p-4 rounded-xl border border-[#8FAF9A]/30 shadow-sm space-y-3">
                                      <div className="flex items-center justify-between text-xs font-semibold">
                                        <span className="text-muted-foreground flex items-center gap-1">
                                          {t("production.handover_target_lbl")}:
                                        </span>
                                        <Badge className="bg-[#DDE8D8] text-[#4F6F52] hover:bg-[#DDE8D8] font-bold shadow-none">
                                          {new Date(est.estimatedHandoverDate).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' })}
                                        </Badge>
                                      </div>

                                      {activeUnitBast ? (
                                        <div className="flex items-center gap-1.5 text-[10px] font-black text-[#4F6F52] bg-[#DDE8D8]/50 px-2.5 py-1 rounded-lg border border-[#8FAF9A]/30 w-fit">
                                          <CheckCircle2 className="h-3 w-3 text-[#4F6F52]" />
                                          Sudah Selesai Serah Terima (BAST Aktif)
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/50 w-fit">
                                          <Clock className="h-3 w-3 text-amber-600 animate-pulse" />
                                          Dalam Proses / Estimasi Konstruksi
                                        </div>
                                      )}
                                      <div className="p-2.5 rounded bg-[#8FAF9A]/5 border border-[#8FAF9A]/10 text-xs text-foreground italic leading-relaxed">
                                        &ldquo;{est.calculationNote}&rdquo;
                                      </div>
                                      <div className="text-[10px] text-muted-foreground text-right font-medium">
                                        {t("production.handover_calc_date")} {new Date(est.createdAt).toLocaleDateString()}
                                      </div>
                                    </div>
                                  ))
                                )}
                            </div>
                          </div>
                        </div>

                           {/* Photo Gallery — Real data from SPK progress logs */}
                           <div className="pt-6 border-t border-border space-y-3 mt-6">
                             <h4 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                               <Camera className="h-4 w-4 text-[#4F6F52]" />
                               Galeri Bukti Foto Fisik Lapangan
                             </h4>
                             {(() => {
                               const photos = spkLogs
                                 .filter(l => l.attachment && l.attachment.fileUrl)
                                 .map(l => ({
                                   workItemName: l.workItem.name,
                                   progressDate: l.log.progressDate,
                                   notes: l.log.notes,
                                   fileUrl: l.attachment!.fileUrl,
                                   fileName: l.attachment!.fileName,
                                 }));

                               if (photos.length === 0) {
                                 return (
                                   <div className="flex flex-col items-center justify-center py-6 text-muted-foreground gap-1.5 border border-dashed border-[#8FAF9A]/30 rounded-xl bg-[#8FAF9A]/5">
                                     <Camera className="h-8 w-8 opacity-30 text-[#4F6F52]" />
                                     <span className="text-xs font-bold">Belum Ada Galeri Foto Konstruksi</span>
                                     <span className="text-[10px] text-muted-foreground text-center">Foto fisik lapangan akan muncul di sini setelah diunggah oleh Pengawas Lapangan.</span>
                                   </div>
                                 );
                               }

                               return (
                                 <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                                   {photos.map((photo, idx) => (
                                     <a
                                       key={idx}
                                       href={photo.fileUrl}
                                       target="_blank"
                                       rel="noopener noreferrer"
                                       className="group/photo relative aspect-square bg-[#F7F8F3] border border-[#8FAF9A]/20 rounded-xl overflow-hidden flex flex-col items-center justify-center transition-all hover:shadow-md hover:border-[#4F6F52]"
                                     >
                                       {/* eslint-disable-next-line @next/next/no-img-element */}
                                       <img
                                         src={photo.fileUrl}
                                         alt={photo.workItemName}
                                         className="absolute inset-0 w-full h-full object-cover group-hover/photo:scale-105 transition-transform duration-300"
                                         onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                       />
                                       <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                                       <div className="absolute bottom-0 left-0 right-0 p-2">
                                         <span className="text-[9px] font-black text-white block leading-tight truncate">{photo.workItemName}</span>
                                         <span className="text-[8px] font-mono text-white/90 block mt-0.5">
                                           {new Date(photo.progressDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' })}
                                         </span>
                                       </div>
                                       {photo.notes && (
                                         <div className="absolute top-1.5 right-1.5 h-4 w-4 bg-white/90 rounded-full flex items-center justify-center shadow-sm" title={photo.notes}>
                                           <span className="text-[8px] font-black text-[#4F6F52]">i</span>
                                         </div>
                                       )}
                                     </a>
                                   ))}
                                 </div>
                               );
                             })()}
                           </div>
                        </div>
                      )
                    })()
                  ) : (
                    <div className="h-64 border border-dashed border-[#8FAF9A]/30 rounded-xl flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
                      <Layers className="h-10 w-10 text-primary/30 mb-2 animate-bounce" />
                      <h4 className="font-bold text-foreground text-sm">{t("production.select_unit_cta")}</h4>
                      <p className="text-xs max-w-xs mt-1">{t("production.select_unit_desc")}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: MATERIALS TAB PANEL */}
          {activeTab === "materials" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground">{t("production.materials_title")}</h3>
                  <p className="text-xs text-muted-foreground">{t("production.materials_desc")}</p>
                </div>
                <Button
                  onClick={() => setMaterialOpen(true)}
                  className="bg-primary hover:bg-[#4F6F52] text-primary-foreground font-semibold text-xs"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  {t("production.btn_new_material")}
                </Button>
              </div>

              <div className="rounded-md border border-[#8FAF9A]/20 overflow-hidden">
                <Table>
                  <TableHeader className="bg-[#8FAF9A]/10">
                    <TableRow>
                      <TableHead className="font-semibold text-primary">{t("production.col_req_no")}</TableHead>
                      <TableHead className="font-semibold text-primary">{t("production.col_spk_linked")}</TableHead>
                      <TableHead className="font-semibold text-primary">{t("production.col_material_desc")}</TableHead>
                      <TableHead className="font-semibold text-primary">{t("production.col_kavling")}</TableHead>
                      <TableHead className="font-semibold text-primary">{t("production.col_est_cost")}</TableHead>
                      <TableHead className="font-semibold text-primary">{t("production.col_req_date")}</TableHead>
                      <TableHead className="font-semibold text-primary">{t("production.col_finance_status")}</TableHead>
                      <TableHead className="font-semibold text-primary text-right">{t("production.col_action")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materialRequests.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="h-16 w-16 rounded-full bg-[#DDE8D8]/50 flex items-center justify-center mx-auto">
                              <Plus className="h-8 w-8 text-[#4F6F52]" />
                            </div>
                            <div>
                              <p className="font-semibold text-[#243028] text-sm">{t("production.material_empty")}</p>
                              <p className="text-xs text-[#66736A] mt-1">{t("production.material_empty_desc")}</p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      materialRequests.map((m) => (
                        <TableRow key={m.id} className="hover:bg-[#8FAF9A]/5 transition-colors duration-150">
                          <TableCell className="font-bold tabular-nums text-foreground">{m.requestNumber}</TableCell>
                          <TableCell className="font-semibold text-foreground">{m.spkNumber}</TableCell>
                          <TableCell className="font-medium text-foreground max-w-[200px] truncate">{m.description}</TableCell>
                          <TableCell className="font-semibold text-foreground">{m.unitCode}</TableCell>
                          <TableCell className="font-bold text-foreground tabular-nums">
                            Rp {m.estimatedAmount.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {new Date(m.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`shadow-none font-semibold text-xs ${
                                m.status === "approved" || m.status === "purchased"
                                  ? "bg-[#DDE8D8] text-[#4F6F52] border border-[#8FAF9A]/30"
                                  : m.status === "finance_pending"
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : m.status === "rejected"
                                  ? "bg-red-50 text-red-700 border border-red-200"
                                  : "bg-gray-100 text-gray-700 border border-gray-200"
                              }`}
                            >
                              {m.status === "approved" || m.status === "purchased"
                                ? t("production.mat_status_approved")
                                : m.status === "finance_pending"
                                ? t("production.mat_status_pending")
                                : m.status === "rejected"
                                ? t("production.mat_status_rejected")
                                : t("production.status_draft")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {m.status === "draft" && (
                              <Button
                                size="sm"
                                onClick={() => handleSubmitMaterialToFinance(m.id)}
                                className="bg-primary hover:bg-[#4F6F52] text-primary-foreground font-semibold text-xs h-8"
                              >
                                {t("production.btn_submit_to_finance")}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* TAB 4: COMPLAINTS TAB PANEL */}
          {activeTab === "complaints" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground">{t("production.complaints_title")}</h3>
                  <p className="text-xs text-muted-foreground">{t("production.complaints_desc")}</p>
                </div>
                <Button
                  onClick={() => setComplaintOpen(true)}
                  className="bg-primary hover:bg-[#4F6F52] text-primary-foreground font-semibold text-xs"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  {t("production.btn_new_complaint")}
                </Button>
              </div>

              <div className="rounded-md border border-[#8FAF9A]/20 overflow-hidden">
                <Table>
                  <TableHeader className="bg-[#8FAF9A]/10">
                    <TableRow>
                      <TableHead className="font-semibold text-primary">{t("production.col_ticket_no")}</TableHead>
                      <TableHead className="font-semibold text-primary">{t("production.col_customer")}</TableHead>
                      <TableHead className="font-semibold text-primary">{t("production.col_kavling")}</TableHead>
                      <TableHead className="font-semibold text-primary">{t("production.col_category")}</TableHead>
                      <TableHead className="font-semibold text-primary">{t("production.col_complaint_desc")}</TableHead>
                      <TableHead className="font-semibold text-primary">{t("production.col_report_date")}</TableHead>
                      <TableHead className="font-semibold text-primary">{t("production.col_status")}</TableHead>
                      <TableHead className="font-semibold text-primary text-right">{t("production.col_action")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {complaints.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="py-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="h-16 w-16 rounded-full bg-[#DDE8D8]/50 flex items-center justify-center mx-auto">
                              <AlertTriangle className="h-8 w-8 text-[#4F6F52]" />
                            </div>
                            <div>
                              <p className="font-semibold text-[#243028] text-sm">{t("production.complaint_empty")}</p>
                              <p className="text-xs text-[#66736A] mt-1">{t("production.complaint_empty_desc")}</p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      complaints.map((c) => (
                        <TableRow key={c.id} className="hover:bg-[#8FAF9A]/5 transition-colors duration-150">
                          <TableCell className="font-bold tabular-nums text-foreground">{c.complaintNumber}</TableCell>
                          <TableCell className="font-medium text-foreground">{c.customerName}</TableCell>
                          <TableCell className="font-semibold text-foreground">{c.unitCode}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs border-[#8FAF9A] text-primary bg-[#8FAF9A]/5 font-semibold shadow-none">
                              {c.category === "quality" ? t("production.cat_quality") : c.category === "delay" ? t("production.cat_delay") : c.category === "document" ? t("production.cat_document") : c.category === "payment" ? t("production.cat_payment") : t("production.cat_other")}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium text-foreground max-w-[240px] truncate">{c.description}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {new Date(c.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`shadow-none font-semibold ${
                                c.status === "resolved"
                                  ? "bg-[#DDE8D8] text-[#4F6F52] border border-[#8FAF9A]/30"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}
                            >
                              {c.status === "resolved" ? t("production.status_done") : t("production.status_open")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {c.status === "open" && (
                              <Button
                                size="sm"
                                onClick={() => handleResolveComplaint(c)}
                                className="bg-primary hover:bg-[#4F6F52] text-primary-foreground font-semibold text-xs h-8"
                              >
                                {t("production.btn_resolve")}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ==========================================
          5. MODAL DIALOG POPUPS (COMPREHENSIVE FORMS)
         ========================================== */}

      {/* DIALOG 1: CREATE SPK */}
      <Dialog open={spkOpen} onOpenChange={(open) => {
        setSpkOpen(open);
        if (!open) {
          setEditingSpkId(null);
          setNewSpk({
            projectId: "",
            unitId: "",
            vendorId: "",
            title: "",
            workDescription: "",
            specification: "",
            rabAmount: "",
            startDate: "",
            targetEndDate: "",
          });
          setFormWeights([]);
        }
        if (open) setSpkFormError(null);
      }}>
        <DialogContent className="sm:max-w-lg rounded-3xl bg-white/98 backdrop-blur-md border border-[#D6DED2] shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden font-sans">
          <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-[#D6DED2]">
            <DialogHeader>
              <DialogTitle className="text-primary font-bold text-lg">
                {editingSpkId ? "Ubah Surat Perintah Kerja (SPK)" : t("production.spk_form_title")}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {editingSpkId ? "Perbarui rincian Surat Perintah Kerja untuk kontraktor lapangan." : t("production.spk_form_desc")}
              </DialogDescription>
            </DialogHeader>
          </div>
          <form onSubmit={handleCreateSpk} className="p-6 space-y-4 pt-4 max-h-[75vh] overflow-y-auto">

            {/* INLINE VALIDATION ERROR BANNER */}
            {spkFormError && (
              <div className="w-full flex items-start gap-2.5 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold animate-in fade-in slide-in-from-top-2">
                <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                <span className="leading-relaxed">{spkFormError}</span>
              </div>
            )}

            {/* DP GATE STATUS BANNER */}
            {newSpk.unitId && (() => {
              const selectedUnit = units.find(u => u.id === newSpk.unitId);
              const needsGate = selectedUnit && ["kpr_process", "booking"].includes(selectedUnit.status);
              if (!needsGate) return null;
              const dpPaid = dpPaidUnitIdsSet.has(newSpk.unitId);
              return dpPaid ? (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold animate-in fade-in">
                  <span className="h-5 w-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 text-[10px] font-bold">✓</span>
                  <span><strong>{t("production.dp_gate_paid")}</strong></span>
                </div>
              ) : (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 text-xs font-semibold animate-in fade-in">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-900">{t("production.dp_gate_warning")}</p>
                    <p className="text-amber-700 font-medium mt-0.5">{t("production.dp_gate_desc")}</p>
                  </div>
                </div>
              );
            })()}

            <div className="space-y-3 text-sm">
              <div className="space-y-1">
                <label className="font-semibold text-foreground text-xs">{t("production.spk_lbl_project")}</label>
                <Select
                  value={newSpk.projectId}
                  onValueChange={(val: string | null) => setNewSpk(prev => ({ ...prev, projectId: val || "", unitId: "" }))}
                  required
                  items={projects.map(p => ({ label: `${p.name} (${p.code})`, value: p.id }))}
                >
                  <SelectTrigger className="w-full border-[#8FAF9A]/30 focus:ring-primary">
                    <SelectValue placeholder={t("production.spk_lbl_project")}>
                      {newSpk.projectId ? (() => {
                        const p = projects.find(proj => proj.id === newSpk.projectId);
                        return p ? `${p.name} (${p.code})` : undefined;
                      })() : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(p => (
                       <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground text-xs">{t("production.spk_lbl_unit")}</label>
                <Select
                  value={newSpk.unitId}
                  onValueChange={(val: string | null) => setNewSpk(prev => ({ ...prev, unitId: val || "" }))}
                  disabled={!newSpk.projectId}
                  required
                  items={units.map(u => ({ label: `${u.code} — ${u.status}`, value: u.id }))}
                >
                  <SelectTrigger className="w-full border-[#8FAF9A]/30 focus:ring-primary">
                    <SelectValue placeholder={t("production.spk_lbl_unit")}>
                      {newSpk.unitId ? (() => {
                        const u = units.find(unit => unit.id === newSpk.unitId);
                        return u ? `${u.code} — ${u.status}` : undefined;
                      })() : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {units
                      .filter(u => 
                        (u.projectId === newSpk.projectId && 
                         u.status !== "belum_siap" &&
                         (u.status !== "construction" || !spks.some(s => s.unitId === u.id && s.status !== "cancelled")) && 
                         u.status !== "construction_done" && 
                         (u.constructionProgress || 0) < 100) || 
                         u.id === newSpk.unitId
                      )
                      .map(u => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.code} &mdash; Progres {u.constructionProgress || 0}%
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground text-xs">{t("production.spk_lbl_vendor")}</label>
                <Select
                  value={newSpk.vendorId}
                  onValueChange={(val: string | null) => setNewSpk(prev => ({ ...prev, vendorId: val || "" }))}
                  required
                  items={vendors.map(v => ({ label: v.name, value: v.id }))}
                >
                  <SelectTrigger className="w-full border-[#8FAF9A]/30 focus:ring-primary">
                    <SelectValue placeholder={t("production.spk_lbl_vendor")}>
                      {newSpk.vendorId ? vendors.find(v => v.id === newSpk.vendorId)?.name : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground text-xs">{t("production.spk_lbl_title")}</label>
                <Input
                  required
                  placeholder={t("production.spk_title_ph")}
                  className="border-[#8FAF9A]/30 focus-visible:ring-primary"
                  value={newSpk.title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSpk(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground text-xs">{t("production.spk_lbl_work_desc")}</label>
                <Textarea
                  required
                  placeholder={t("production.spk_work_desc_ph")}
                  className="border-[#8FAF9A]/30 focus-visible:ring-primary text-xs"
                  value={newSpk.workDescription}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewSpk(prev => ({ ...prev, workDescription: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground text-xs">{t("production.spk_lbl_spec")}</label>
                <Input
                  placeholder={t("production.spk_spec_ph")}
                  className="border-[#8FAF9A]/30 focus-visible:ring-primary"
                  value={newSpk.specification}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSpk(prev => ({ ...prev, specification: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground text-xs">{t("production.spk_lbl_rab")}</label>
                <Input
                  type="number"
                  required
                  placeholder={t("production.spk_rab_ph")}
                  className="border-[#8FAF9A]/30 focus-visible:ring-primary"
                  value={newSpk.rabAmount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSpk(prev => ({ ...prev, rabAmount: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground text-xs">{t("production.spk_lbl_start")}</label>
                  <Input
                    type="date"
                    required
                    className="border-[#8FAF9A]/30 focus-visible:ring-primary text-xs"
                    value={newSpk.startDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSpk(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground text-xs">{t("production.spk_lbl_end")}</label>
                  <Input
                    type="date"
                    required
                    className="border-[#8FAF9A]/30 focus-visible:ring-primary text-xs"
                    value={newSpk.targetEndDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSpk(prev => ({ ...prev, targetEndDate: e.target.value }))}
                  />
                </div>
              </div>

              {/* Struktur Komponen & Bobot SLA Pembangunan (Interactive Weight Breakdown) */}
              <div className="p-4 bg-[#F7F8F3]/80 border border-[#8FAF9A]/30 rounded-2xl space-y-3 transition-all duration-300">
                <div className="flex justify-between items-center text-[#243028] font-bold text-xs">
                  <span className="flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-primary" />
                    Struktur Komponen & Bobot SLA Pembangunan
                  </span>
                  {(() => {
                    const totalWeight = formWeights.reduce((sum, w) => sum + (w.weightPct || 0), 0);
                    const isPerfect = totalWeight === 100;
                    return (
                      <Badge className={`font-bold text-[10px] rounded-full shadow-none border transition-colors ${
                        isPerfect
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-50 animate-pulse"
                      }`}>
                        Total: {totalWeight}% {isPerfect ? "(Sesuai)" : "(Wajib 100%)"}
                      </Badge>
                    );
                  })()}
                </div>

                <div className="space-y-2.5 divide-y divide-[#8FAF9A]/10 text-xs font-semibold text-[#4F6F52] pt-1">
                  {workItems.map(item => {
                    const currentWeight = formWeights.find(w => w.workItemId === item.id)?.weightPct ?? item.defaultWeightPct;
                    const allocatedAmount = Number(newSpk.rabAmount || 0) * (currentWeight / 100);
                    const formattedAllocated = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(allocatedAmount);
                    
                    return (
                      <div key={item.id} className="flex justify-between items-center pt-2.5 first:pt-0 last:pb-0">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[#243028] font-bold text-xs">{item.name}</span>
                          <span className="text-muted-foreground text-[10px] font-mono">{item.code}</span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {Number(newSpk.rabAmount) > 0 && (
                            <span className="text-primary/90 font-bold tabular-nums text-xs bg-[#DDE8D8]/40 px-2 py-1 rounded-lg border border-[#8FAF9A]/20">
                              {formattedAllocated}
                            </span>
                          )}
                          
                          <div className="relative flex items-center w-20">
                            <Input
                              type="number"
                              min={1}
                              max={100}
                              value={currentWeight}
                              onChange={(e) => {
                                const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                                setFormWeights(prev => {
                                  const exists = prev.some(w => w.workItemId === item.id);
                                  if (!exists) {
                                    return [...prev, { workItemId: item.id, weightPct: val }];
                                  }
                                  return prev.map(w => w.workItemId === item.id ? { ...w, weightPct: val } : w);
                                });
                              }}
                              className="w-full h-8 text-center font-mono text-xs rounded-lg border-[#8FAF9A]/30 focus-visible:ring-primary pr-6 font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
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
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSpkOpen(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {t("production.btn_cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || (() => {
                  const u = units.find(unit => unit.id === newSpk.unitId);
                  if (!u) return false;
                  if (["kpr_process", "booking"].includes(u.status) && !dpPaidUnitIdsSet.has(newSpk.unitId)) return true;
                  return false;
                })()}
                className="bg-primary hover:bg-[#4F6F52] text-primary-foreground font-semibold text-xs disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {(() => {
                  const u = units.find(unit => unit.id === newSpk.unitId);
                  const blocked = u && ["kpr_process", "booking"].includes(u.status) && !dpPaidUnitIdsSet.has(newSpk.unitId);
                  return blocked ? `🔒 ${t("production.btn_wait_dp")}` : (editingSpkId ? "Simpan Perubahan" : t("production.btn_publish_spk"));
                })()}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: INPUT PROGRESS LAPANGAN */}
      <Dialog open={progressOpen} onOpenChange={(open) => {
        setProgressOpen(open);
        if (!open) {
          setUploadedPhotos([]);
          setSelectedFiles([]);
        }
      }}>
        <DialogContent className="sm:max-w-xl rounded-3xl bg-white/98 backdrop-blur-md border border-[#D6DED2] shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden font-sans">
          <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-[#D6DED2]">
            <DialogHeader>
              <DialogTitle className="text-primary font-bold text-lg flex items-center gap-2">
                <HardHat className="h-5 w-5" />
                {t("production.progress_form_title")}
              </DialogTitle>
              <DialogDescription className="text-xs">{t("production.progress_form_desc")}</DialogDescription>
            </DialogHeader>
          </div>

          <Tabs defaultValue="form" className="w-full">
            <div className="px-6 pt-3 border-b border-border bg-[#F7F8F3]/50">
              <TabsList className="grid grid-cols-2 w-full h-9 bg-muted/60 p-0.5 rounded-lg border border-[#D6DED2]">
                <TabsTrigger value="form" className="text-xs font-semibold rounded-md py-1.5 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                  {t("production.btn_input_progress") || "Catat Progress"}
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs font-semibold rounded-md py-1.5 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                  {"Riwayat & Galeri Foto"}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="form" className="m-0 focus-visible:outline-none">
              {/* Metadata Info Card at the top */}
              {(() => {
                const currentSpk = spks.find(s => s.id === newProgress.spkId);
                if (!currentSpk) return null;
                return (
                  <div className="mx-6 mt-4 p-4 bg-gradient-to-r from-[#DDE8D8]/60 via-white/80 to-[#DDE8D8]/30 border border-[#D6DED2] rounded-2xl flex items-center justify-between text-xs shadow-sm animate-scale-in">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider">Nomor SPK Kerja</p>
                      <p className="font-mono font-bold text-[#4F6F52] text-sm">{currentSpk.spkNumber}</p>
                      <p className="text-[10px] text-muted-foreground font-medium">Vendor: {currentSpk.vendorName || "Kontraktor Utama"}</p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider">Unit / Kavling</p>
                      <p className="font-black text-[#243028] text-sm">{currentSpk.projectName} &bull; Kav. {currentSpk.unitCode}</p>
                      <p className="text-[10px] text-muted-foreground font-medium">Status SPK: <span className="capitalize font-bold text-amber-600">{SPK_STATUS_LABELS[currentSpk.status] || currentSpk.status.replace("_", " ")}</span></p>
                    </div>
                  </div>
                );
              })()}

              <form onSubmit={handleInputProgress} className="p-6 space-y-5 pt-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-4 text-sm">
                  {/* Select Komponen Pekerjaan */}
                  <div className="space-y-1.5">
                    <label className="font-bold text-[#243028] text-xs flex items-center gap-1.5">
                      <ClipboardList className="h-4 w-4 text-[#8FAF9A]" />
                      {t("production.progress_lbl_component") || "Komponen Item Pekerjaan"}
                    </label>
                    <Select
                      value={newProgress.workItemId}
                      onValueChange={(val: string | null) => setNewProgress(prev => ({ ...prev, workItemId: val || "" }))}
                      required
                      items={currentSpkComponents.map(item => ({ label: `${item.name} — Bobot ${item.weightPct}% (Progres: ${item.currentProgress}%)`, value: item.id }))}
                    >
                      <SelectTrigger className="w-full h-11 border-[#D6DED2] focus:ring-2 focus:ring-[#4F6F52]/20 rounded-xl bg-white/80 backdrop-blur-sm text-xs font-semibold">
                        <SelectValue placeholder={t("production.progress_lbl_component") || "Pilih komponen pekerjaan..."}>
                          {newProgress.workItemId ? (() => {
                            const item = currentSpkComponents.find(w => w.id === newProgress.workItemId);
                            return item ? `${item.name} — Bobot ${item.weightPct}% (Progres: ${item.currentProgress}%)` : undefined;
                          })() : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="border-[#D6DED2] rounded-xl bg-white/95 backdrop-blur-md">
                        {currentSpkComponents.map(item => (
                          <SelectItem key={item.id} value={item.id} className="text-xs font-semibold">
                            {item.name} &mdash; Bobot {item.weightPct}% (Progres: {item.currentProgress}%)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Dynamic Cumulative Progress Visual Indicator */}
                  {newProgress.workItemId && (
                    <div className="p-4 bg-gradient-to-br from-[#8FAF9A]/5 via-white/40 to-[#8FAF9A]/10 border border-[#8FAF9A]/20 rounded-2xl space-y-3 text-xs shadow-sm animate-scale-in">
                      <div className="flex justify-between items-center font-bold text-foreground">
                        <span className="text-[#66736A] font-bold">Status Kemajuan Fisik:</span>
                        <span className={`font-black text-xs px-2.5 py-0.5 rounded-full ${
                          isOverLimit 
                            ? "bg-rose-50 text-rose-600 border border-rose-200 animate-pulse" 
                            : "bg-[#DDE8D8] text-[#4F6F52] border border-[#8FAF9A]/25"
                        }`}>
                          {isOverLimit 
                            ? `⚠️ Melebihi Batas! (${currentProgressPct}% + ${newProgress.percentageAdded}% = ${currentProgressPct + newProgress.percentageAdded}%)` 
                            : `${currentProgressPct}% → ${newTotalProgress}%`}
                        </span>
                      </div>
                      
                      {/* Premium Segmented/Stacked Progress Bar */}
                      <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden flex border border-[#D6DED2]/40 shadow-inner">
                        {/* Current Progress Segment */}
                        <div 
                          className="h-full bg-gradient-to-r from-[#4F6F52] to-[#608764] transition-all duration-500 rounded-l-full"
                          style={{ width: `${currentProgressPct}%` }}
                        />
                        {/* New Added Progress Segment */}
                        <div 
                          className={`h-full transition-all duration-500 ${isOverLimit ? "bg-red-400 animate-pulse" : "bg-gradient-to-r from-[#8FAF9A] to-[#A3C1AD]"} ${currentProgressPct === 0 ? "rounded-l-full" : ""}`}
                          style={{ width: `${isOverLimit ? 100 - currentProgressPct : newProgress.percentageAdded}%` }}
                        />
                      </div>
                      
                      <div className="flex justify-between text-[10px] text-slate-500 font-bold tracking-wide uppercase">
                        <span>Progres Terakhir: {currentProgressPct}%</span>
                        <span>Bobot Relatif: {componentWeightPct}%</span>
                      </div>
                    </div>
                  )}

                  {/* Range Slider & Presets Card */}
                  {currentProgressPct === 100 ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-xs text-emerald-800 shadow-sm animate-scale-in">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-bold">Item Pekerjaan Selesai (100%)</p>
                        <p className="text-emerald-700/90 font-medium">Komponen pekerjaan ini telah mencapai progress fisik 100% dan telah selesai. Tidak memerlukan tambahan laporan progress lapangan.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-white/80 backdrop-blur-sm border border-[#D6DED2] rounded-2xl shadow-sm space-y-3.5">
                        <div className="flex items-center justify-between text-xs font-bold text-[#243028]">
                          <span className="flex items-center gap-1.5"><TrendingUp className="h-4 w-4 text-[#8FAF9A]" /> {t("production.progress_lbl_pct") || "Tambahan Kemajuan Fisik"}</span>
                          <div className="flex items-baseline gap-1.5">
                            {newProgress.workItemId && componentWeightPct > 0 && (
                              <span className="text-[10px] text-[#66736A] font-semibold">
                                (Dampak Unit: +{((newProgress.percentageAdded || 0) * componentWeightPct / 100).toFixed(1)}%)
                              </span>
                            )}
                            <span className="text-[#4F6F52] font-black text-base tracking-tight">+{newProgress.percentageAdded}%</span>
                          </div>
                        </div>
                        <Slider
                          min={1}
                          max={Math.max(1, 100 - currentProgressPct)}
                          step={1}
                          value={[newProgress.percentageAdded]}
                          onValueChange={(val: number[]) => setNewProgress(prev => ({ ...prev, percentageAdded: val[0] }))}
                          className="py-2 cursor-pointer"
                        />
                        
                        {/* Visual Preset Tap-Friendly Buttons */}
                        <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                          <div className="flex gap-1.5">
                            {[10, 25, 50].map((preset) => {
                              const disabled = preset > (100 - currentProgressPct);
                              return (
                                <Button
                                  key={preset}
                                  type="button"
                                  variant="outline"
                                  disabled={disabled}
                                  className={`text-[10px] font-bold px-3 py-1 h-7 rounded-full transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-30 disabled:pointer-events-none ${
                                    newProgress.percentageAdded === preset
                                      ? "bg-[#4F6F52] text-white border-[#4F6F52] shadow-sm"
                                      : "border-[#D6DED2] text-[#4F6F52] hover:bg-[#8FAF9A]/10 hover:border-[#8FAF9A]/40 bg-white"
                                  }`}
                                  onClick={() => setNewProgress(prev => ({ ...prev, percentageAdded: preset }))}
                                >
                                  +{preset}%
                                </Button>
                              );
                            })}
                            <Button
                              type="button"
                              variant="outline"
                              className={`text-[10px] font-black px-3.5 py-1 h-7 rounded-full transition-all duration-200 hover:scale-105 active:scale-95 ${
                                newProgress.percentageAdded === Math.max(1, 100 - currentProgressPct)
                                  ? "bg-[#4F6F52] text-white border-[#4F6F52] shadow-sm"
                                  : "border-[#4F6F52]/50 text-[#4F6F52] hover:bg-[#4F6F52]/10 bg-white"
                              }`}
                              onClick={() => setNewProgress(prev => ({ 
                                ...prev, 
                                percentageAdded: Math.max(1, 100 - currentProgressPct) 
                              }))}
                            >
                              Set 100%
                            </Button>
                          </div>
                          
                          <Button
                            type="button"
                            variant="outline"
                            className="text-[10px] font-bold px-3 py-1 h-7 rounded-full border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-400 bg-white transition-all duration-200 hover:scale-105 active:scale-95 ml-auto"
                            onClick={() => setNewProgress(prev => ({ ...prev, percentageAdded: 1 }))}
                          >
                            Reset (1%)
                          </Button>
                        </div>
                      </div>

                      {/* Tanggal Progress */}
                      <div className="space-y-1.5">
                        <label className="font-bold text-[#243028] text-xs flex items-center gap-1.5">
                          <Calendar className="h-4 w-4 text-[#8FAF9A]" />
                          {t("production.progress_lbl_date") || "Tanggal Laporan Lapangan"}
                        </label>
                        <Input
                          type="date"
                          required
                          className="border-[#D6DED2] focus-visible:ring-2 focus-visible:ring-[#4F6F52]/20 h-10 text-xs rounded-xl bg-white/80 font-medium"
                          value={newProgress.progressDate}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewProgress(prev => ({ ...prev, progressDate: e.target.value }))}
                        />
                      </div>

                      {/* Photo Upload Dropzone with Instant Preview */}
                      <div className="space-y-1.5">
                        <label className="font-bold text-[#243028] text-xs flex items-center gap-1.5">
                          <Camera className="h-4 w-4 text-[#8FAF9A]" />
                          {t("production.progress_lbl_photos") || "Foto Dokumentasi Progres Lapangan"}
                        </label>
                        <div 
                          onClick={() => document.getElementById('progress-photo-upload')?.click()}
                          className="border-2 border-dashed border-[#8FAF9A]/40 hover:border-[#4F6F52]/60 bg-[#F7F8F3]/40 hover:bg-[#8FAF9A]/5 rounded-2xl p-6 text-center cursor-pointer transition-all duration-200 group"
                        >
                          <input
                            id="progress-photo-upload"
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files) {
                                const filesArray = Array.from(e.target.files);
                                setSelectedFiles(prev => [...prev, ...filesArray]);
                                const newUrls = filesArray.map(file => URL.createObjectURL(file));
                                setUploadedPhotos(prev => [...prev, ...newUrls]);
                              }
                            }}
                          />
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <div className="p-2.5 bg-white rounded-full shadow-md text-[#4F6F52] group-hover:scale-110 transition-transform duration-300 border border-[#D6DED2]">
                              <Plus className="h-4 w-4" />
                            </div>
                            <span className="text-xs font-bold text-[#243028]">{t("production.progress_photo_cta") || "Klik atau seret foto ke sini untuk mengunggah"}</span>
                            <span className="text-[10px] text-slate-500 font-medium">Maksimal 4 foto, format JPG/PNG/WebP, max 5MB</span>
                          </div>
                        </div>

                        {uploadedPhotos.length > 0 && (
                          <div className="grid grid-cols-4 gap-3.5 pt-2">
                            {uploadedPhotos.map((photo, index) => (
                              <div key={index} className="relative group aspect-square rounded-xl overflow-hidden border border-[#8FAF9A]/30 shadow-sm animate-scale-in">
                                <Image src={photo} alt={`Preview ${index}`} fill className="object-cover" />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
                                    setUploadedPhotos(prev => prev.filter((_, i) => i !== index));
                                  }}
                                  className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-rose-600 rounded-full text-white transition-all duration-200 hover:scale-110 shadow-sm"
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Catatan Lapangan */}
                      <div className="space-y-1.5">
                        <label className="font-bold text-[#243028] text-xs flex items-center gap-1.5">
                          <MessageSquare className="h-4 w-4 text-[#8FAF9A]" />
                          {t("production.progress_lbl_notes") || "Catatan Catatan Lapangan / Kendala (Opsional)"}
                        </label>
                        <Textarea
                          placeholder={t("production.progress_notes_ph") || "Contoh: Pemasangan plafon gypsum tuntas 100% rapi..."}
                          className="border-[#D6DED2] focus-visible:ring-2 focus-visible:ring-[#4F6F52]/20 text-xs rounded-xl min-h-[80px] bg-white/80"
                          value={newProgress.notes}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewProgress(prev => ({ ...prev, notes: e.target.value }))}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <DialogFooter className="pt-3 border-t border-[#D6DED2]/40 mt-4 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setProgressOpen(false)}
                    className="text-xs text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-50 h-10 px-4 font-bold"
                  >
                    {t("production.btn_cancel") || "Batal"}
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || isOverLimit || !newProgress.workItemId}
                    className="bg-[#4F6F52] hover:bg-[#3D563F] text-white font-bold text-xs rounded-xl shadow-[0_4px_12px_rgba(79,111,82,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all h-10 px-5 flex items-center gap-1.5"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      t("production.btn_save_progress") || "Simpan Progres"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>

            <TabsContent value="history" className="m-0 focus-visible:outline-none p-6 pt-4 max-h-[60vh] overflow-y-auto space-y-4">
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-foreground">Dokumentasi Log Progres</h4>
                <p className="text-xs text-muted-foreground">Riwayat progres pembangunan dan unggahan foto lapangan untuk unit ini.</p>
              </div>

              {spkLogs && spkLogs.length > 0 ? (
                (() => {
                  // Filter logs if a component is selected, otherwise show all
                  const filteredLogs = newProgress.workItemId 
                    ? spkLogs.filter(l => l.log.workItemId === newProgress.workItemId)
                    : spkLogs;

                  if (filteredLogs.length === 0) {
                    return (
                      <div className="text-center py-10 border border-dashed border-[#8FAF9A]/30 rounded-2xl text-xs text-muted-foreground">
                        Belum ada riwayat progres tercatat untuk komponen pekerjaan yang dipilih.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3 pt-1">
                      {filteredLogs.map((item: any) => {
                        return (
                          <div key={item.log.id} className="p-3.5 bg-[#8FAF9A]/5 border border-[#8FAF9A]/20 rounded-xl space-y-2 text-xs">
                            <div className="flex justify-between items-center font-bold text-foreground">
                              <span className="text-[#4F6F52]">{item.workItem?.name || "Komponen Pekerjaan"}</span>
                              <Badge className="bg-[#DDE8D8] text-[#4F6F52] font-semibold border border-[#8FAF9A]/25 rounded-md hover:bg-[#DDE8D8]">
                                +{item.log.percentageAdded}% &rarr; {item.log.currentTotalPct}%
                              </Badge>
                            </div>
                            <div className="text-muted-foreground leading-relaxed">
                              {item.log.notes ? `"${item.log.notes}"` : <span className="italic">Tidak ada catatan lapangan.</span>}
                            </div>

                            {/* Linked Progress Photos */}
                            {((item.attachments && item.attachments.length > 0) || (item.attachment && item.attachment.fileUrl)) && (
                              <div className="pt-1.5">
                                <span className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider block mb-1.5">Bukti Foto Fisik</span>
                                <div className="flex flex-wrap gap-2">
                                  {item.attachments && item.attachments.length > 0 ? (
                                    item.attachments.map((att: any, idx: number) => (
                                      <div key={att.id || idx} className="relative h-24 w-36 rounded-lg overflow-hidden border border-[#8FAF9A]/30 group shadow-sm bg-white cursor-zoom-in">
                                        <a href={att.fileUrl} target="_blank" rel="noopener noreferrer">
                                          <Image 
                                            src={att.fileUrl} 
                                            alt={`Bukti Progress ${idx + 1}`} 
                                            fill 
                                            className="object-cover group-hover:scale-105 transition-transform duration-200"
                                          />
                                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[9px] font-bold">
                                            Buka Foto {idx + 1}
                                          </div>
                                        </a>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="relative h-24 w-36 rounded-lg overflow-hidden border border-[#8FAF9A]/30 group shadow-sm bg-white cursor-zoom-in">
                                      <a href={item.attachment.fileUrl} target="_blank" rel="noopener noreferrer">
                                        <Image 
                                          src={item.attachment.fileUrl} 
                                          alt="Bukti Progress" 
                                          fill 
                                          className="object-cover group-hover:scale-105 transition-transform duration-200"
                                        />
                                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[9px] font-bold">
                                          Buka Foto
                                        </div>
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="text-[10px] text-muted-foreground pt-1 text-right font-medium">
                              Dicatat tanggal: {new Date(item.log.progressDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              ) : (
                <div className="text-center py-10 border border-dashed border-[#8FAF9A]/30 rounded-2xl text-xs text-muted-foreground">
                  Belum ada log progres pembangunan untuk SPK ini.
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: REQUEST MATERIAL LOGISTIK */}
      <Dialog open={materialOpen} onOpenChange={(open) => {
        setMaterialOpen(open);
        if (!open) {
          setMaterialStep(1);
          setMaterialNecessity(50);
        }
      }}>
        <DialogContent className="sm:max-w-lg rounded-3xl bg-white/98 backdrop-blur-md border border-[#D6DED2] shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden font-sans">
          <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-[#D6DED2]">
            <DialogHeader>
              <DialogTitle className="text-primary font-bold text-lg flex items-center gap-2">
                <Truck className="h-5 w-5" />
                {t("production.material_form_title")}
              </DialogTitle>
              <DialogDescription className="text-xs">{t("production.material_form_desc")}</DialogDescription>
            </DialogHeader>
          </div>
          <form onSubmit={handleCreateMaterial} className="p-6 space-y-4 pt-4 max-h-[75vh] overflow-y-auto">

            {/* STEP INDICATOR HEADER */}
            <div className="flex items-center justify-between px-1 pb-3 border-b border-[#8FAF9A]/20 mb-3">
              <div className="flex items-center gap-1.5">
                <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${materialStep >= 1 ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>1</span>
                <span className="text-[11px] font-semibold text-foreground">SPK</span>
              </div>
              <div className="h-px bg-[#8FAF9A]/25 flex-1 mx-2" />
              <div className="flex items-center gap-1.5">
                <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${materialStep >= 2 ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>2</span>
                <span className="text-[11px] font-semibold text-foreground">Detail</span>
              </div>
              <div className="h-px bg-[#8FAF9A]/25 flex-1 mx-2" />
              <div className="flex items-center gap-1.5">
                <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${materialStep >= 3 ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>3</span>
                <span className="text-[11px] font-semibold text-foreground">Biaya</span>
              </div>
            </div>

            {/* STEP 1: SELECT SPK & AUTO DETAILS */}
            {materialStep === 1 && (
              <div className="space-y-4 py-2">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground text-xs">{t("production.material_lbl_spk")}</label>
                  <Select
                    value={newMaterial.spkId}
                    onValueChange={(val: string | null) => setNewMaterial(prev => ({ ...prev, spkId: val || "" }))}
                    required
                    items={spks.map(s => ({ label: `${s.spkNumber} — ${s.title} (${s.unitCode})`, value: s.id }))}
                  >
                    <SelectTrigger className="border-[#8FAF9A]/30 focus:ring-primary rounded-xl">
                      <SelectValue placeholder={t("production.material_lbl_spk")}>
                        {newMaterial.spkId ? (() => {
                          const s = spks.find(spk => spk.id === newMaterial.spkId);
                          return s ? `${s.spkNumber} — ${s.title} (${s.unitCode})` : undefined;
                        })() : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {spks.filter(s => s.status === "active" || s.status === "proses_konstruksi" || s.status === "overdue" || s.id === newMaterial.spkId).map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.spkNumber} &mdash; {s.title} ({s.unitCode})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {newMaterial.spkId && (() => {
                  const selSpk = spks.find(s => s.id === newMaterial.spkId);
                  if (!selSpk) return null;
                  return (
                    <div className="p-3.5 bg-[#8FAF9A]/5 border border-[#8FAF9A]/20 rounded-2xl space-y-2 text-xs animate-scale-in">
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Detail SPK</span>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1 font-semibold text-foreground">
                        <div className="space-y-0.5">
                          <span className="text-[10px] text-muted-foreground font-medium">{t("production.info_project")}</span>
                          <div>{selSpk.projectName}</div>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[10px] text-muted-foreground font-medium">{t("production.info_kavling")}</span>
                          <div className="font-mono text-primary font-bold">{selSpk.unitCode}</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    disabled={!newMaterial.spkId}
                    onClick={() => setMaterialStep(2)}
                    className="bg-primary hover:bg-[#4F6F52] text-white font-semibold text-xs rounded-xl shadow-sm h-9 px-4"
                  >
                    {t("production.btn_next")}
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 2: URAIAN & METERAN KEBUTUHAN/STOK */}
            {materialStep === 2 && (
              <div className="space-y-4 py-2">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground text-xs">{t("production.material_lbl_desc")}</label>
                  <Textarea
                    required
                    placeholder={t("production.material_desc_ph")}
                    className="border-[#8FAF9A]/30 focus-visible:ring-primary text-xs rounded-xl"
                    value={newMaterial.description}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewMaterial(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                    <span>{t("production.material_lbl_urgency")}</span>
                    <span className={`font-extrabold text-[10px] px-2 py-0.5 rounded-full ${
                      materialNecessity <= 35 ? "bg-[#DDE8D8] text-[#4F6F52]" :
                      materialNecessity <= 75 ? "bg-amber-100 text-amber-800" :
                      "bg-red-100 text-red-700 animate-pulse"
                    }`}>
                      {materialNecessity <= 35 ? t("production.urgency_low") :
                       materialNecessity <= 75 ? t("production.urgency_medium") :
                       t("production.urgency_critical")}
                    </span>
                  </div>
                  <Slider
                    min={1}
                    max={100}
                    step={5}
                    value={[materialNecessity]}
                    onValueChange={(val: number[]) => setMaterialNecessity(val[0])}
                    className="py-2"
                  />

                  {/* Meteran Bar Modern */}
                  <div className="h-3 bg-muted rounded-full overflow-hidden border border-border flex">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        materialNecessity <= 35 ? "bg-[#8FAF9A]" :
                        materialNecessity <= 75 ? "bg-[#E9C46A]" :
                        "bg-[#D77A7A]"
                      }`}
                      style={{ width: `${materialNecessity}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-muted-foreground font-semibold">
                    <span>{t("production.stock_safe")}</span>
                    <span>{t("production.stock_low")}</span>
                    <span>{t("production.stock_critical")}</span>
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setMaterialStep(1)}
                    className="text-xs text-muted-foreground hover:text-foreground h-9"
                  >
                    {t("production.btn_back")}
                  </Button>
                  <Button
                    type="button"
                    disabled={!newMaterial.description.trim()}
                    onClick={() => setMaterialStep(3)}
                    className="bg-primary hover:bg-[#4F6F52] text-white font-semibold text-xs rounded-xl shadow-sm h-9 px-4"
                  >
                    {t("production.btn_next")}
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: BIAYA & KONFIRMASI PENGAJUAN */}
            {materialStep === 3 && (
              <div className="space-y-4 py-2">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground text-xs">{t("production.material_lbl_cost")}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-muted-foreground font-semibold">Rp</span>
                    <Input
                      type="number"
                      required
                      placeholder={t("production.material_cost_ph")}
                      className="pl-8 border-[#8FAF9A]/30 focus-visible:ring-primary rounded-xl font-mono text-sm font-semibold"
                      value={newMaterial.estimatedAmount}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewMaterial(prev => ({ ...prev, estimatedAmount: e.target.value }))}
                    />
                  </div>
                </div>

                {Number(newMaterial.estimatedAmount) > 0 && (() => {
                  const selSpk = spks.find(s => s.id === newMaterial.spkId);
                  return (
                    <div className="p-3.5 bg-[#DDE8D8]/20 border border-[#8FAF9A]/20 rounded-2xl space-y-2 text-xs animate-scale-in">
                      <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Konfirmasi</span>
                      <div className="space-y-1.5 font-semibold text-foreground">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground font-medium">{t("production.material_est_cost_lbl")}</span>
                          <span className="font-mono text-sm font-bold text-[#4F6F52] tabular-nums">
                            Rp {Number(newMaterial.estimatedAmount).toLocaleString()}
                          </span>
                        </div>
                        {selSpk && (
                          <div className="flex justify-between border-t border-[#8FAF9A]/10 pt-1 text-[10px]">
                            <span className="text-muted-foreground font-medium">{t("production.material_spk_ceiling")}:</span>
                            <span className="font-mono text-foreground font-bold tabular-nums">
                              Rp {selSpk.rabAmount.toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                <div className="flex justify-between pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setMaterialStep(2)}
                    className="text-xs text-muted-foreground hover:text-foreground h-9"
                  >
                    {t("production.btn_back")}
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || !newMaterial.estimatedAmount}
                    className="bg-primary hover:bg-[#4F6F52] text-primary-foreground font-semibold text-xs rounded-xl shadow-sm h-9 px-4"
                  >
                    {t("production.btn_submit_material")}
                  </Button>
                </div>
              </div>
            )}
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 4: CATAT ESTIMASI HANDOVER SERAH TERIMA */}
      <Dialog open={handoverOpen} onOpenChange={setHandoverOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl bg-white/98 backdrop-blur-md border border-[#D6DED2] shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden font-sans">
          <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-[#D6DED2]">
            <DialogHeader>
              <DialogTitle className="text-primary font-bold text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {t("production.handover_form_title")}
              </DialogTitle>
              <DialogDescription className="text-xs">{t("production.handover_form_desc")}</DialogDescription>
            </DialogHeader>
          </div>
          <form onSubmit={handleCreateHandover} className="p-6 space-y-4 pt-4 max-h-[75vh] overflow-y-auto">

            <div className="space-y-3 text-sm">
              <div className="space-y-1">
                <label className="font-semibold text-foreground text-xs">{t("production.handover_lbl_unit")}</label>
                <Select
                  value={newHandover.unitId}
                  onValueChange={(val: string | null) => {
                    const cleanVal = val || "";
                    const linkedSpk = spks.find(s => s.unitId === cleanVal && s.status !== "cancelled");
                    setNewHandover(prev => ({
                      ...prev,
                      unitId: cleanVal,
                      spkId: linkedSpk?.id || "",
                    }));
                  }}
                  required
                  items={units.map(u => ({ label: `${u.code} — Progres ${u.constructionProgress}%`, value: u.id }))}
                >
                  <SelectTrigger className="w-full! w-full h-10 px-3 rounded-xl border border-[#8FAF9A]/30 focus:ring-primary focus:border-primary bg-white flex items-center justify-between text-xs transition-all">
                    <SelectValue placeholder={t("production.handover_lbl_unit")}>
                      {newHandover.unitId ? (() => {
                        const u = units.find(unit => unit.id === newHandover.unitId);
                        return u ? `${u.code} — Progres ${u.constructionProgress}%` : undefined;
                      })() : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false} side="bottom" sideOffset={4} className="bg-white border border-[#D6DED2] rounded-xl shadow-lg p-1 text-xs max-h-60 overflow-y-auto">
                    {units.filter(u => 
                      u.status === "construction" || 
                      u.status === "construction_done" || 
                      u.status === "sold" || 
                      u.status === "menunggu_serah_terima" || 
                      u.status === "handover_complete" || 
                      u.id === newHandover.unitId
                    ).map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.code} &mdash; Progres {u.constructionProgress}%</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground text-xs">Tipe Estimasi Serah Terima (BAST)</label>
                <Select
                  value={newHandover.handoverType}
                  onValueChange={(val: "vendor_to_developer" | "developer_to_customer" | null) => {
                    setNewHandover(prev => ({
                      ...prev,
                      handoverType: val || "vendor_to_developer",
                    }));
                  }}
                  required
                  items={[
                    { label: "BAST Vendor ke Developer (Fisik 100%)", value: "vendor_to_developer" },
                    { label: "BAST Developer ke Konsumen (Serah Kunci)", value: "developer_to_customer" }
                  ]}
                >
                  <SelectTrigger className="w-full! w-full h-10 px-3 rounded-xl border border-[#8FAF9A]/30 focus:ring-primary focus:border-primary bg-white flex items-center justify-between text-xs transition-all">
                    <SelectValue placeholder="Pilih Tipe Serah Terima">
                      {newHandover.handoverType === "vendor_to_developer" 
                        ? "BAST Vendor ke Developer (Fisik 100%)" 
                        : "BAST Developer ke Konsumen (Serah Kunci)"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false} side="bottom" sideOffset={4} className="bg-white border border-[#D6DED2] rounded-xl shadow-lg p-1 text-xs">
                    <SelectItem value="vendor_to_developer">BAST Vendor ke Developer (Fisik 100%)</SelectItem>
                    <SelectItem value="developer_to_customer">BAST Developer ke Konsumen (Serah Kunci)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground text-xs">{t("production.handover_lbl_date")}</label>
                <Input
                  type="date"
                  required
                  className="border-[#8FAF9A]/30 focus-visible:ring-primary text-xs"
                  value={newHandover.estimatedHandoverDate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewHandover(prev => ({ ...prev, estimatedHandoverDate: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground text-xs">{t("production.handover_lbl_notes")}</label>
                <Textarea
                  required
                  placeholder={t("production.handover_notes_ph")}
                  className="border-[#8FAF9A]/30 focus-visible:ring-primary text-xs"
                  value={newHandover.calculationNote}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewHandover(prev => ({ ...prev, calculationNote: e.target.value }))}
                />
              </div>

              {handoverValidationError && (
                <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-2xl text-xs flex items-start gap-2.5 animate-in fade-in duration-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{handoverValidationError}</span>
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setHandoverOpen(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {t("production.btn_cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !!handoverValidationError}
                className="bg-primary hover:bg-[#4F6F52] text-primary-foreground font-semibold text-xs"
              >
                {t("production.btn_save_handover")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 5: RECORD CUSTOMER COMPLAINTS */}
      <Dialog open={complaintOpen} onOpenChange={setComplaintOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg rounded-3xl bg-white/98 backdrop-blur-md border border-[#D6DED2] shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden font-sans">
          <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-[#D6DED2]">
            <DialogHeader>
              <DialogTitle className="text-primary font-bold text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {t("production.complaint_form_title")}
              </DialogTitle>
              <DialogDescription className="text-xs">{t("production.complaint_form_desc")}</DialogDescription>
            </DialogHeader>
          </div>
          <form onSubmit={handleCreateComplaint} className="p-6 space-y-4 pt-4 max-h-[75vh] overflow-y-auto">

            <div className="space-y-3 text-sm">
              <div className="space-y-1">
                <label className="font-semibold text-foreground text-xs">{t("production.complaint_lbl_customer")}</label>
                <Select
                  value={newComplaint.customerId}
                  onValueChange={(val: string | null) => setNewComplaint(prev => ({ ...prev, customerId: val || "" }))}
                  required
                  items={customers.map(c => ({ label: `${c.name} (${c.phone})`, value: c.id }))}
                >
                  <SelectTrigger className="w-full! h-10 border-[#8FAF9A]/30 focus:ring-primary rounded-xl text-xs bg-white">
                    <SelectValue placeholder={t("production.complaint_lbl_customer")}>
                      {newComplaint.customerId ? (() => {
                        const c = customers.find(cust => cust.id === newComplaint.customerId);
                        return c ? `${c.name} (${c.phone})` : undefined;
                      })() : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name} ({c.phone})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground text-xs">{t("production.complaint_lbl_unit")}</label>
                <Select
                  value={newComplaint.unitId}
                  onValueChange={(val: string | null) => setNewComplaint(prev => ({ ...prev, unitId: val || "" }))}
                  required
                  items={units.map(u => ({ label: `${u.code} — status ${u.status}`, value: u.id }))}
                >
                  <SelectTrigger className="w-full! h-10 border-[#8FAF9A]/30 focus:ring-primary rounded-xl text-xs bg-white">
                    <SelectValue placeholder={t("production.complaint_lbl_unit")}>
                      {newComplaint.unitId ? (() => {
                        const u = units.find(unit => unit.id === newComplaint.unitId);
                        return u ? `${u.code} — status ${u.status}` : undefined;
                      })() : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {units.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.code} &mdash; status {u.status}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground text-xs">Judul Komplain</label>
                <Input
                  type="text"
                  required
                  placeholder="Contoh: Plafon kamar mandi bocor..."
                  className="border-[#8FAF9A]/30 focus-visible:ring-primary text-xs rounded-xl"
                  value={newComplaint.title}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewComplaint(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground text-xs">{t("production.complaint_lbl_category")}</label>
                <Select
                  value={newComplaint.category}
                  onValueChange={(val: string | null) => setNewComplaint(prev => ({ ...prev, category: (val || "") as any }))}
                  required
                  items={[
                    { label: "Fisik Bangunan / Plafon / Dinding", value: "bangunan" },
                    { label: "BAST / Serah Terima", value: "serah_terima" },
                    { label: "Instalasi Air / Listrik", value: "listrik_air" },
                    { label: "Legalitas Sertifikat / PBB", value: "legalitas" },
                    { label: "Fasilitas Umum / Kawasan", value: "fasilitas" },
                    { label: "Pelayanan Staff", value: "pelayanan" },
                    { label: "Garansi Pemeliharaan", value: "after_sales" },
                    { label: "Lain-lain", value: "lainnya" },
                  ]}
                >
                  <SelectTrigger className="w-full! h-10 border-[#8FAF9A]/30 focus:ring-primary rounded-xl text-xs bg-white">
                    <SelectValue placeholder={t("production.complaint_lbl_category")}>
                      {newComplaint.category === "bangunan" && "Fisik Bangunan / Plafon / Dinding"}
                      {newComplaint.category === "serah_terima" && "BAST / Serah Terima"}
                      {newComplaint.category === "listrik_air" && "Instalasi Air / Listrik"}
                      {newComplaint.category === "legalitas" && "Legalitas Sertifikat / PBB"}
                      {newComplaint.category === "fasilitas" && "Fasilitas Umum / Kawasan"}
                      {newComplaint.category === "pelayanan" && "Pelayanan Staff"}
                      {newComplaint.category === "after_sales" && "Garansi Pemeliharaan"}
                      {newComplaint.category === "lainnya" && "Lain-lain"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bangunan">Fisik Bangunan / Plafon / Dinding</SelectItem>
                    <SelectItem value="serah_terima">BAST / Serah Terima</SelectItem>
                    <SelectItem value="listrik_air">Instalasi Air / Listrik</SelectItem>
                    <SelectItem value="legalitas">Legalitas Sertifikat / PBB</SelectItem>
                    <SelectItem value="fasilitas">Fasilitas Umum / Kawasan</SelectItem>
                    <SelectItem value="pelayanan">Pelayanan Staff</SelectItem>
                    <SelectItem value="after_sales">Garansi Pemeliharaan</SelectItem>
                    <SelectItem value="lainnya">Lain-lain</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground text-xs">{t("production.complaint_lbl_desc")}</label>
                <Textarea
                  required
                  placeholder={t("production.complaint_desc_ph")}
                  className="border-[#8FAF9A]/30 focus-visible:ring-primary text-xs"
                  value={newComplaint.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewComplaint(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setComplaintOpen(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {t("production.btn_cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-primary hover:bg-[#4F6F52] text-primary-foreground font-semibold text-xs"
              >
                {t("production.btn_submit_complaint")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG 6: UPLOAD BAST VENDOR TO DEVELOPER PDF */}
      <Dialog open={bastDialogOpen} onOpenChange={setBastDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl bg-white/98 backdrop-blur-md border border-[#D6DED2] shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden font-sans">
          <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-[#D6DED2]">
            <DialogHeader>
              <DialogTitle className="text-primary font-bold text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Konfirmasi Selesai Pembangunan
              </DialogTitle>
              <DialogDescription className="text-xs">
                Unggah dokumen Berita Acara Serah Terima (BAST) fisik yang ditandatangani Kontraktor/Vendor ke Developer untuk menyelesaikan unit.
              </DialogDescription>
            </DialogHeader>
          </div>
          <form onSubmit={handleCompleteConstructionWithBast} className="p-6 space-y-4 pt-4">
            {bastUnit && (
              <div className="p-3.5 bg-[#8FAF9A]/5 border border-[#8FAF9A]/20 rounded-2xl space-y-2 text-xs font-semibold text-foreground">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Kavling / Unit:</span>
                  <span className="font-mono text-primary font-bold">{bastUnit.code}</span>
                </div>
                {bastSpk && (
                  <div className="flex justify-between border-t border-[#8FAF9A]/10 pt-1.5">
                    <span className="text-muted-foreground">SPK Terkait:</span>
                    <span className="font-mono">{bastSpk.spkNumber}</span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground text-xs">Unggah File PDF BAST (Tanda Tangan Basah/Digital)</label>
              <div 
                onClick={() => document.getElementById('bast-pdf-upload')?.click()}
                className="border-2 border-dashed border-[#8FAF9A]/30 hover:border-primary/50 bg-[#F7F8F3]/60 hover:bg-[#8FAF9A]/5 rounded-2xl p-6 text-center cursor-pointer transition-all duration-150 group"
              >
                <input
                  id="bast-pdf-upload"
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  required
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setBastPdfFile(e.target.files[0]);
                    }
                  }}
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="p-2.5 bg-white rounded-full shadow-sm text-primary group-hover:scale-110 transition-transform duration-200">
                    <UploadCloud className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-bold text-foreground">
                    {bastPdfFile ? bastPdfFile.name : "Pilih File PDF BAST"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {bastPdfFile ? `Ukuran: ${(bastPdfFile.size / 1024 / 1024).toFixed(2)} MB` : "Hanya mendukung format PDF (Maks. 10MB)"}
                  </span>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-2 border-t border-[#8FAF9A]/10 mt-4 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setBastDialogOpen(false)}
                className="text-xs text-muted-foreground hover:text-foreground rounded-xl"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !bastPdfFile}
                className="bg-[#4F6F52] hover:bg-[#3D563F] text-white font-extrabold text-xs rounded-xl shadow-sm px-4 flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-1">
                    <span className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Memproses...
                  </span>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-white" />
                    Selesai &amp; Jadikan Ready Stock
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CustomerComplaintResolveDialog
        complaint={selectedResolveComplaint}
        open={resolveDialogOpen}
        onClose={() => {
          setResolveDialogOpen(false);
          setSelectedResolveComplaint(null);
        }}
        onSuccess={() => {
          setResolveDialogOpen(false);
          setSelectedResolveComplaint(null);
          router.refresh();
        }}
      />
    </div>
  );
}
