"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  Lock,
  Building2,
  Ruler,
  Tag,
  Search,
  X,
  Compass,
  CheckCircle2,
  Hammer,
  HardHat,
  Clock,
  HelpCircle,
  User,
  Phone,
  Activity,
  Sparkles,
  Camera,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CreditCard,
  CalendarDays,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Layers,
  UploadCloud,
  Trash2,
  Link2,
  PlusCircle,
  Loader2,
} from "lucide-react";
import { getStatusColor, STATUS_COLORS, type UnitStatus, getUnitStatusLabel } from "@/lib/siteplan-utils";
import { coordsToPolygonPoints } from "@/lib/siteplan-utils";
import AddBookingDialog from "@/app/marketing/bookings/add-booking-dialog";
import { UnitForm } from "@/app/master/units/unit-form";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { getSpkDetails, completeConstruction, getActiveSpkForUnit, uploadBastAttachment, getBastAttachmentForSpk } from "@/server/actions/production";
import { startPhysicalConstructionManual } from "@/server/actions/marketing";
import { updateUnitDefectList, deleteUnitAttachment } from "@/server/actions/master";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { updateShape } from "@/server/actions/siteplan";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UnitTimeline } from "@/app/siteplan/[projectId]/unit-timeline";

export type ShapeWithUnit = {
  id: string;
  shapeType: "polygon" | "rect" | "path";
  coordinates: { x: number; y: number }[];
  label: string | null;
  colorOverride: string | null;
  unit?: {
    id: string;
    code: string;
    typeName: string | null;
    landArea: number;
    buildingArea: number;
    price: number;
    status: string;
    isReadyStock: boolean;
    constructionProgress: number;
    notes: string | null;
    cluster: string | null;
    currentSpkId?: string | null;
    currentBookingId?: string | null;
    currentCustomerId?: string | null;
    readyStockSource?: string | null;
  } | null;
};

// Helper functions for unit stock type and financial/physical readiness
function getUnitStockType(unit: ShapeWithUnit["unit"]) {
  if (!unit) return "unknown";
  const isReady = !!unit.isReadyStock;

  if (isReady) {
    if (unit.status === "available") {
      return "available_ready_stock";
    }
    if (["construction", "overdue"].includes(unit.status)) {
      return "building_for_ready_stock";
    }
    if (unit.status === "construction_done") {
      return "construction_done_ready_stock";
    }
    if (unit.status === "booking") {
      return "booking_ready_stock";
    }
    if (unit.status === "kpr_process") {
      return "kpr_process_ready_stock";
    }
    if (unit.status === "sold") {
      return "sold_ready_stock";
    }
    if (unit.status === "menunggu_serah_terima") {
      return "menunggu_serah_terima_ready_stock";
    }
    if (unit.status === "handover_complete") {
      return "handover_complete_ready_stock";
    }
  }

  // Indent (non-ready stock)
  if (unit.status === "available") {
    return "available";
  }

  if (["construction", "overdue"].includes(unit.status)) {
    return "construction";
  }

  if (unit.status === "construction_done") {
    return "construction_done";
  }

  if (["booking", "kpr_process"].includes(unit.status)) {
    return "booking";
  }

  const isPostConstruction = [
    "sold",
    "menunggu_serah_terima",
    "handover_complete",
  ].includes(unit.status);

  if (isPostConstruction) {
    return "construction_done";
  }

  return "unknown";
}

type BookingInfo = { id: string; unitId: string; customerId: string; paymentScheme: string; status: string; createdAt?: string | Date };
type InvoiceInfo = { id: string; bookingId: string | null; type: string; status: string; amount: number };
type KprProcessInfo = { id: string; bookingId: string; status: string; biCheckStatus: string; documentStatus: string; bankNotes?: string | null };

function getFinancialReadiness(activeBooking: BookingInfo | null, invoices: InvoiceInfo[], kprProcess: KprProcessInfo | undefined | null) {
  if (!activeBooking) {
    return {
      ready: false,
      reason: "Unit belum memiliki booking aktif.",
    };
  }

  const bookingInvoices = invoices.filter((invoice) => invoice.bookingId === activeBooking.id);

  if (activeBooking.paymentScheme === "cash") {
    const isCashPaid = bookingInvoices.length > 0 && bookingInvoices.every((invoice) => invoice.status === "paid");

    return {
      ready: isCashPaid,
      reason: isCashPaid
        ? "Pembayaran cash sudah lunas."
        : "Menunggu pelunasan cash.",
    };
  }

  if (
    activeBooking.paymentScheme === "installment" ||
    activeBooking.paymentScheme === "cash_bertahap"
  ) {
    const allInvoicesPaid = bookingInvoices.length > 0 && bookingInvoices.every((invoice) => invoice.status === "paid");

    return {
      ready: allInvoicesPaid,
      reason: allInvoicesPaid
        ? "Seluruh invoice sudah lunas."
        : "Masih ada invoice / termin yang belum dibayar.",
    };
  }

  if (activeBooking.paymentScheme === "kpr") {
    const isRealized = kprProcess?.status === "realisasi";

    return {
      ready: isRealized,
      reason: isRealized
        ? "Dana KPR sudah realisasi."
        : "Menunggu realisasi dana bank.",
    };
  }

  return {
    ready: false,
    reason: "Skema pembayaran tidak dikenali.",
  };
}

function getPhysicalReadiness(unit: ShapeWithUnit["unit"], selectedSpkBast: unknown) {
  if (!unit) return { ready: false, reason: "Unit tidak ditemukan." };
  const unitStockType = getUnitStockType(unit);

  const isReadyStockType = [
    "available_ready_stock",
    "booking_ready_stock",
    "kpr_process_ready_stock",
    "sold_ready_stock",
    "menunggu_serah_terima_ready_stock",
    "handover_complete_ready_stock",
    "construction_done_ready_stock",
  ].includes(unitStockType);

  // Ready stock units are always physically ready
  if (isReadyStockType) {
    return {
      ready: true,
      reason: "Unit sudah Tersedia Siap Huni.",
    };
  }

  if (unitStockType === "building_for_ready_stock") {
    const progressDone = unit.constructionProgress === 100;
    // attachments table has no 'status' column — existence of a BAST vendor attachment
    // combined with progress=100 is sufficient signal that the vendor submitted BAST.
    const bastVendorUploaded = !!selectedSpkBast;

    return {
      ready: progressDone && bastVendorUploaded,
      reason:
        progressDone && bastVendorUploaded
          ? "Pembangunan selesai dan BAST Vendor sudah diupload."
          : "Pembangunan belum selesai atau BAST Vendor belum diupload.",
    };
  }

  if (unitStockType === "available") {
    // Indent unit that is "available" (not yet booked or construction started)
    // No physical building yet — physical check gate applies after construction completes
    return {
      ready: false,
      reason: "Unit belum melewati tahap pembangunan fisik.",
    };
  }

  // construction_done (indent, non-ready-stock): physical is done
  if (unitStockType === "construction_done") {
    return {
      ready: true,
      reason: "Pembangunan selesai.",
    };
  }

  return {
    ready: false,
    reason: "Status fisik unit belum siap.",
  };
}

function getHandoverEligibility(
  unit: ShapeWithUnit["unit"],
  activeBooking: BookingInfo | null,
  invoices: InvoiceInfo[],
  kprProcess: KprProcessInfo | undefined | null,
  selectedSpkBast: unknown
) {
  if (!unit) {
    return {
      eligible: false,
      reason: "Unit tidak ditemukan.",
    };
  }

  if (!activeBooking) {
    return {
      eligible: false,
      reason: "Unit belum memiliki booking aktif.",
    };
  }

  if (unit.status === "handover_complete") {
    return {
      eligible: false,
      reason: "Serah terima sudah selesai.",
      readonly: true,
    };
  }

  const financial = getFinancialReadiness(activeBooking, invoices, kprProcess);
  const physical = getPhysicalReadiness(unit, selectedSpkBast);

  if (!financial.ready) {
    return {
      eligible: false,
      reason: financial.reason,
    };
  }

  if (!physical.ready) {
    return {
      eligible: false,
      reason: physical.reason,
    };
  }

  if (unit.status !== "menunggu_serah_terima") {
    return {
      eligible: false,
      reason: "Unit belum masuk status Menunggu Serah Terima.",
    };
  }

  return {
    eligible: true,
    reason: "Syarat finansial dan fisik sudah terpenuhi.",
  };
}

function getActiveBooking(unitId: string, bookingsList: BookingInfo[] | undefined) {
  if (!bookingsList) return null;
  const validBookings = bookingsList
    .filter((b) => b.unitId === unitId)
    .filter((b) => !["cancelled", "rejected", "batal"].includes(b.status));

  // prioritas status
  return (
    validBookings.find((b) => b.status === "akad") ||
    validBookings.find((b) => b.status === "completed") ||
    validBookings.find((b) => b.status === "active") ||
    [...validBookings].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (dateA !== dateB) return dateB - dateA;
      return b.id.localeCompare(a.id);
    })[0] ||
    null
  );
}

type SiteplanViewerProps = {
  shapes: ShapeWithUnit[];
  imageUrl?: string | null;
  width: number;
  height: number;
  activeStatuses?: string[];
  projects?: { id: string; name: string }[];
  units?: { id: string; code: string; projectId: string; price: number; status: string }[];
  customers?: { id: string; name: string; phone?: string | null }[];
  leads?: { id: string; name: string; phone: string; status: string; assignedMarketingId: string | null }[];
  bookings?: { id: string; unitId: string; customerId: string; paymentScheme: string; status: string; createdAt?: string | Date }[];
  invoices?: Array<{ id: string; bookingId: string | null; type: string; status: string; amount: number }>;
  kprProcesses?: Array<{ id: string; bookingId: string; status: string; biCheckStatus: string; documentStatus: string; bankNotes?: string | null }>;
  marketings?: { id: string; name: string; roleName?: string | null }[];
  currentUser?: { id: string; name: string; role?: string };
  canBook?: boolean;
  canViewBooking?: boolean;
  progressPhotos?: Record<string, Array<{
    workItemName: string;
    progressDate: Date;
    notes: string | null;
    fileUrl: string;
    fileName: string;
  }>>;
  vendors?: { id: string; name: string }[];
  unitAttachments?: Record<string, Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    fileSize: number | null;
    mimeType: string | null;
    createdAt: Date;
  }>>;
};

export function SiteplanViewer({
  shapes,
  imageUrl,
  width,
  height,
  activeStatuses,
  projects,
  units,
  customers = [],
  leads = [],
  bookings = [],
  invoices = [],
  kprProcesses = [],
  marketings,
  currentUser,
  canBook,
  canViewBooking,
  progressPhotos = {},
  vendors = [],
  unitAttachments = {},
}: SiteplanViewerProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [hoveredShape, setHoveredShape] = useState<ShapeWithUnit | null>(null);
  const [selectedShape, setSelectedShape] = useState<ShapeWithUnit | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpkWeights, setSelectedSpkWeights] = useState<Array<{ workItemId: string; name: string; weightPct: number; currentProgress: number }>>([]);
  const [selectedSpkPhotos, setSelectedSpkPhotos] = useState<Array<{ workItemName: string; progressDate: Date; notes: string | null; fileUrl: string; fileName: string }>>([]);
  const [loadingSpkDetails, setLoadingSpkDetails] = useState(false);

  // States for Ready Stock Defect Lists
  const [editingDefectNotes, setEditingDefectNotes] = useState(false);
  const [defectNotesValue, setDefectNotesValue] = useState("");
  const [defectPhotosList, setDefectPhotosList] = useState<any[]>([]);
  const [uploadingDefectPhoto, setUploadingDefectPhoto] = useState(false);

  // States for linking unlinked shape
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [isLinking, setIsLinking] = useState(false);
  const canEdit = currentUser?.role === "Super Admin" || currentUser?.role === "Admin Kantor";
  const linkedUnitIds = new Set(shapes.map(s => s.unit?.id).filter(Boolean));
  const unlinkedUnits = units?.filter(u => !linkedUnitIds.has(u.id)) || [];

  // Synchronize selected shape data and handle sessionStorage persistence
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedId = sessionStorage.getItem("selectedShapeId");
      if (savedId) {
        const updatedShape = shapes.find((s) => s.id === savedId);
        if (updatedShape) {
          setSelectedShape(updatedShape);
        }
      } else if (selectedShape) {
        const updatedShape = shapes.find((s) => s.id === selectedShape.id);
        if (updatedShape) {
          setSelectedShape(updatedShape);
        }
      }
    }
  }, [shapes]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (selectedShape) {
        sessionStorage.setItem("selectedShapeId", selectedShape.id);
      } else {
        sessionStorage.removeItem("selectedShapeId");
      }
    }
  }, [selectedShape]);

  useEffect(() => {
    if (selectedShape?.unit) {
      setDefectNotesValue(selectedShape.unit.notes || "");
      setDefectPhotosList(unitAttachments[selectedShape.unit.id] || []);
      setEditingDefectNotes(false);
    }
  }, [selectedShape, unitAttachments]);

  const handleSaveDefectNotes = async () => {
    if (!selectedShape?.unit) return;
    setIsSubmitting(true);
    try {
      const res = await updateUnitDefectList(selectedShape.unit.id, defectNotesValue);
      if (res.success) {
        setEditingDefectNotes(false);
        setSelectedShape(prev => {
          if (!prev || !prev.unit) return prev;
          return {
            ...prev,
            unit: {
              ...prev.unit,
              notes: defectNotesValue
            }
          };
        });
        alert("Catatan cacat fisik (defect list) berhasil disimpan!");
      }
    } catch (err: unknown) {
      alert((err instanceof Error ? err.message : null) || "Gagal menyimpan catatan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadDefectPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedShape?.unit) return;
    const file = files[0];
    
    setUploadingDefectPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/upload-attachment", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const errData = await uploadRes.json();
        throw new Error(errData.error || "Gagal mengunggah foto.");
      }

      const fileData = await uploadRes.json();

      const res = await updateUnitDefectList(selectedShape.unit.id, defectNotesValue, {
        fileName: file.name,
        fileUrl: fileData.url,
        fileSize: file.size,
        mimeType: file.type,
      });

      if (res.success) {
        alert("Foto defect berhasil diunggah!");
        router.refresh();
      }
    } catch (err: unknown) {
      alert((err instanceof Error ? err.message : null) || "Gagal mengunggah foto.");
    } finally {
      setUploadingDefectPhoto(false);
    }
  };

  const handleDeleteDefectPhoto = async (attachmentId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus foto defect ini?")) return;
    setIsSubmitting(true);
    try {
      const res = await deleteUnitAttachment(attachmentId);
      if (res.success) {
        setDefectPhotosList(prev => prev.filter(p => p.id !== attachmentId));
        alert("Foto defect berhasil dihapus!");
      }
    } catch (err: unknown) {
      alert((err instanceof Error ? err.message : null) || "Gagal menghapus foto.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLinkShapeToUnit = async () => {
    if (!selectedShape || !selectedUnitId) return;
    setIsLinking(true);
    try {
      const res = await updateShape(selectedShape.id, { unitId: selectedUnitId });
      if (res.success) {
        alert("Kavling berhasil dikaitkan dengan unit/kavling yang dipilih!");
        router.refresh();
      }
    } catch (err: unknown) {
      alert((err instanceof Error ? err.message : null) || "Gagal mengaitkan unit.");
    } finally {
      setIsLinking(false);
    }
  };

  const handleCreateUnitAndLink = async (newUnitId: string) => {
    if (!selectedShape) return;
    try {
      const res = await updateShape(selectedShape.id, { unitId: newUnitId });
      if (!res.success) {
        throw new Error("Gagal mengaitkan koordinat ke unit.");
      }
    } catch (err: unknown) {
      console.error("Gagal menautkan unit baru ke shape:", err);
      alert("Unit berhasil dibuat, tetapi gagal ditautkan ke koordinat. Hubungkan manual unit ini.");
    }
  };

  // BAST Upload Dialog states
  const [bastDialogOpen, setBastDialogOpen] = useState(false);
  const [bastUnit, setBastUnit] = useState<ShapeWithUnit["unit"]>(null);
  const [bastSpk, setBastSpk] = useState<Awaited<ReturnType<typeof getActiveSpkForUnit>> | null>(null);
  const [bastPdfFile, setBastPdfFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedSpkBast, setSelectedSpkBast] = useState<{ id: string; fileUrl: string; fileName: string } | null>(null);

  const handleOpenBastDialog = async (unit: ShapeWithUnit["unit"]) => {
    if (!unit) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const spk = await getActiveSpkForUnit(unit.id);
      if (!spk) {
        alert("Gagal menemukan SPK aktif/selesai untuk unit ini. BAST memerlukan SPK terbit.");
        return;
      }
      setBastUnit(unit);
      setBastSpk(spk);
      setBastPdfFile(null);
      setBastDialogOpen(true);
    } catch (err: unknown) {
      alert((err instanceof Error ? err.message : null) || "Gagal mengambil data SPK terkait.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
        alert(`Unit "${bastUnit.code}" berhasil dinyatakan selesai pembangunan dan status berubah menjadi Tersedia Siap Huni!`);
        setBastDialogOpen(false);
        setBastUnit(null);
        setBastSpk(null);
        setBastPdfFile(null);
        setSelectedShape(null);
        router.refresh();
      }
    } catch (e: unknown) {
      setErrorMessage((e instanceof Error ? e.message : null) || "Gagal menyelesaikan pembangunan unit.");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const fetchSpkDetails = async () => {
      let spkId = selectedShape?.unit?.currentSpkId;

      if (!spkId && selectedShape?.unit?.id) {
        try {
          const activeSpk = await getActiveSpkForUnit(selectedShape.unit.id);
          if (activeSpk) {
            spkId = activeSpk.id;
          }
        } catch (e) {
          console.error("Gagal mengambil active SPK untuk unit:", e);
        }
      }

      if (!spkId) {
        setSelectedSpkWeights([]);
        setSelectedSpkPhotos([]);
        setSelectedSpkBast(null);
        return;
      }

      setLoadingSpkDetails(true);

      getBastAttachmentForSpk(spkId)
        .then((attachment) => {
          setSelectedSpkBast(attachment);
        })
        .catch((err) => {
          console.error("Gagal memuat BAST attachment:", err);
          setSelectedSpkBast(null);
        });

      getSpkDetails(spkId)
        .then((details) => {
          if (details) {
            // Map weights
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
            setSelectedSpkWeights(items);

            // Map photos from logs that have attachments (supporting multiple photos per work item)
            const photosList: Array<{
              workItemName: string;
              progressDate: Date;
              notes: string | null;
              fileUrl: string;
              fileName: string;
            }> = [];

            details.logs.forEach(l => {
              if (l.attachments && l.attachments.length > 0) {
                l.attachments.forEach(att => {
                  if (att.fileUrl) {
                    photosList.push({
                      workItemName: l.workItem.name,
                      progressDate: l.log.progressDate,
                      notes: l.log.notes,
                      fileUrl: att.fileUrl,
                      fileName: att.fileName,
                    });
                  }
                });
              } else if (l.attachment && l.attachment.fileUrl) {
                photosList.push({
                  workItemName: l.workItem.name,
                  progressDate: l.log.progressDate,
                  notes: l.log.notes,
                  fileUrl: l.attachment.fileUrl,
                  fileName: l.attachment.fileName,
                });
              }
            });
            setSelectedSpkPhotos(photosList);
          } else {
            setSelectedSpkWeights([]);
            setSelectedSpkPhotos([]);
          }
        })
        .catch((err) => {
          console.error("Gagal memuat detail SPK di siteplan:", err);
          setSelectedSpkWeights([]);
          setSelectedSpkPhotos([]);
        })
        .finally(() => {
          setLoadingSpkDetails(false);
        });
    };

    fetchSpkDetails();
  }, [selectedShape]);

  // Zoom and Pan State
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);

  const visibleShapes =
    activeStatuses && activeStatuses.length > 0
      ? shapes.filter((s) => {
          if (!s.unit) return true;
          let unitStatusKey = s.unit.status;
          if (s.unit.isReadyStock) {
            if (s.unit.status === "available") unitStatusKey = "available_ready_stock";
            else if (s.unit.status === "construction") unitStatusKey = "construction_ready_stock";
          }
          return activeStatuses.includes(unitStatusKey);
        })
      : shapes;

  const filteredShapes = visibleShapes.map((shape) => {
    const isMatching =
      searchQuery === "" ||
      shape.unit?.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shape.label?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shape.unit?.cluster?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shape.unit?.typeName?.toLowerCase().includes(searchQuery.toLowerCase());

    return { ...shape, isMatching };
  });

  // Track cursor coordinates for tooltip
  const handleMouseMoveSVG = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({ x: e.clientX - rect.left + 12, y: e.clientY - rect.top - 10 });

    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    if (Math.hypot(dx, dy) > 2) {
      setHasDragged(true);
      setTranslateX((prev) => prev + dx);
      setTranslateY((prev) => prev + dy);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.button !== 1) return; // Only pan with left or middle click
    setIsDragging(true);
    setHasDragged(false);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeaveSVG = () => {
    setIsDragging(false);
    setHoveredShape(null);
  };

  const handleTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setHasDragged(false);
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!isDragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStart.x;
    const dy = e.touches[0].clientY - dragStart.y;

    if (Math.hypot(dx, dy) > 2) {
      setHasDragged(true);
      setTranslateX((prev) => prev + dx);
      setTranslateY((prev) => prev + dy);
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  };

  const resetView = () => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  };

  const unit = selectedShape?.unit;
  const isReadyStock = !!unit?.isReadyStock;
  const statusColor = getStatusColor(unit?.status, isReadyStock);
  const activeBooking = unit ? getActiveBooking(unit.id, bookings) : null;

  // Retrieve current booking to determine payment scheme
  const realBooking = activeBooking || (unit ? bookings?.find(b => b.id === unit.currentBookingId) : null);
  const paymentScheme = realBooking?.paymentScheme;

  const isReady = unit ? !!unit.isReadyStock : false;
  const getUnbookedStatusLabel = (status: string, isReadyStock: boolean) => {
    if (status === "available") {
      return isReadyStock ? "Tersedia Siap Huni" : "Tersedia (Indent)";
    }
    if (status === "construction" || status === "overdue") {
      return isReadyStock ? "Sedang Dibangun untuk Ready Stock" : "Pembangunan Unit Konsumen";
    }
    if (status === "construction_done") {
      return isReadyStock ? "Tersedia Siap Huni" : "Selesai Bangun";
    }
    return getUnitStatusLabel(status, isReadyStock);
  };

  const displayStatusLabel = unit
    ? (activeBooking
      ? getUnitStatusLabel(unit.status, isReady)
      : getUnbookedStatusLabel(unit.status, isReady))
    : "—";

  // Generate Timeline Data based on current status
  const getTimelineSteps = ({
    unit,
    activeBooking,
    paymentScheme,
    kprProcess,
    invoices
  }: {
    unit: NonNullable<ShapeWithUnit["unit"]>;
    activeBooking: BookingInfo | null;
    paymentScheme?: string;
    kprProcess?: KprProcessInfo | null;
    invoices: InvoiceInfo[];
  }) => {
    if (!activeBooking) {
      const isReadyVal = !!unit.isReadyStock;
      const isBuilding = unit.status === "construction" || unit.status === "overdue";

      // "Sedang Dibangun untuk Ready Stock" — internal construction, no buyer yet
      if (isReadyVal && isBuilding) {
        return [
          { key: "building_rs",     label: "Sedang Dibangun untuk Ready Stock", desc: `Konstruksi internal berjalan (${unit.constructionProgress ?? 0}%)`, done: false, active: true },
          { key: "waiting_booking", label: "Menunggu Booking Konsumen",         desc: "Unit akan siap dipasarkan setelah fisik selesai", done: false, active: false },
          { key: "booking",         label: "Booking / Penjualan",               desc: "Pendaftaran transaksi konsumen", done: false, active: false },
          { key: "payment",         label: "Pembayaran sesuai skema",           desc: "Cash, Cash Bertahap, atau KPR", done: false, active: false },
          { key: "physical_check",  label: "Cek Fisik & BAST Vendor",           desc: "Progress 100% dan BAST Vendor diupload", done: false, active: false },
          { key: "handover_waiting",label: "Menunggu Serah Terima",             desc: "Fisik & Finansial selesai divalidasi", done: false, active: false },
          { key: "bast_developer",  label: "BAST Developer ke Konsumen",        desc: "Penandatanganan berita acara serah terima", done: false, active: false },
          { key: "handover_done",   label: "Serah Terima Selesai",              desc: "Kunci fisik unit diserahkan", done: false, active: false },
        ];
      }

      // "Tersedia Siap Huni" — unit already done, waiting buyer
      if (isReadyVal) {
        return [
          { key: "available",       label: "Tersedia Siap Huni",   desc: "Unit siap huni siap dipasarkan — fisik sudah selesai", done: true, active: true },
          { key: "waiting_booking", label: "Menunggu Booking Konsumen", desc: "Menunggu minat calon konsumen", done: false, active: false },
          { key: "booking",         label: "Booking / Penjualan",       desc: "Pendaftaran transaksi konsumen", done: false, active: false },
          { key: "payment",         label: "Pembayaran sesuai skema",   desc: "Cash, Cash Bertahap, atau KPR", done: false, active: false },
          { key: "handover_waiting",label: "Menunggu Serah Terima",     desc: "Finansial selesai divalidasi — fisik sudah siap", done: false, active: false },
          { key: "bast_developer",  label: "BAST Developer ke Konsumen",desc: "Penandatanganan berita acara serah terima", done: false, active: false },
          { key: "handover_done",   label: "Serah Terima Selesai",      desc: "Kunci fisik unit diserahkan", done: false, active: false },
        ];
      }

      // "Tersedia" — indent unit, belum ada buyer, belum dibangun
      return [
        { key: "available",       label: "Tersedia",                           desc: "Unit siap dipasarkan", done: true, active: true },
        { key: "waiting_booking", label: "Menunggu Booking Konsumen",          desc: "Menunggu minat calon konsumen", done: false, active: false },
        { key: "booking",         label: "Booking / Penjualan",                desc: "Pendaftaran transaksi konsumen", done: false, active: false },
        { key: "payment",         label: "Pembayaran sesuai skema",            desc: "Cash, Cash Bertahap, atau KPR", done: false, active: false },
        { key: "construction",    label: "Pembangunan fisik",                  desc: "Pembangunan unit dimulai setelah syarat terpenuhi", done: false, active: false },
        { key: "handover_waiting",label: "Menunggu Serah Terima",              desc: "Fisik & Finansial selesai divalidasi", done: false, active: false },
        { key: "bast_developer",  label: "BAST Developer ke Konsumen",         desc: "Penandatanganan berita acara serah terima", done: false, active: false },
        { key: "handover_done",   label: "Serah Terima Selesai",               desc: "Kunci fisik unit diserahkan", done: false, active: false },
      ];
    }

    const unitStockType = getUnitStockType(unit);
    const isReadyStockUnit = [
      "available_ready_stock",
      "booking_ready_stock",
      "kpr_process_ready_stock",
      "sold_ready_stock",
      "menunggu_serah_terima_ready_stock",
      "handover_complete_ready_stock",
      "construction_done_ready_stock",
    ].includes(unitStockType);

    const bookingInvoices = invoices.filter((invoice) => invoice.bookingId === activeBooking.id);
    const bfInvoice = bookingInvoices.find((invoice) => invoice.type === "booking_fee");
    const bfPaid = bfInvoice?.status === "paid";
    const dpInvoice = bookingInvoices.find((invoice) => invoice.type === "dp");
    const dpPaid = dpInvoice?.status === "paid";

    const isHandoverWaiting = unit.status === "menunggu_serah_terima";
    const isHandoverComplete = unit.status === "handover_complete";

    const physical = getPhysicalReadiness(unit, selectedSpkBast);
    const physicalReady = physical.ready;

    // Helper to override all steps to done if handover is complete
    const overrideIfHandoverComplete = <T extends { label: string; done: boolean; key?: string }>(stepsList: T[]) => {
      if (isHandoverComplete) {
        return stepsList.map((s) => ({
          ...s,
          done: true,
          active: s.key === "handover_done",
        }));
      }
      return stepsList;
    };

    // ----------------------------------------------------
    // CASH SCHEME
    // ----------------------------------------------------
    if (paymentScheme === "cash") {
      const isCashPaid = bookingInvoices.length > 0 && bookingInvoices.every((invoice) => invoice.status === "paid");

      if (isReadyStockUnit) {
        const steps = [
          { key: "available", label: "Tersedia Siap Huni", desc: "Unit siap huni siap dipasarkan", done: true, active: false },
          { key: "booking_fee", label: "Booking Fee", desc: "Pembayaran booking fee awal", done: bfPaid, active: !bfPaid },
          { key: "cash_payment", label: "Pelunasan Cash", desc: "Pelunasan sisa pembayaran unit", done: isCashPaid, active: bfPaid && !isCashPaid },
          { key: "akad_ppjb", label: "Akad / PPJB", desc: "Penandatanganan Akad / PPJB", done: isCashPaid, active: isCashPaid && !isHandoverWaiting && !isHandoverComplete },
          { key: "handover_waiting", label: "Menunggu Serah Terima", desc: "Fisik & Finansial selesai divalidasi", done: isHandoverWaiting || isHandoverComplete, active: isHandoverWaiting },
          { key: "bast_developer", label: "BAST Developer ke Konsumen", desc: "Penandatanganan berita acara serah terima", done: isHandoverComplete, active: isHandoverWaiting },
          { key: "handover_done", label: "Serah Terima Selesai", desc: "Kunci fisik unit diserahkan", done: isHandoverComplete, active: isHandoverComplete },
        ];
        return overrideIfHandoverComplete(steps);
      }

      if (unitStockType === "building_for_ready_stock") {
        const steps = [
          { key: "available", label: "Sedang Dibangun untuk Ready Stock", desc: "Unit sedang dalam konstruksi internal", done: true, active: false },
          { key: "booking_fee", label: "Booking Fee", desc: "Pembayaran booking fee awal", done: bfPaid, active: !bfPaid },
          { key: "cash_payment", label: "Pelunasan Cash", desc: "Pelunasan sisa pembayaran unit", done: isCashPaid, active: bfPaid && !isCashPaid },
          { key: "akad_ppjb", label: "Akad / PPJB", desc: "Penandatanganan Akad / PPJB", done: isCashPaid, active: isCashPaid && !physicalReady },
          { key: "physical_waiting", label: "Menunggu Fisik Selesai", desc: "Progress 100% & BAST Vendor approved", done: physicalReady, active: isCashPaid && !physicalReady },
          { key: "handover_waiting", label: "Menunggu Serah Terima", desc: "Fisik & Finansial selesai divalidasi", done: isHandoverWaiting || isHandoverComplete, active: isHandoverWaiting },
          { key: "bast_developer", label: "BAST Developer ke Konsumen", desc: "Penandatanganan berita acara serah terima", done: isHandoverComplete, active: isHandoverWaiting },
          { key: "handover_done", label: "Serah Terima Selesai", desc: "Kunci fisik unit diserahkan", done: isHandoverComplete, active: isHandoverComplete },
        ];
        return overrideIfHandoverComplete(steps);
      }

      // Default / Tersedia non-ready stock / Kavling
      const steps = [
        { key: "available", label: "Tersedia", desc: "Unit siap dipasarkan", done: true, active: false },
        { key: "booking_fee", label: "Booking Fee", desc: "Pembayaran booking fee awal", done: bfPaid, active: !bfPaid },
        { key: "booking_pemberkasan", label: "Booking & Pemberkasan", desc: "Verifikasi kas & berkas konsumen", done: bfPaid, active: bfPaid && !isCashPaid },
        { key: "cash_payment", label: "Pelunasan Cash", desc: "Pelunasan sisa pembayaran unit", done: isCashPaid, active: bfPaid && !isCashPaid },
        { key: "akad_ppjb", label: "Akad / PPJB", desc: "Penandatanganan Akad / PPJB", done: isCashPaid, active: isCashPaid && !physicalReady },
        { key: "physical_waiting", label: "Cek Fisik Unit", desc: "Menunggu pembangunan fisik selesai", done: physicalReady, active: isCashPaid && !physicalReady },
        { key: "handover_waiting", label: "Menunggu Serah Terima", desc: "Fisik & Finansial selesai divalidasi", done: isHandoverWaiting || isHandoverComplete, active: isHandoverWaiting },
        { key: "bast_developer", label: "BAST Developer ke Konsumen", desc: "Penandatanganan berita acara serah terima", done: isHandoverComplete, active: isHandoverWaiting },
        { key: "handover_done", label: "Serah Terima Selesai", desc: "Kunci fisik unit diserahkan", done: isHandoverComplete, active: isHandoverComplete },
      ];
      return overrideIfHandoverComplete(steps);
    }

    // ----------------------------------------------------
    // CASH BERTAHAP / INSTALLMENT SCHEME
    // ----------------------------------------------------
    if (paymentScheme === "installment" || paymentScheme === "cash_bertahap") {
      const allInvoicesPaid = bookingInvoices.length > 0 && bookingInvoices.every((invoice) => invoice.status === "paid");

      if (isReadyStockUnit) {
        const steps = [
          { key: "available", label: "Tersedia Siap Huni", desc: "Unit siap huni siap dipasarkan", done: true, active: false },
          { key: "booking_fee", label: "Booking Fee", desc: "Pembayaran booking fee awal", done: bfPaid, active: !bfPaid },
          { key: "dp_payment", label: "DP / Termin Awal", desc: "Pembayaran uang muka / termin ke-1", done: dpPaid, active: bfPaid && !dpPaid },
          { key: "installment_payment", label: "Pembayaran Termin Berjalan", desc: "Pelunasan cicilan termin berjalan", done: allInvoicesPaid, active: dpPaid && !allInvoicesPaid },
          { key: "all_paid", label: "Seluruh Invoice Lunas", desc: "Semua invoice termin lunas", done: allInvoicesPaid, active: dpPaid && !allInvoicesPaid },
          { key: "akad_ppjb", label: "Akad / PPJB", desc: "Penandatanganan Akad / PPJB", done: allInvoicesPaid, active: allInvoicesPaid && !isHandoverWaiting && !isHandoverComplete },
          { key: "handover_waiting", label: "Menunggu Serah Terima", desc: "Fisik & Finansial selesai divalidasi", done: isHandoverWaiting || isHandoverComplete, active: isHandoverWaiting },
          { key: "bast_developer", label: "BAST Developer ke Konsumen", desc: "Penandatanganan berita acara serah terima", done: isHandoverComplete, active: isHandoverWaiting },
          { key: "handover_done", label: "Serah Terima Selesai", desc: "Kunci fisik unit diserahkan", done: isHandoverComplete, active: isHandoverComplete },
        ];
        return overrideIfHandoverComplete(steps);
      }

      if (unitStockType === "building_for_ready_stock") {
        const steps = [
          { key: "available", label: "Sedang Dibangun untuk Ready Stock", desc: "Unit sedang dalam konstruksi internal", done: true, active: false },
          { key: "booking_fee", label: "Booking Fee", desc: "Pembayaran booking fee awal", done: bfPaid, active: !bfPaid },
          { key: "dp_payment", label: "DP / Termin Awal", desc: "Pembayaran uang muka / termin ke-1", done: dpPaid, active: bfPaid && !dpPaid },
          { key: "installment_payment", label: "Pembayaran Termin Berjalan", desc: "Pelunasan cicilan termin berjalan", done: allInvoicesPaid, active: dpPaid && !allInvoicesPaid },
          { key: "all_paid", label: "Seluruh Invoice Lunas", desc: "Semua invoice termin lunas", done: allInvoicesPaid, active: dpPaid && !allInvoicesPaid },
          { key: "akad_ppjb", label: "Akad / PPJB", desc: "Penandatanganan Akad / PPJB", done: allInvoicesPaid, active: allInvoicesPaid && !physicalReady },
          { key: "physical_waiting", label: "Menunggu Fisik Selesai", desc: "Progress 100% & BAST Vendor approved", done: physicalReady, active: allInvoicesPaid && !physicalReady },
          { key: "handover_waiting", label: "Menunggu Serah Terima", desc: "Fisik & Finansial selesai divalidasi", done: isHandoverWaiting || isHandoverComplete, active: isHandoverWaiting },
          { key: "bast_developer", label: "BAST Developer ke Konsumen", desc: "Penandatanganan berita acara serah terima", done: isHandoverComplete, active: isHandoverWaiting },
          { key: "handover_done", label: "Serah Terima Selesai", desc: "Kunci fisik unit diserahkan", done: isHandoverComplete, active: isHandoverComplete },
        ];
        return overrideIfHandoverComplete(steps);
      }

      // Default / Tersedia non-ready stock / Kavling
      const steps = [
        { key: "available", label: "Tersedia", desc: "Unit siap dipasarkan", done: true, active: false },
        { key: "booking_fee", label: "Booking Fee", desc: "Pembayaran booking fee awal", done: bfPaid, active: !bfPaid },
        { key: "booking_pemberkasan", label: "Booking & Pemberkasan", desc: "Verifikasi kas & berkas konsumen", done: bfPaid, active: bfPaid && !dpPaid },
        { key: "dp_payment", label: "DP / Termin Awal", desc: "Pembayaran uang muka / termin ke-1", done: dpPaid, active: bfPaid && !dpPaid },
        { key: "installment_payment", label: "Pembayaran Termin Berjalan", desc: "Pelunasan cicilan termin berjalan", done: allInvoicesPaid, active: dpPaid && !allInvoicesPaid },
        { key: "all_paid", label: "Seluruh Invoice Lunas", desc: "Semua invoice termin lunas", done: allInvoicesPaid, active: dpPaid && !allInvoicesPaid },
        { key: "akad_ppjb", label: "Akad / PPJB", desc: "Penandatanganan Akad / PPJB", done: allInvoicesPaid, active: allInvoicesPaid && !physicalReady },
        { key: "physical_waiting", label: "Cek Fisik Unit", desc: "Menunggu pembangunan fisik selesai", done: physicalReady, active: allInvoicesPaid && !physicalReady },
        { key: "handover_waiting", label: "Menunggu Serah Terima", desc: "Fisik & Finansial selesai divalidasi", done: isHandoverWaiting || isHandoverComplete, active: isHandoverWaiting },
        { key: "bast_developer", label: "BAST Developer ke Konsumen", desc: "Penandatanganan berita acara serah terima", done: isHandoverComplete, active: isHandoverWaiting },
        { key: "handover_done", label: "Serah Terima Selesai", desc: "Kunci fisik unit diserahkan", done: isHandoverComplete, active: isHandoverComplete },
      ];
      return overrideIfHandoverComplete(steps);
    }

    // ----------------------------------------------------
    // KPR SCHEME
    // ----------------------------------------------------
    const kprStatus = kprProcess?.status || "bi_checking";
    const kprRealized = kprStatus === "realisasi" || kprProcess?.status === "completed";
    const kprAkad = kprStatus === "akad" || kprRealized;
    const kprApproved = kprStatus === "approved" || kprStatus === "offering" || kprAkad;
    const kprProsesBank = kprStatus === "proses_bank" || kprApproved;

    if (isReadyStockUnit) {
      const kprBiChecking3 = kprStatus === "bi_checking";
      const kprPemberkasan3 = kprStatus === "pemberkasan" || kprProsesBank;

      const steps = [
        { key: "available",        label: "Tersedia Siap Huni",      desc: "Unit siap huni siap dipasarkan",                    done: true,                                    active: false },
        { key: "booking_fee",      label: "Booking Fee",                 desc: "Pembayaran booking fee awal",                        done: bfPaid,                                  active: !bfPaid },
        { key: "bi_checking",      label: "BI Checking",                 desc: "Pemeriksaan BI/SLIK konsumen",                       done: kprPemberkasan3,                         active: bfPaid && kprBiChecking3 },
        { key: "pemberkasan",      label: "Pemberkasan",                 desc: "Upload & verifikasi dokumen KPR (KTP/NPWP/Slip/KK)", done: kprProsesBank,                           active: bfPaid && kprStatus === "pemberkasan" },
        { key: "proses_bank",      label: "Proses Bank",                 desc: "Analisis KPR oleh bank",                             done: kprApproved,                             active: dpPaid && kprStatus === "proses_bank" },
        { key: "offering",         label: "Offering Letter",             desc: "Bank menerbitkan penawaran SP3K",                    done: kprApproved,                             active: kprStatus === "offering" },
        { key: "approved",         label: "Approval / SP3K",             desc: "Surat Penegasan Persetujuan KPR",                    done: kprAkad,                                 active: kprStatus === "approved" },
        { key: "akad",             label: "Akad Kredit",                 desc: "Tanda tangan akad kredit konsumen",                  done: kprRealized,                             active: kprStatus === "akad" },
        { key: "realisasi",        label: "Realisasi Dana Bank",         desc: "Pencairan dana KPR ke developer",                    done: kprRealized,                             active: kprStatus === "realisasi" },
        { key: "handover_waiting", label: "Menunggu Serah Terima",       desc: "Fisik & Finansial selesai divalidasi",               done: isHandoverWaiting || isHandoverComplete, active: isHandoverWaiting },
        { key: "bast_developer",   label: "BAST Developer ke Konsumen",  desc: "Penandatanganan berita acara serah terima",           done: isHandoverComplete,                      active: isHandoverWaiting },
        { key: "handover_done",    label: "Serah Terima Selesai",        desc: "Kunci fisik unit diserahkan",                        done: isHandoverComplete,                      active: isHandoverComplete },
      ];
      return overrideIfHandoverComplete(steps);
    }

    if (unitStockType === "building_for_ready_stock") {
      const kprBiChecking2 = kprStatus === "bi_checking";
      const kprPemberkasan2 = kprStatus === "pemberkasan" || kprProsesBank;

      const steps = [
        { key: "available",        label: "Sedang Dibangun untuk Ready Stock", desc: "Unit sedang dalam konstruksi internal",              done: true,                                    active: false },
        { key: "booking_fee",      label: "Booking Fee",                       desc: "Pembayaran booking fee awal",                        done: bfPaid,                                  active: !bfPaid },
        { key: "bi_checking",      label: "BI Checking",                       desc: "Pemeriksaan BI/SLIK konsumen",                       done: kprPemberkasan2,                         active: bfPaid && kprBiChecking2 },
        { key: "pemberkasan",      label: "Pemberkasan",                       desc: "Upload & verifikasi dokumen KPR (KTP/NPWP/Slip/KK)", done: kprProsesBank,                           active: bfPaid && kprStatus === "pemberkasan" },
        { key: "proses_bank",      label: "Proses Bank",                       desc: "Analisis KPR oleh bank",                             done: kprApproved,                             active: dpPaid && kprStatus === "proses_bank" },
        { key: "offering",         label: "Offering Letter",                   desc: "Bank menerbitkan penawaran SP3K",                    done: kprApproved,                             active: kprStatus === "offering" },
        { key: "approved",         label: "Approval / SP3K",                   desc: "Surat Penegasan Persetujuan KPR",                    done: kprAkad,                                 active: kprStatus === "approved" },
        { key: "akad",             label: "Akad Kredit",                       desc: "Tanda tangan akad kredit konsumen",                  done: kprRealized,                             active: kprStatus === "akad" },
        { key: "realisasi",        label: "Realisasi Dana Bank",               desc: "Pencairan dana KPR ke developer",                    done: kprRealized && physicalReady,            active: kprStatus === "realisasi" && !physicalReady },
        { key: "physical_waiting", label: "Menunggu Fisik Selesai",            desc: "Progress 100% & BAST Vendor approved",               done: physicalReady,                           active: kprRealized && !physicalReady },
        { key: "handover_waiting", label: "Menunggu Serah Terima",             desc: "Fisik & Finansial selesai divalidasi",               done: isHandoverWaiting || isHandoverComplete, active: isHandoverWaiting },
        { key: "bast_developer",   label: "BAST Developer ke Konsumen",        desc: "Penandatanganan berita acara serah terima",           done: isHandoverComplete,                      active: isHandoverWaiting },
        { key: "handover_done",    label: "Serah Terima Selesai",              desc: "Kunci fisik unit diserahkan",                        done: isHandoverComplete,                      active: isHandoverComplete },
      ];
      return overrideIfHandoverComplete(steps);
    }

    // Default / Tersedia non-ready stock / Kavling
    const kprBiChecking = kprStatus === "bi_checking";
    const kprPemberkasan = kprStatus === "pemberkasan" || kprProsesBank;
    const docComplete = kprProcess?.documentStatus === "complete";

    const steps = [
      { key: "available",        label: "Tersedia",                      desc: "Unit siap dipasarkan",                                done: true,                                    active: false },
      { key: "booking_fee",      label: "Booking Fee",                   desc: "Pembayaran booking fee awal",                         done: bfPaid,                                  active: !bfPaid },
      { key: "bi_checking",      label: "BI Checking",                   desc: "Pemeriksaan BI/SLIK konsumen",                        done: kprPemberkasan,                          active: bfPaid && kprBiChecking },
      { key: "pemberkasan",      label: "Pemberkasan",                   desc: "Upload & verifikasi dokumen KPR (KTP/NPWP/Slip/KK)",  done: kprProsesBank,                           active: bfPaid && kprStatus === "pemberkasan" },
      { key: "proses_bank",      label: "Proses Bank",                   desc: "Analisis KPR oleh bank",                              done: kprApproved,                             active: dpPaid && kprStatus === "proses_bank" },
      { key: "offering",         label: "Offering Letter",               desc: "Bank menerbitkan penawaran SP3K",                     done: kprApproved,                             active: kprStatus === "offering" },
      { key: "approved",         label: "Approval / SP3K",               desc: "Surat Penegasan Persetujuan KPR",                     done: kprAkad,                                 active: kprStatus === "approved" },
      { key: "akad",             label: "Akad Kredit",                   desc: "Tanda tangan akad kredit konsumen",                   done: kprRealized,                             active: kprStatus === "akad" },
      { key: "realisasi",        label: "Realisasi Dana Bank",           desc: "Pencairan dana KPR ke developer",                     done: kprRealized && physicalReady,            active: kprStatus === "realisasi" && !physicalReady },
      { key: "physical_waiting", label: "Cek Fisik Unit",                desc: "Menunggu pembangunan fisik selesai",                   done: physicalReady,                           active: kprRealized && !physicalReady },
      { key: "handover_waiting", label: "Menunggu Serah Terima",         desc: "Fisik & Finansial selesai divalidasi",                done: isHandoverWaiting || isHandoverComplete, active: isHandoverWaiting },
      { key: "bast_developer",   label: "BAST Developer ke Konsumen",    desc: "Penandatanganan berita acara serah terima",            done: isHandoverComplete,                      active: isHandoverWaiting },
      { key: "handover_done",    label: "Serah Terima Selesai",          desc: "Kunci fisik unit diserahkan",                         done: isHandoverComplete,                      active: isHandoverComplete },
    ];
    return overrideIfHandoverComplete(steps);
  };

  return (
    <div className="siteplan-container relative w-full overflow-hidden rounded-3xl border border-[#D6DED2] bg-white shadow-sage-lg h-[74vh]">
      
      {/* Floating Toolbar (Search & Legend Helper) */}
      <div className="absolute top-4 left-4 z-10 flex flex-col sm:flex-row gap-2.5 max-w-[calc(100%-2rem)] pointer-events-none">
        
        {/* Floating Search Bar */}
        <div className="pointer-events-auto w-64 shadow-sage bg-white/95 backdrop-blur-md rounded-2xl border border-[#D6DED2] p-1.5 flex items-center gap-2 transition-all hover:shadow-sage-lg focus-within:border-[#8FAF9A] focus-within:ring-2 focus-within:ring-[#8FAF9A]/20">
          <span className="text-[#4F6F52] pl-1.5 flex-shrink-0">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder={t("siteplan_viewer.search_placeholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-0 outline-none text-xs font-bold placeholder:text-[#66736A]/60 text-[#243028]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-[#66736A] hover:text-[#243028] p-1 rounded-full hover:bg-[#DDE8D8]/50 flex-shrink-0 flex items-center justify-center transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Small Compass Info */}
        <div className="hidden sm:flex items-center gap-2 bg-[#4F6F52]/10 backdrop-blur-md border border-[#4F6F52]/20 px-3.5 py-1.5 rounded-2xl shadow-sage text-[10px] font-bold text-[#4F6F52]">
          <Compass className="h-3.5 w-3.5 text-[#4F6F52] animate-pulse" />
          <span>{t("siteplan_viewer.nav_hint")}</span>
        </div>
      </div>

      {/* Floating Zoom & Pan Controls (Upgraded Pill Dock) */}
      <div className="absolute bottom-16 right-4 z-10 flex flex-row items-center gap-1.5 shadow-[0_8px_30px_rgba(79,111,82,0.12)] bg-white/95 backdrop-blur-md rounded-2xl border border-[#D6DED2] p-1.5 pointer-events-auto transition-all hover:shadow-sage-lg">
        <button
          type="button"
          onClick={() => setScale((prev) => Math.min(prev + 0.25, 4.0))}
          className="h-8 w-8 hover:bg-[#4F6F52] hover:text-white text-[#4F6F52] rounded-xl transition-all flex items-center justify-center border border-transparent bg-white/50 active:scale-90 shadow-sm"
          title={t("siteplan_viewer.zoom_in")}
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setScale((prev) => Math.max(prev - 0.25, 0.5))}
          className="h-8 w-8 hover:bg-[#4F6F52] hover:text-white text-[#4F6F52] rounded-xl transition-all flex items-center justify-center border border-transparent bg-white/50 active:scale-90 shadow-sm"
          title={t("siteplan_viewer.zoom_out")}
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <div className="h-5 w-[1px] bg-[#D6DED2] mx-1" />
        <button
          type="button"
          onClick={resetView}
          className="h-8 px-3 hover:bg-[#4F6F52] hover:text-white text-[#4F6F52] rounded-xl transition-all flex items-center gap-1.5 border border-transparent bg-white/50 active:scale-90 shadow-sm"
          title={t("siteplan_viewer.reset_view")}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span className="text-[10px] uppercase font-black tracking-wider">{t("action.reset")}</span>
        </button>
      </div>

      {/* Main SVG Canvas */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height="100%"
        className={`bg-[#F7F8F3]/50 transition-shadow ${
          isDragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMoveSVG}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeaveSVG}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
      >
        {/* Glow Filters for Premium SVG Highlights */}
        <defs>
          {/* Engineering blueprint graph grid pattern */}
          <pattern id="archGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#D6DED2" strokeWidth="0.5" opacity="0.5" />
            <path d="M 10 0 L 10 40 M 20 0 L 20 40 M 30 0 L 30 40 M 0 10 L 40 10 M 0 20 L 40 20 M 0 30 L 40 30" fill="none" stroke="#D6DED2" strokeWidth="0.25" opacity="0.2" />
          </pattern>
          
          <filter id="glow-highlight" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComponentTransfer in="blur" result="glow">
              <feFuncA type="linear" slope="0.75" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          
          <filter id="glow-selected" x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="5.5" result="blur" />
            <feComponentTransfer in="blur" result="glow">
              <feFuncA type="linear" slope="0.9" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Drop-shadow filter for polygon hover using sage green color */}
          <filter id="drop-shadow-sage" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="rgba(79, 111, 82, 0.25)" floodOpacity="1" />
          </filter>
        </defs>

        {/* Dynamic Zoom-Pan Transform Wrapper */}
        <g transform={`translate(${translateX}, ${translateY}) scale(${scale})`}>
          
          {/* Plain white background behind the image */}
          <rect width={width} height={height} fill="#ffffff" />
          
          {/* Siteplan Background Blueprint Image */}
          {imageUrl && (
            <image
              href={imageUrl}
              x={0}
              y={0}
              width={width}
              height={height}
              preserveAspectRatio="xMidYMid meet"
            />
          )}

          {/* Siteplan Shapes Loop */}
          {filteredShapes.map((shape) => {
            const color = shape.colorOverride
              ? { fill: shape.colorOverride, stroke: "#555", text: "#555" }
              : getStatusColor(shape.unit?.status, shape.unit?.isReadyStock);

            const centroid = shape.coordinates.reduce(
              (acc, c) => ({
                x: acc.x + c.x / shape.coordinates.length,
                y: acc.y + c.y / shape.coordinates.length,
              }),
              { x: 0, y: 0 }
            );

            const isSelected = shape.id === selectedShape?.id;
            const isHovered = shape.id === hoveredShape?.id;
            const isOverdue = shape.unit?.status === "overdue";
            const isSearching = searchQuery !== "";
            const isMatching = shape.isMatching;
            const isHighlighted = isSearching && isMatching;
            const isDimmed = isSearching && !isMatching;

            return (
              <g
                key={shape.id}
                onClick={(e) => {
                  // Only click if it wasn't a pan drag
                  if (hasDragged) {
                    e.stopPropagation();
                    return;
                  }
                  setSelectedShape(isSelected ? null : shape);
                }}
                onMouseEnter={() => !isDragging && setHoveredShape(shape)}
                onMouseLeave={() => setHoveredShape(null)}
                className="group transition-all"
              >
                {/* SVG Polygon Unit Shape */}
                <polygon
                  points={coordsToPolygonPoints(shape.coordinates)}
                  fill={color.fill}
                  fillOpacity={isDimmed ? 0.1 : isSelected ? 0.95 : isHovered ? 1.0 : 0.7}
                  stroke={
                    isSelected
                      ? "#FF6B00"
                      : isHovered
                      ? color.stroke
                      : isHighlighted
                      ? "#4F6F52"
                      : isOverdue
                      ? "#8B3443"
                      : color.stroke
                  }
                  strokeWidth={
                    isSelected ? 3.5 : isHovered ? 2.5 : isHighlighted ? 4.5 : isOverdue ? 2.5 : 1.5
                  }
                  filter={
                    isSelected
                      ? "url(#glow-selected)"
                      : isHovered
                      ? "url(#drop-shadow-sage)"
                      : isHighlighted
                      ? "url(#glow-highlight)"
                      : undefined
                  }
                  className="transition-[opacity,filter] duration-200 ease-in-out"
                />

                {/* Overdue Warning Symbol */}
                {isOverdue && !isDimmed && (
                  <text
                    x={centroid.x}
                    y={centroid.y - 11}
                    textAnchor="middle"
                    fontSize={11}
                    fill="#8B3443"
                    className="font-black animate-bounce select-none pointer-events-none"
                  >
                    ⚠️
                  </text>
                )}

                {/* Center Unit Code Text */}
                <text
                  x={centroid.x}
                  y={isOverdue ? centroid.y + 3 : centroid.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={10}
                  fill={color.text || color.stroke}
                  fontFamily="var(--font-mono), monospace"
                  fontWeight="700"
                  style={{ pointerEvents: "none", userSelect: "none" }}
                  className={`transition-opacity ${isDimmed ? "opacity-20" : "opacity-100"}`}
                >
                  {shape.label ?? shape.unit?.code ?? ""}
                </text>

                {/* Mini Construction Progress Badge Rendered directly underneath code */}
                {shape.unit &&
                  (shape.unit.status === "construction" ||
                    shape.unit.status === "overdue" ||
                    shape.unit.status === "construction_done") &&
                  !isDimmed && (
                    <g
                      transform={`translate(${centroid.x}, ${centroid.y + 12})`}
                      className="pointer-events-none select-none"
                    >
                      <rect
                        x={-14}
                        y={-5}
                        width={28}
                        height={10}
                        rx={3}
                        fill={shape.unit.status === "overdue" ? "#F8D4DA" : "#E9DDF7"}
                        stroke={shape.unit.status === "overdue" ? "#8B3443" : "#5D4382"}
                        strokeWidth={0.5}
                      />
                      <text
                        x={0}
                        y={2}
                        textAnchor="middle"
                        fontSize={7}
                        fontFamily="var(--font-mono), monospace"
                        fontWeight="850"
                        fill={shape.unit.status === "overdue" ? "#8B3443" : "#5D4382"}
                      >
                        {shape.unit.constructionProgress}%
                      </text>
                    </g>
                  )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Floating Hover Tooltip */}
      {hoveredShape && !selectedShape && !isDragging && (
        <div
          className="pointer-events-none absolute z-20 rounded-2xl border border-[#D6DED2] bg-white/95 backdrop-blur-md px-3.5 py-2.5 shadow-sage-lg text-xs transition-opacity duration-200"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          {hoveredShape.unit ? (
            <div className="space-y-1.5 min-w-[140px]">
              <div className="flex justify-between items-center border-b border-[#D6DED2]/40 pb-1.5">
                <span className="font-extrabold font-mono text-[#243028] text-[13px]">
                  {t("siteplan_viewer.lot")} {hoveredShape.unit.code}
                </span>
                <span className="text-[9px] text-[#66736A] font-black uppercase">
                  {hoveredShape.unit.cluster || "—"}
                </span>
              </div>
              <p className="text-[10px] text-[#66736A] font-bold leading-none">
                {t("siteplan_viewer.type")} {hoveredShape.unit.typeName || "—"}
              </p>
              <div className="pt-1">
                <span
                  className="inline-flex items-center rounded-lg px-2 py-0.5 text-[9px] font-black border"
                  style={{
                    backgroundColor: getStatusColor(hoveredShape.unit.status, hoveredShape.unit?.isReadyStock).fill,
                    color: getStatusColor(hoveredShape.unit.status, hoveredShape.unit?.isReadyStock).text || getStatusColor(hoveredShape.unit.status, hoveredShape.unit?.isReadyStock).stroke,
                    borderColor: getStatusColor(hoveredShape.unit.status, hoveredShape.unit?.isReadyStock).stroke + "30",
                  }}
                >
                  {getUnitStatusLabel(hoveredShape.unit.status, hoveredShape.unit?.isReadyStock)}
                </span>
              </div>
            </div>
          ) : (
            <p className="font-black text-[#66736A]">
              {hoveredShape.label ?? t("siteplan_viewer.no_unit")}
            </p>
          )}
        </div>
      )}

      {/* Bottom Horizontal Map Legends Grid */}
      <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-[#D6DED2] px-4 py-2.5 overflow-x-auto flex items-center gap-4 shadow-sage scrollbar-none">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#66736A] border-r border-[#D6DED2]/60 pr-4 shrink-0">
          {t("siteplan_viewer.lot_status")}
        </span>
        <div className="flex gap-x-4 gap-y-1 items-center flex-nowrap md:flex-wrap">
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1.5 text-[10px] shrink-0">
              <div
                className="h-3 w-4.5 rounded-md border shadow-sm"
                style={{ backgroundColor: color.fill, borderColor: color.stroke }}
              />
              <span className="font-bold text-[#66736A]">{color.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ðŸš€ UPGRADED PREMIUM DRAWER SHEET FOR UNIT DETAILS */}
      <Sheet open={!!selectedShape} onOpenChange={(o) => !o && setSelectedShape(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto bg-[#F7F8F3] border-l border-[#D6DED2] p-0 shadow-sage-lg rounded-l-[2rem] flex flex-col h-full scrollbar-thin scrollbar-thumb-sage/40">
          
          {/* Header Panel */}
          <div className="p-6 pb-5 bg-white border-b border-[#D6DED2] sticky top-0 z-20 shadow-sm rounded-tl-[2rem]">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-[#8FAF9A] uppercase tracking-widest flex items-center gap-1">
                  <Activity className="h-3.5 w-3.5 animate-pulse" /> {t("siteplan_viewer.monitor")}
                </span>
                <SheetTitle className="font-mono text-xl font-extrabold text-[#243028] tracking-tight flex flex-wrap items-center gap-2">
                  <span className="whitespace-nowrap">{t("siteplan_viewer.lot")} {unit?.code ?? selectedShape?.label ?? t("siteplan_viewer.detail")}</span>
                  {isReadyStock && (
                    <span className="inline-flex items-center gap-1 bg-[#DDE8D8] text-[#4F6F52] text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider font-sans whitespace-nowrap">
                      ðŸ¡ {t("siteplan_viewer.ready_stock")}
                    </span>
                  )}
                </SheetTitle>
              </div>
              <div className="flex flex-col gap-1.5 items-end">
                {unit?.cluster && (
                  <Badge className="bg-[#DDE8D8] text-[#4F6F52] hover:bg-[#DDE8D8] border border-[#8FAF9A]/30 text-[10px] font-extrabold font-mono rounded-lg px-2.5 py-1 shadow-sm">
                    {t("siteplan_viewer.cluster")} {unit.cluster}
                  </Badge>
                )}
                <span className="text-[9px] font-bold text-[#66736A]/50 font-mono">
                  {t("siteplan_viewer.id_prefix")} #{selectedShape?.id.substring(0, 8).toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5 flex-1">
            {unit ? (
              <>
                {/* 1. Status Accent Panel with Modern Layout */}
                <div className="bg-white rounded-[2rem] p-4.5 border border-[#D6DED2] shadow-sage flex items-center justify-between transition-all hover:shadow-sage-lg">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider block">
                      {t("siteplan_viewer.lot_status")}
                    </span>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black border shadow-sm"
                      style={{
                        backgroundColor: statusColor.fill,
                        color: statusColor.text || statusColor.stroke,
                        borderColor: statusColor.stroke + "30",
                      }}
                    >
                      {unit.status === "overdue" && (
                        <AlertTriangle className="h-3.5 w-3.5 animate-pulse text-[#8B3443]" />
                      )}
                      {unit.status === "available" && <Sparkles className="h-3.5 w-3.5 animate-pulse" />}
                      {unit.status === "booking" && <Clock className="h-3.5 w-3.5 animate-pulse" />}
                      {unit.status === "construction" && <Hammer className="h-3.5 w-3.5 animate-pulse" />}
                      {unit.status === "sold" && <CheckCircle2 className="h-3.5 w-3.5" />}
                      {displayStatusLabel}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider block whitespace-nowrap">
                      {t("siteplan_viewer.price_erp")}
                    </span>
                    <span className="font-sans font-extrabold text-sm md:text-base text-[#4F6F52] tracking-tight block">
                      Rp {unit.price.toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>

                {/* KPR Pipeline Status Card (Only if active booking and payment scheme is KPR) */}
                {(() => {
                  if (!activeBooking) return null;
                  const isKpr = activeBooking.paymentScheme === "kpr" || unit.status === "kpr_process";
                  const kprProcess = kprProcesses?.find(k => k.bookingId === activeBooking.id);
                  
                  if (!isKpr) return null;

                  const kprStatusLabels: Record<string, { label: string; className: string }> = {
                    bi_checking: { label: "BI Checking", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
                    pemberkasan: { label: "Pemberkasan", className: "bg-amber-50 text-amber-700 border-amber-200" },
                    proses_bank: { label: "Proses Bank", className: "bg-blue-50 text-blue-700 border-blue-200" },
                    offering:    { label: "Offering Letter", className: "bg-purple-50 text-purple-700 border-purple-200" },
                    approved:    { label: "Approved KPR", className: "bg-teal-50 text-teal-700 border-teal-200" },
                    rejected:    { label: "Rejected KPR", className: "bg-rose-50 text-rose-700 border-rose-200" },
                    akad:        { label: "Akad Kredit", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                    realisasi:   { label: "Realisasi Dana", className: "bg-emerald-100 text-emerald-800 border-emerald-300" },
                  };

                  const currentKprStatus = kprProcess?.status || "bi_checking";
                  const badgeInfo = kprStatusLabels[currentKprStatus] || { label: "BI Checking", className: "bg-indigo-50 text-indigo-700 border-indigo-200" };

                  return (
                    <div className="bg-white rounded-[2rem] p-4.5 border border-[#D6DED2] shadow-sage flex items-center justify-between transition-all hover:shadow-sage-lg mt-3 text-left">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider block">
                          Tahapan Progres KPR
                        </span>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black border shadow-sm ${badgeInfo.className}`}>
                          <Layers className="h-3.5 w-3.5" />
                          {badgeInfo.label}
                        </span>
                      </div>
                      
                      {kprProcess?.documentStatus && (
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider block">
                            Kelengkapan Dokumen
                          </span>
                          <span className={`inline-block font-mono font-black text-[10px] px-2.5 py-0.5 rounded border mt-1 ${
                            kprProcess.documentStatus === "complete" 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}>
                            {kprProcess.documentStatus === "complete" ? "LENGKAP" : "BELUM LENGKAP"}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* BAST Developer ke Konsumen Card */}
                {(() => {
                  if (!activeBooking) return null;

                  const isHandoverDone = unit.status === "handover_complete";
                  const kprProcess = kprProcesses?.find(k => k.bookingId === activeBooking.id);
                  const eligibility = getHandoverEligibility(unit, activeBooking, invoices, kprProcess, selectedSpkBast);

                  const schemeReason =
                    activeBooking.paymentScheme === "kpr" ? "KPR — Realisasi Dana" :
                    activeBooking.paymentScheme === "cash" ? "Cash — Invoice Lunas" :
                    activeBooking.paymentScheme === "installment" ? "Installment — Invoice Lunas" :
                    "—";

                  if (unit.status !== "menunggu_serah_terima" && !isHandoverDone) {
                    return null;
                  }

                  const activeCustomer = customers?.find(c => c.id === activeBooking.customerId);

                  return (
                    <div className="rounded-[2rem] border p-5 mt-3 bg-white border-[#D6DED2] shadow-sage space-y-4 transition-all hover:shadow-sage-lg text-left">
                      <h4 className="text-xs font-black text-[#243028] uppercase tracking-wider flex items-center gap-2 border-b border-[#D6DED2]/40 pb-3">
                        <CheckCircle2 className="h-4 w-4 text-[#4F6F52]" />
                        BAST Developer ke Konsumen
                      </h4>
                      <div className="space-y-3">
                        <div className="flex items-start gap-2">
                          <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                            isHandoverDone ? "bg-teal-100 text-teal-600" : "bg-violet-100 text-violet-600"
                          }`}>
                            <CheckCircle2 className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0 text-xs">
                            <p className={`font-black uppercase tracking-wide ${
                              isHandoverDone ? "text-teal-700" : "text-violet-700"
                            }`}>
                              {isHandoverDone ? "Serah Terima Selesai" : "Menunggu Serah Terima"}
                            </p>
                            {activeCustomer && (
                              <p className="font-semibold text-slate-700 mt-1">
                                Konsumen: {activeCustomer.name}
                              </p>
                            )}
                            <p className={`font-bold mt-0.5 uppercase tracking-wider ${
                              isHandoverDone ? "text-teal-500" : "text-violet-500"
                            }`}>
                              {schemeReason}
                            </p>
                            <p className="mt-1 leading-relaxed text-[#66736A]">
                              {isHandoverDone
                                ? "BAST Konsumen telah disetujui. Unit telah resmi diserahterimakan."
                                : "Syarat finansial dan fisik sudah terpenuhi. Jadwalkan serah terima fisik unit."}
                            </p>
                          </div>
                        </div>

                        {/* BAST Button Actions */}
                        {eligibility.eligible ? (
                          <a
                            href={`/marketing/bookings/${activeBooking.id}/bast/print`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full bg-[#4F6F52] hover:bg-[#3D563F] text-white font-extrabold text-xs rounded-xl py-3 flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-[0.98]"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Cetak BAST Konsumen
                          </a>
                        ) : isHandoverDone ? (
                          <a
                            href={`/marketing/bookings/${activeBooking.id}/bast/print`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full bg-[#DDE8D8] text-[#4F6F52] border border-[#8FAF9A]/30 font-extrabold text-xs rounded-xl py-3 flex items-center justify-center gap-1.5 transition-all shadow-sm hover:bg-[#c9dcc2]"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Lihat Dokumen BAST (Selesai)
                          </a>
                        ) : (
                          <div className="space-y-2">
                            <Button
                              disabled
                              className="w-full bg-slate-100 border border-slate-200 text-slate-400 font-extrabold text-xs rounded-xl py-3 flex items-center justify-center gap-1.5 cursor-not-allowed shadow-none"
                            >
                              <Lock className="h-4 w-4" />
                              Cetak BAST Konsumen
                            </Button>
                            <p className="text-[10px] text-rose-600 font-bold bg-rose-50 border border-rose-100 rounded-xl p-2 text-center leading-normal">
                              ⚠️ {eligibility.reason}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {unit.status !== "belum_siap" && (
                  <>
                    {/* Booking Unit Action Card */}
                    {!activeBooking && unit.status === "available" && canBook && projects && units && customers && marketings && currentUser && (
                      <div className="bg-white rounded-[2rem] p-4.5 border border-[#D6DED2] shadow-sage flex flex-col gap-3 transition-all hover:shadow-sage-lg text-left mt-5">
                        <p className="text-xs font-medium text-[#66736A] leading-relaxed" dangerouslySetInnerHTML={{ __html: t("siteplan_viewer.booking_desc").replace(/<1>/g, '<span class="text-[#4F6F52] font-black">').replace(/<\/1>/g, '</span>') }} />
                        <AddBookingDialog
                          key={unit.id}
                          projects={projects}
                          units={units}
                          customers={customers}
                          leads={leads}
                          marketings={marketings}
                          currentUser={currentUser}
                          initialProjectId={projects?.[0]?.id || ""}
                          initialUnitId={unit.id}
                          onSuccess={() => {
                            router.refresh();
                            router.refresh();
                          }}
                          triggerButton={
                            <Button className="w-full bg-[#4F6F52] hover:bg-[#3D563F] text-white font-extrabold rounded-2xl py-3 flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(79,111,82,0.25)] hover:scale-[1.01] active:scale-[0.99] transition-all">
                              <Sparkles className="h-4 w-4 text-white animate-pulse" />
                              {t("siteplan_viewer.booking_btn")}
                            </Button>
                          }
                        />
                      </div>
                    )}

                    {/* Mulai Pembangunan Fisik Action Card */}
                    {activeBooking && !unit.isReadyStock && (unit.status === "booking" || unit.status === "kpr_process") && (() => {
                      const kprProcess = kprProcesses?.find(k => k.bookingId === activeBooking.id);
                      const bfInvoice = invoices?.find(i => i.bookingId === activeBooking.id && i.type === "booking_fee");
                      const dpInvoice = invoices?.find(i => i.bookingId === activeBooking.id && i.type === "dp");

                      const bfPaid = bfInvoice?.status === "paid";
                      const dpPaid = dpInvoice?.status === "paid";
                      const kprApproved = activeBooking.paymentScheme !== "kpr" || (kprProcess && (kprProcess.status === "approved" || kprProcess.status === "akad"));

                      if (bfPaid && dpPaid && kprApproved) {
                        const isAuthorized = currentUser?.role != null &&
                          ["Super Admin", "Admin Kantor", "Marketing Manager"].includes(currentUser.role);

                        return (
                          <div className="bg-white rounded-[2rem] p-4.5 border border-[#D6DED2] shadow-sage flex flex-col gap-3 transition-all hover:shadow-sage-lg text-left mt-5 animate-fade-in">
                            <p className="text-xs font-medium text-[#66736A] leading-relaxed">
                              Pembayaran Uang Muka (DP) &amp; Booking Fee telah lunas divalidasi oleh Keuangan {activeBooking.paymentScheme === "kpr" ? "serta Analisis KPR disetujui" : ""}. {isAuthorized ? "Anda sekarang dapat memulai pembangunan fisik untuk unit ini." : "Menunggu otorisasi untuk memulai pembangunan fisik."}
                            </p>
                            <Button
                              disabled={isSubmitting || !isAuthorized}
                              onClick={async () => {
                                  if (!isAuthorized) return;
                                  setIsSubmitting(true);
                                  setErrorMessage(null);
                                  try {
                                    const res = await startPhysicalConstructionManual(unit.id);
                                    if (res.success) {
                                      alert(`Unit "${unit.code}" berhasil masuk ke tahap Pembangunan Fisik!`);
                                      router.refresh();
                                    }
                                  } catch (err: unknown) {
                                    setErrorMessage((err instanceof Error ? err.message : null) || "Gagal memulai pembangunan fisik.");
                                    alert((err instanceof Error ? err.message : null) || "Gagal memulai pembangunan fisik.");
                                  } finally {
                                    setIsSubmitting(false);
                                  }
                              }}
                              className={
                                isAuthorized
                                  ? "w-full bg-[#4F6F52] hover:bg-[#3D563F] text-white font-extrabold rounded-2xl py-3 flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(79,111,82,0.25)] hover:scale-[1.01] active:scale-[0.99] transition-all"
                                  : "w-full bg-slate-100 border border-slate-200 text-slate-400 font-extrabold rounded-2xl py-3 flex items-center justify-center gap-2 cursor-not-allowed shadow-none transition-all"
                              }
                            >
                              {isSubmitting ? (
                                "Memproses..."
                              ) : isAuthorized ? (
                                "Mulai Pembangunan Fisik"
                              ) : (
                                <>
                                  <Lock className="h-4 w-4 shrink-0" />
                                  Mulai Pembangunan Fisik
                                </>
                              )}
                            </Button>
                            {!isAuthorized && (
                              <div className="text-[10px] text-amber-800 font-bold flex items-start gap-2 bg-amber-50/70 border border-amber-100/80 rounded-xl px-3 py-2.5 text-left leading-normal">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                                <span>
                                  Hanya <span className="font-black text-amber-950">Super Admin</span>,{" "}
                                  <span className="font-black text-amber-950">Admin Kantor</span>, atau{" "}
                                  <span className="font-black text-amber-950">Marketing Manager</span> yang berwenang memulai pembangunan fisik.
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Selesai Pembangunan Action Card */}
                    {((unit.status === "construction_done") ||
                      ((unit.status === "construction" || unit.status === "overdue") && unit.constructionProgress === 100)) && (() => {
                        const isIndentUnit = !!activeBooking || !!unit?.currentCustomerId;
                        const canVerifyBast = currentUser?.role != null &&
                          ["Super Admin", "Admin Kantor", "Pengawas Lapangan", "Pengawas"].includes(currentUser.role);

                        return (
                          <div className="bg-white rounded-[2rem] p-4.5 border border-[#D6DED2] shadow-sage flex flex-col gap-3 transition-all hover:shadow-sage-lg text-left mt-5 animate-fade-in">
                            <p className="text-xs font-medium text-[#66736A] leading-relaxed">
                              {isIndentUnit ? (
                                <>
                                  Pembangunan unit ini telah rampung 100%. Sebagai Developer, Anda dapat memverifikasi selesainya pembangunan fisik lapangan secara resmi. Karena unit ini telah terikat dengan konsumen, status unit akan tetap terikat dan tidak menjadi <span className="text-[#4F6F52] font-black">Tersedia Siap Huni</span>.
                                </>
                              ) : (
                                <>
                                  Pembangunan unit ini telah rampung 100%. Sebagai Developer, Anda dapat memverifikasi selesainya pembangunan fisik lapangan secara resmi agar status unit kembali menjadi <span className="text-[#4F6F52] font-black">Tersedia Siap Huni</span>.
                                </>
                              )}
                            </p>
                            <Button
                              disabled={isSubmitting || !canVerifyBast}
                              onClick={() => {
                                if (!canVerifyBast) return;
                                handleOpenBastDialog(unit);
                              }}
                              className={
                                canVerifyBast
                                  ? "w-full bg-[#4F6F52] hover:bg-[#3D563F] text-white font-extrabold rounded-2xl py-3 flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(79,111,82,0.25)] hover:scale-[1.01] active:scale-[0.99] transition-all"
                                  : "w-full bg-slate-100 border border-slate-200 text-slate-400 font-extrabold rounded-2xl py-3 flex items-center justify-center gap-2 cursor-not-allowed shadow-none transition-all"
                              }
                            >
                              {isSubmitting ? (
                                <>
                                  <span className="h-3.5 w-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mr-1.5" />
                                  Memproses...
                                </>
                              ) : canVerifyBast ? (
                                <>
                                  <CheckCircle2 className="h-4 w-4 text-white" />
                                  Selesai Pembangunan
                                </>
                              ) : (
                                <>
                                  <Lock className="h-4 w-4 shrink-0" />
                                  Selesai Pembangunan
                                </>
                              )}
                            </Button>
                            {!canVerifyBast && (
                              <div className="text-[10px] text-amber-800 font-bold flex items-start gap-2 bg-amber-50/70 border border-amber-100/80 rounded-xl px-3 py-2.5 text-left leading-normal mt-1 animate-fade-in">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                                <span>
                                  Hanya <span className="font-black text-amber-950">Super Admin</span>,{" "}
                                  <span className="font-black text-amber-950">Admin Kantor</span>, atau{" "}
                                  <span className="font-black text-amber-950">Pengawas Lapangan</span> yang berwenang memverifikasi selesainya pembangunan fisik.
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                    {/* Unbooked Stock Info Card (Only if NO active booking) */}
                    {!activeBooking && (
                      <div className="bg-white rounded-[2rem] p-5 border border-[#D6DED2] shadow-sage space-y-3 transition-all hover:shadow-sage-lg mt-5 text-left animate-fade-in">
                        <h4 className="text-xs font-black text-[#243028] uppercase tracking-wider flex items-center gap-2 border-b border-[#D6DED2]/40 pb-3">
                          <Building2 className="h-4 w-4 text-[#4F6F52]" />
                          Status Stok &amp; Unit
                        </h4>
                        <div className="text-xs font-medium text-[#66736A] leading-relaxed space-y-2">
                          {(() => {
                            const stockType = getUnitStockType(unit);
                            const isReadyStockUnit = [
                              "available_ready_stock",
                              "booking_ready_stock",
                              "kpr_process_ready_stock",
                              "sold_ready_stock",
                              "menunggu_serah_terima_ready_stock",
                              "handover_complete_ready_stock",
                              "construction_done_ready_stock",
                            ].includes(stockType);

                            if (stockType === "available") {
                              return (
                                <p>
                                  Unit tersedia dan siap dipasarkan.<br />
                                  <span className="font-bold text-amber-600">Belum ada booking aktif.</span>
                                </p>
                              );
                            }
                            if (isReadyStockUnit) {
                              return (
                                <p>
                                  Unit siap huni dan belum terjual.<br />
                                  <span className="font-bold text-[#4F6F52]">BAST Konsumen akan aktif setelah ada booking dan syarat pembayaran terpenuhi.</span>
                                </p>
                              );
                            }
                            if (stockType === "building_for_ready_stock") {
                              return (
                                <p>
                                  Unit sedang dibangun untuk stok developer.<br />
                                  <span className="font-bold text-purple-600">Setelah progress 100% dan BAST Vendor ke Developer disetujui, unit akan menjadi Tersedia Siap Huni.</span>
                                </p>
                              );
                            }
                            if (stockType === "construction") {
                              return (
                                <p>
                                  Unit sedang dalam proses pembangunan.<br />
                                  <span className="font-bold text-amber-600">Belum ada booking aktif.</span>
                                </p>
                              );
                            }
                            return (
                              <p>
                                Unit tersedia dan siap dipasarkan.<br />
                                <span className="font-bold text-amber-600">Belum ada booking aktif.</span>
                              </p>
                            );
                          })()}
                          <p className="text-[10px] text-[#8FAF9A] italic border-t border-[#D6DED2]/30 pt-2 font-semibold">
                            Unit belum memiliki booking aktif. Alur penjualan dan akad akan muncul setelah unit dibooking konsumen.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Buyer Info Card (Only if active booking exists) */}
                    {activeBooking && (() => {
                      const realCustomer = customers?.find(c => c.id === activeBooking.customerId)
                        || customers?.find(c => c.id === unit?.currentCustomerId);
                      
                      let buyerName = "";
                      let buyerPhone = "";
                      let buyerScheme = "";
                      let paymentProgress = 25;

                      if (realCustomer) {
                        buyerName = realCustomer.name;
                        buyerPhone = realCustomer.phone || "-";
                        
                        buyerScheme = activeBooking.paymentScheme === "kpr" 
                          ? "KPR" 
                          : activeBooking.paymentScheme === "installment" 
                            ? "Cash Bertahap" 
                            : "Cash Keras";
                        paymentProgress = activeBooking.status === "akad" || activeBooking.status === "completed" ? 100 : 25;
                      } else {
                        // Customer data not found — show placeholder, not fake data
                        buyerName = "Data konsumen tidak tersedia";
                        buyerPhone = "-";
                        buyerScheme = activeBooking.paymentScheme === "kpr" ? "KPR"
                          : activeBooking.paymentScheme === "installment" ? "Cash Bertahap"
                          : "Cash Keras";
                        paymentProgress = 0;
                      }

                      // Adjust buyerScheme display
                      const schemeLabel = 
                        activeBooking.paymentScheme === "kpr" ? "KPR" :
                        activeBooking.paymentScheme === "installment" ? "Cash Bertahap" :
                        activeBooking.paymentScheme === "cash" ? "Cash Keras" :
                        buyerScheme;

                      const buyer = {
                        name: buyerName,
                        phone: buyerPhone,
                        scheme: schemeLabel,
                        paymentProgress: paymentProgress
                      };

                      return (
                        <div className="bg-white rounded-[2rem] p-5 border border-[#D6DED2] shadow-sage space-y-4 transition-all hover:shadow-sage-lg mt-5 text-left">
                          <h4 className="text-xs font-black text-[#243028] uppercase tracking-wider flex items-center gap-2 border-b border-[#D6DED2]/40 pb-3">
                            <User className="h-4 w-4 text-[#4F6F52]" />
                            {t("siteplan_viewer.buyer_info")}
                          </h4>
                          <div className="space-y-4">
                            <div className="flex items-center gap-3 bg-[#F7F8F3]/70 p-3 rounded-2xl border border-[#D6DED2]/50">
                              <div className="h-10 w-10 rounded-full bg-[#8FAF9A]/20 flex items-center justify-center text-[#4F6F52] font-black text-sm font-mono shrink-0 border border-[#8FAF9A]/30">
                                {buyer.name.split(" ").filter(Boolean).map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-extrabold text-[#243028] truncate">{buyer.name}</p>
                                <p className="text-[10px] text-[#66736A] font-bold flex items-center gap-1 font-mono mt-0.5">
                                  <Phone className="h-3 w-3 text-[#8FAF9A]" /> {buyer.phone}
                                </p>
                              </div>
                              <span className="text-[9px] font-black uppercase bg-[#DDE8D8] text-[#4F6F52] px-2 py-0.5 rounded-lg border border-[#8FAF9A]/30">
                                {t("siteplan_viewer.buyer")}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div className="bg-[#F7F8F3]/50 p-2.5 rounded-xl border border-[#D6DED2]/40">
                                <p className="text-[9px] text-[#66736A] font-bold uppercase mb-1">{t("siteplan_viewer.payment_scheme")}</p>
                                <p className="font-extrabold text-[#243028]">{buyer.scheme}</p>
                              </div>
                              <div className="bg-[#F7F8F3]/50 p-2.5 rounded-xl border border-[#D6DED2]/40">
                                <p className="text-[9px] text-[#66736A] font-bold uppercase mb-1">{t("siteplan_viewer.cash_status")}</p>
                                <div className="flex items-center gap-1">
                                  <span className={`inline-block h-2 w-2 rounded-full ${buyer.paymentProgress === 100 ? "bg-[#4F6F52]" : "bg-amber-400"}`} />
                                  <span className="font-black font-mono text-[#243028]">{buyer.paymentProgress}% {t("siteplan_viewer.paid")}</span>
                                </div>
                              </div>
                            </div>

                            {/* Payment Milestones Mini Checklist */}
                            {(() => {
                              const kprProcess = kprProcesses.find(k => k.bookingId === activeBooking.id);
                              const bfInvoice = invoices.find(i => i.bookingId === activeBooking.id && i.type === "booking_fee");
                              const dpInvoice = invoices.find(i => i.bookingId === activeBooking.id && i.type === "dp");

                              const bfPaid = bfInvoice?.status === "paid";
                              const dpPaid = dpInvoice?.status === "paid";
                              const kprApproved = kprProcess ? (kprProcess.status === "approved" || kprProcess.status === "akad" || kprProcess.status === "realisasi") : false;

                              return (
                                <div className="pt-2 border-t border-[#D6DED2]/30 space-y-2">
                                  <p className="text-[9px] text-[#66736A] font-bold uppercase tracking-wider">{t("siteplan_viewer.milestone")}</p>
                                  <div className="grid grid-cols-3 gap-2 text-[9px] font-bold">
                                    <div className={`flex items-center justify-center gap-1 px-2 py-1 rounded-lg border ${
                                      bfPaid 
                                        ? "text-[#4F6F52] bg-[#DDE8D8]/50 border-[#8FAF9A]/20" 
                                        : "text-[#66736A]/50 bg-white border-[#D6DED2]/40"
                                    }`}>
                                      <CheckCircle2 className="h-3 w-3 shrink-0" />
                                      <span>{t("siteplan_viewer.booking_fee")} ({bfPaid ? "Lunas" : "Belum"})</span>
                                    </div>
                                    <div className={`flex items-center justify-center gap-1 px-2 py-1 rounded-lg border ${
                                      dpPaid 
                                        ? "text-[#4F6F52] bg-[#DDE8D8]/50 border-[#8FAF9A]/20" 
                                        : "text-[#66736A]/50 bg-white border-[#D6DED2]/40"
                                    }`}>
                                      <CheckCircle2 className="h-3 w-3 shrink-0" />
                                      <span>{t("siteplan_viewer.down_payment")} ({dpPaid ? "Lunas" : "Belum"})</span>
                                    </div>
                                    {activeBooking.paymentScheme === "kpr" ? (
                                      <div className={`flex items-center justify-center gap-1 px-2 py-1 rounded-lg border ${
                                        kprApproved 
                                          ? "text-[#4F6F52] bg-[#DDE8D8]/50 border-[#8FAF9A]/20" 
                                          : "text-[#66736A]/50 bg-white border-[#D6DED2]/40"
                                      }`}>
                                        <CheckCircle2 className="h-3 w-3 shrink-0" />
                                        <span>{t("siteplan_viewer.credit_akad")} ({kprProcess ? (kprProcess.status === "akad" ? "Akad" : kprProcess.status === "approved" ? "Disetujui" : kprProcess.status === "realisasi" ? "Realisasi" : "Proses") : "Belum"})</span>
                                      </div>
                                    ) : (
                                      <div className={`flex items-center justify-center gap-1 px-2 py-1 rounded-lg border ${
                                        dpPaid 
                                          ? "text-[#4F6F52] bg-[#DDE8D8]/50 border-[#8FAF9A]/20" 
                                          : "text-[#66736A]/50 bg-white border-[#D6DED2]/40"
                                      }`}>
                                        <CheckCircle2 className="h-3 w-3 shrink-0" />
                                        <span>Lunas Cash ({dpPaid ? "Selesai" : "Proses"})</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}

                            <div className="pt-2 border-t border-[#D6DED2]/30">
                              {canViewBooking ? (
                                <a
                                  href={`/marketing/bookings/${activeBooking.id}`}
                                  className="w-full bg-[#F7F8F3] hover:bg-[#DDE8D8]/50 text-[#4F6F52] border border-[#D6DED2] font-bold text-xs rounded-xl py-2 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                  {t("siteplan_viewer.view_booking")}
                                </a>
                              ) : (
                                <button
                                  disabled
                                  className="w-full bg-[#F7F8F3] text-gray-400 border border-gray-200 font-bold text-xs rounded-xl py-2 flex items-center justify-center gap-1.5 opacity-60 cursor-not-allowed"
                                >
                                  <Lock className="h-3.5 w-3.5" />
                                  {t("siteplan_viewer.view_booking")}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* 3. Physical Dimension and Spec Details Grid */}
                    <div className="bg-white rounded-[2rem] p-5 border border-[#D6DED2] shadow-sage space-y-4 transition-all hover:shadow-sage-lg mt-5">
                      <h4 className="text-[11px] font-black text-[#243028] uppercase tracking-wider flex items-center gap-2 border-b border-[#D6DED2]/40 pb-3">
                        <Building2 className="h-4 w-4 text-[#4F6F52]" />
                        {t("siteplan_viewer.physical_specs")}
                      </h4>

                      <div className="grid grid-cols-2 gap-3.5 text-xs font-semibold text-[#243028]">
                        <div className="bg-[#F7F8F3]/60 p-3 rounded-2xl border border-[#D6DED2]/50 flex items-center justify-between">
                          <div>
                            <p className="text-[9px] text-[#66736A] font-bold uppercase mb-1 flex items-center gap-1">
                              <Ruler className="h-3 w-3 text-[#4F6F52]" /> {t("siteplan_viewer.land_area")}
                            </p>
                            <p className="font-mono font-extrabold text-[13px]">{unit.landArea} m²</p>
                          </div>
                          <span className="text-[9px] font-black text-[#8FAF9A] font-mono bg-white px-1.5 py-0.5 rounded border border-[#D6DED2]/30">LT</span>
                        </div>

                        <div className="bg-[#F7F8F3]/60 p-3 rounded-2xl border border-[#D6DED2]/50 flex items-center justify-between">
                          <div>
                            <p className="text-[9px] text-[#66736A] font-bold uppercase mb-1 flex items-center gap-1">
                              <Building2 className="h-3 w-3 text-[#4F6F52]" /> {t("siteplan_viewer.build_area")}
                            </p>
                            <p className="font-mono font-extrabold text-[13px]">{unit.buildingArea} m²</p>
                          </div>
                          <span className="text-[9px] font-black text-purple-400 font-mono bg-white px-1.5 py-0.5 rounded border border-[#D6DED2]/30">LB</span>
                        </div>

                        <div className="col-span-2 bg-[#F7F8F3]/60 p-3 rounded-2xl border border-[#D6DED2]/50">
                          <p className="text-[9px] text-[#66736A] font-bold uppercase mb-1 flex items-center gap-1">
                            <Tag className="h-3 w-3 text-[#4F6F52]" /> {t("siteplan_viewer.design_type")}
                          </p>
                          <p className="font-extrabold text-sm text-[#4F6F52]">
                            {unit.typeName || t("siteplan_viewer.standard_design")}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 4. Construction Progress & Gallery */}
                    {(unit.status === "construction" ||
                      unit.status === "construction_done" ||
                      unit.status === "overdue" ||
                      (isReadyStock && (unit.constructionProgress || 0) > 0)) && (
                      <div className="bg-white rounded-[2rem] p-5 border border-[#D6DED2] shadow-sage space-y-4 transition-all hover:shadow-sage-lg mt-5">
                        <div className="flex items-center justify-between border-b border-[#D6DED2]/40 pb-3">
                          <h4 className="text-xs font-black text-[#243028] uppercase tracking-wider flex items-center gap-2">
                            {(unit.constructionProgress || 0) >= 100 
                              ? <CheckCircle2 className="h-4 w-4 text-[#4F6F52]" />
                              : <Hammer className="h-4 w-4 text-purple-600 animate-bounce" />
                            }
                            {t("siteplan_viewer.construction_progress")}
                          </h4>
                          <span className={`font-mono font-extrabold text-xs px-2 py-0.5 rounded-lg border ${
                            (unit.constructionProgress || 0) >= 100
                              ? "text-[#4F6F52] bg-[#DDE8D8] border-[#8FAF9A]/30"
                              : "text-purple-700 bg-purple-50 border-purple-100"
                          }`}>
                            {unit.constructionProgress}%
                          </span>
                        </div>

                        <div className="space-y-3.5">
                          <Progress 
                            value={unit.constructionProgress} 
                            className={`h-2.5 rounded-full [&_[data-slot=progress-track]]:h-2.5 ${
                              (unit.constructionProgress || 0) >= 100 
                                ? "[&_[data-slot=progress-track]]:bg-[#DDE8D8] [&_[data-slot=progress-indicator]]:bg-[#4F6F52]" 
                                : "[&_[data-slot=progress-track]]:bg-[#E9DDF7] [&_[data-slot=progress-indicator]]:bg-[#7B5EA7]"
                            }`} 
                          />
                          
                          {unit.status === "overdue" && (
                            <div className="flex items-start gap-2 bg-rose-50 border border-rose-100 p-3 rounded-2xl text-[10px] text-[#8B3443] font-bold leading-normal">
                              <AlertTriangle className="h-4 w-4 text-[#8B3443] shrink-0 mt-0.5" />
                              <span>
                                {t("siteplan_viewer.sla_warning")}
                              </span>
                            </div>
                          )}

                          {/* BAST File Viewer card */}
                          {selectedSpkBast && (
                            <div className="p-3 bg-[#4F6F52]/5 border border-[#4F6F52]/10 rounded-2xl flex items-center justify-between text-xs transition-all hover:bg-[#4F6F52]/10 mt-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="p-2 bg-[#4F6F52]/10 text-[#4F6F52] rounded-xl shrink-0">
                                  <UploadCloud className="h-4 w-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-extrabold text-[#243028] text-[11px] truncate">
                                    Dokumen BAST Terunggah
                                  </p>
                                  <p className="text-[9px] text-[#66736A] font-mono truncate max-w-[150px] mt-0.5">
                                    {selectedSpkBast.fileName}
                                  </p>
                                </div>
                              </div>
                              <a
                                href={selectedSpkBast.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-[#4F6F52] hover:bg-[#3D563F] text-white font-extrabold text-[10px] px-3 py-1.5 rounded-xl shadow-sm transition-all hover:scale-[1.02] flex items-center gap-1 shrink-0 ml-2"
                              >
                                <ExternalLink className="h-3 w-3 text-white" />
                                Lihat PDF
                              </a>
                            </div>
                          )}

                          {/* Struktur Komponen & Bobot SLA Pembangunan Breakdown */}
                          {selectedSpkWeights.length > 0 && (
                            <div className="pt-3 border-t border-[#D6DED2]/40 space-y-3">
                              <p className="text-[10px] font-black text-[#243028] uppercase tracking-wider flex items-center gap-1.5">
                                <Layers className="h-3.5 w-3.5 text-[#4F6F52]" />
                                Struktur Komponen & Bobot SLA Pembangunan
                              </p>
                              
                              <div className="space-y-2.5 bg-[#8FAF9A]/5 p-3.5 rounded-2xl border border-[#8FAF9A]/20">
                                {selectedSpkWeights.map((w) => (
                                  <div key={w.workItemId} className="space-y-1">
                                    <div className="flex items-center justify-between text-[11px] font-bold text-[#243028]">
                                      <span className="truncate max-w-[240px]">
                                        {w.name} <span className="text-muted-foreground font-normal">({w.weightPct}%)</span>
                                      </span>
                                      <span className="text-[#4F6F52] font-extrabold font-mono">{w.currentProgress}%</span>
                                    </div>
                                    <Progress value={w.currentProgress} className="h-1.5 [&_[data-slot=progress-track]]:h-1.5" />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {!loadingSpkDetails && selectedSpkWeights.length === 0 && (
                            <div className="pt-3 border-t border-[#D6DED2]/40 space-y-3 text-left">
                              <p className="text-[10px] font-black text-[#66736A] uppercase tracking-wider flex items-center gap-1.5">
                                <Layers className="h-3.5 w-3.5 text-[#A8B0AA]" />
                                Surat Perintah Kerja (SPK) Konstruksi
                              </p>
                              <div className="p-4 bg-purple-50/50 border border-purple-100 rounded-2xl text-center text-xs space-y-3">
                                <Hammer className="h-8 w-8 text-purple-400 mx-auto animate-pulse" />
                                <div className="space-y-1">
                                  <p className="font-extrabold text-[#243028]">Belum Ada SPK Konstruksi Aktif</p>
                                  <p className="text-[10px] text-[#66736A] leading-relaxed max-w-[280px] mx-auto">
                                    Unit ini sudah berada dalam status pembangunan fisik, namun belum ada Surat Perintah Kerja (SPK) yang diterbitkan.
                                  </p>
                                </div>
                                <div className="pt-1">
                                  <a
                                    href="/production"
                                    className="inline-flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-[10px] px-3.5 py-2 rounded-xl shadow-sm transition-all hover:scale-[1.02] gap-1"
                                  >
                                    Terbitkan SPK Baru
                                    <ChevronRight className="h-3 w-3" />
                                  </a>
                                </div>
                              </div>
                            </div>
                          )}

                          {loadingSpkDetails && (
                            <div className="py-6 flex flex-col items-center justify-center text-xs text-muted-foreground gap-2">
                              <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                              <span>Memuat struktur bobot pembangunan...</span>
                            </div>
                          )}

                          {/* Photo Gallery — Real data from SPK progress logs */}
                          <div className="pt-1.5 space-y-2">
                            <p className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                              (unit.constructionProgress || 0) >= 100 ? "text-[#4F6F52]" : "text-[#66736A]"
                            }`}>
                              <Camera className={`h-3.5 w-3.5 ${(unit.constructionProgress || 0) >= 100 ? "text-[#4F6F52]" : "text-purple-500"}`} />
                              {(unit.constructionProgress || 0) >= 100 ? t("siteplan_viewer.gallery_done") : t("siteplan_viewer.gallery_proof")}
                            </p>
                            {(() => {
                              const photos = selectedSpkPhotos.length > 0 ? selectedSpkPhotos : (progressPhotos[unit.id] ?? []);
                              if (photos.length === 0) {
                                return (
                                  <div className="flex flex-col items-center justify-center py-4 text-[#66736A]/60 gap-1.5 border border-dashed border-[#D6DED2] rounded-2xl">
                                    <Camera className="h-6 w-6 opacity-40" />
                                    <span className="text-[9px] font-bold">{t("siteplan_viewer.gallery_empty")}</span>
                                    <span className="text-[8px] text-[#66736A]/50 text-center leading-relaxed px-4">{t("siteplan_viewer.gallery_empty_desc")}</span>
                                  </div>
                                );
                              }
                              return (
                                <div className="grid grid-cols-3 gap-2">
                                  {photos.slice(0, 6).map((photo, idx) => (
                                    <a
                                      key={idx}
                                      href={photo.fileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`group/photo relative aspect-square bg-[#F7F8F3] border rounded-xl overflow-hidden flex flex-col items-center justify-center transition-all hover:shadow-md ${
                                        (unit.constructionProgress || 0) >= 100
                                          ? "border-[#8FAF9A]/40 hover:border-[#4F6F52]"
                                          : "border-[#D6DED2] hover:border-purple-300"
                                      }`}
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={photo.fileUrl}
                                        alt={photo.workItemName}
                                        className="absolute inset-0 w-full h-full object-cover group-hover/photo:scale-105 transition-transform duration-300"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                      />
                                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                                      <div className="absolute bottom-0 left-0 right-0 p-1.5">
                                        <span className="text-[7px] font-black text-white block leading-tight truncate">{photo.workItemName}</span>
                                        <span className="text-[6px] font-mono text-white/80 block">
                                          {new Date(photo.progressDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' })}
                                        </span>
                                      </div>
                                      {photo.notes && (
                                        <div className="absolute top-1 right-1 h-3 w-3 bg-white/80 rounded-full flex items-center justify-center" title={photo.notes}>
                                          <span className="text-[6px] font-black text-[#4F6F52]">i</span>
                                        </div>
                                      )}
                                    </a>
                                  ))}
                                  {photos.length > 6 && (
                                    <div className="aspect-square bg-[#F7F8F3] border border-[#D6DED2] rounded-xl flex flex-col items-center justify-center gap-1">
                                      <span className="text-sm font-black text-[#4F6F52]">+{photos.length - 6}</span>
                                      <span className="text-[7px] font-bold text-[#66736A]">{t("siteplan_viewer.more_photos")}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 5. DYNAMIC ERP WORKFLOW TIMELINE STEPS */}
                    {!(isReadyStock && (unit.status === "construction" || unit.status === "overdue")) && (
                      <div className="bg-white rounded-[2rem] p-5 border border-[#D6DED2] shadow-sage space-y-4 transition-all hover:shadow-sage-lg mt-5">
                        <h4 className="text-[11px] font-black text-[#243028] uppercase tracking-wider flex items-center gap-2 border-b border-[#D6DED2]/40 pb-3">
                          <Clock className="h-4 w-4 text-[#4F6F52]" />
                          {t("siteplan_viewer.sales_flow")}
                        </h4>

                        <div className="space-y-4 relative pl-3">
                          {/* Left Solid Guide Line */}
                          <div className="absolute left-[20px] top-2 bottom-2 w-0.5 bg-[#D6DED2]" />

                          {getTimelineSteps({
                            unit,
                            activeBooking,
                            paymentScheme: activeBooking?.paymentScheme,
                            kprProcess: kprProcesses.find(k => k.bookingId === activeBooking?.id),
                            invoices,
                          }).map((step, idx) => {
                            const isDone = step.done;
                            const isActive = step.active;

                            return (
                              <div key={idx} className="flex gap-4 relative animate-fade-in">
                                {/* Timeline Bullet Indicator */}
                                <div
                                  className={`z-10 h-4.5 w-4.5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                                    isDone
                                      ? "bg-[#4F6F52] border-[#4F6F52] text-white shadow-sm"
                                      : isActive
                                      ? "bg-amber-50 border-amber-500 text-amber-600 animate-pulse shadow-md"
                                      : "bg-[#F7F8F3] border-[#D6DED2]"
                                  }`}
                                >
                                  {isDone && <CheckCircle2 className="h-2.5 w-2.5" />}
                                  {isActive && <div className="h-1.5 w-1.5 bg-amber-500 rounded-full animate-ping" />}
                                </div>

                                {/* Timeline Content */}
                                <div className="pb-5 relative top-[-2px] flex-1">
                                  <span
                                    className={`text-[11px] font-extrabold uppercase tracking-widest block transition-colors ${
                                      isDone ? "text-[#243028]" : isActive ? "text-amber-700" : "text-[#8FAF9A]/70"
                                    }`}
                                  >
                                    {step.label}
                                  </span>
                                  <span className={`text-[10px] font-medium leading-tight block mt-0.5 ${isActive ? "text-amber-700/80" : "text-[#66736A]"}`}>
                                    {step.desc}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 6. DYNAMIC ERP DEVELOPER PROGRESS (ONLY FOR READY STOCK) */}
                    {isReadyStock && (unit.status === "construction" || unit.status === "overdue" || unit.status === "construction_done" || (unit.constructionProgress || 0) > 0) && (
                      <div className="bg-white rounded-[2rem] p-5 border border-[#D6DED2] shadow-sage space-y-4 transition-all hover:shadow-sage-lg mt-5">
                        <h4 className="text-xs font-black text-[#243028] uppercase tracking-wider flex items-center justify-between border-b border-[#D6DED2]/40 pb-3">
                          <div className="flex items-center gap-2">
                            <Hammer className="h-4 w-4 text-amber-600" />
                            {t("siteplan_viewer.dev_progress")}
                          </div>
                          {unit.constructionProgress === 100 && (
                            <span className="text-[9px] font-bold bg-[#DDE8D8] text-[#4F6F52] px-2 py-0.5 rounded-full">{t("siteplan_viewer.done_100")}</span>
                          )}
                        </h4>
                        <div className="pt-2">
                          <div className="flex justify-between items-end mb-2">
                            <span className="text-[10px] font-medium text-[#66736A]">{t("siteplan_viewer.spk_progress")}</span>
                            <span className="text-sm font-black text-amber-700">{unit.constructionProgress || 0}%</span>
                          </div>
                          <div className="w-full bg-[#E5E9E2] rounded-full h-2.5 overflow-hidden">
                            <div 
                              className="bg-amber-500 h-2.5 rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
                              style={{ width: `${unit.constructionProgress || 0}%` }}
                            >
                              {/* Shimmer effect for active construction */}
                              {(unit.constructionProgress || 0) < 100 && (unit.constructionProgress || 0) > 0 && (
                                <div className="absolute top-0 bottom-0 left-0 right-0 bg-white/20 -skew-x-12 animate-shimmer" />
                              )}
                            </div>
                          </div>
                          {(unit.constructionProgress || 0) < 100 ? (
                            <p className="text-[9px] text-[#66736A] mt-2.5 leading-relaxed bg-amber-50/50 p-2 rounded-xl border border-amber-100" dangerouslySetInnerHTML={{ __html: t("siteplan_viewer.ready_stock_desc1").replace(/<1>/g, '<strong>').replace(/<\/1>/g, '</strong>') }} />
                          ) : (
                            <p className="text-[9px] text-[#4F6F52] mt-2.5 leading-relaxed bg-[#DDE8D8]/30 p-2 rounded-xl border border-[#DDE8D8]">
                              {t("siteplan_viewer.ready_stock_desc2")}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 7. Ready Stock Defect Lists (Cacat Fisik & Bukti Foto) */}
                    {isReadyStock ? (
                      <div className="bg-white rounded-[2rem] p-5 border border-[#D6DED2] shadow-sage space-y-4 transition-all hover:shadow-sage-lg mt-5 text-left">
                        <div className="flex items-center justify-between border-b border-[#D6DED2]/40 pb-3">
                          <h4 className="text-xs font-black text-[#243028] uppercase tracking-wider flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500 animate-pulse" />
                            Daftar Cacat Fisik (Defect List)
                          </h4>
                          {!editingDefectNotes && (
                            <Button 
                              size="xs" 
                              variant="outline" 
                              onClick={() => setEditingDefectNotes(true)}
                              className="text-[10px] h-7 font-bold border-[#D6DED2] text-[#4F6F52] hover:bg-[#DDE8D8]/20"
                            >
                              Ubah Catatan
                            </Button>
                          )}
                        </div>

                        {editingDefectNotes ? (
                          <div className="space-y-2">
                            <textarea
                              value={defectNotesValue}
                              onChange={(e) => setDefectNotesValue(e.target.value)}
                              placeholder="Tuliskan catatan cacat fisik unit ready stock di sini (misal: cat dinding mengelupas, pintu kamar mandi seret)..."
                              className="w-full min-h-[100px] text-xs p-3 rounded-2xl border border-[#D6DED2] focus:outline-none focus:ring-2 focus:ring-ring/20"
                            />
                            <div className="flex justify-end gap-2">
                              <Button 
                                size="xs" 
                                variant="ghost" 
                                onClick={() => {
                                  setDefectNotesValue(unit.notes || "");
                                  setEditingDefectNotes(false);
                                }}
                                className="text-xs"
                              >
                                Batal
                              </Button>
                              <Button 
                                size="xs" 
                                onClick={handleSaveDefectNotes}
                                disabled={isSubmitting}
                                className="bg-[#4F6F52] hover:bg-[#3D563F] text-white font-extrabold text-xs"
                              >
                                Simpan
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-[#243028] bg-[#F7F8F3]/80 border border-[#D6DED2]/50 p-3.5 rounded-2xl leading-relaxed whitespace-pre-line">
                            {unit.notes ? unit.notes : <span className="italic text-muted-foreground">Tidak ada catatan cacat fisik (Unit siap huni tanpa defect).</span>}
                          </div>
                        )}

                        {/* Defect Photo Gallery */}
                        <div className="pt-2 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider flex items-center gap-1.5">
                              <Camera className="h-3.5 w-3.5 text-[#4F6F52]" />
                              Bukti Foto Defect ({defectPhotosList.length})
                            </span>
                            <div className="relative">
                              <input
                                id="defect-photo-upload"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleUploadDefectPhoto}
                                disabled={uploadingDefectPhoto}
                              />
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => document.getElementById("defect-photo-upload")?.click()}
                                disabled={uploadingDefectPhoto}
                                className="text-[10px] h-7 font-bold border-[#D6DED2] text-[#4F6F52] hover:bg-[#DDE8D8]/20 flex items-center gap-1"
                              >
                                {uploadingDefectPhoto ? "Mengunggah..." : "Tambah Foto"}
                              </Button>
                            </div>
                          </div>

                          {defectPhotosList.length > 0 ? (
                            <div className="grid grid-cols-3 gap-2">
                              {defectPhotosList.map((photo) => (
                                <div key={photo.id} className="relative group/defect aspect-square bg-[#F7F8F3] border border-[#D6DED2] rounded-xl overflow-hidden shadow-sm">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={photo.fileUrl}
                                    alt={photo.fileName}
                                    className="w-full h-full object-cover transition-transform duration-300 group-hover/defect:scale-105"
                                  />
                                  {/* Delete Overlay */}
                                  <button
                                    onClick={() => handleDeleteDefectPhoto(photo.id)}
                                    className="absolute top-1.5 right-1.5 h-6 w-6 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center opacity-0 group-hover/defect:opacity-100 transition-opacity duration-150 shadow-md"
                                    title="Hapus Foto"
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-white" />
                                  </button>
                                  {/* View Image Link */}
                                  <a
                                    href={photo.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="absolute inset-x-0 bottom-0 bg-black/60 p-1 text-[8px] font-bold text-white text-center truncate"
                                  >
                                    Lihat Detail
                                  </a>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-5 text-[#66736A]/60 gap-1.5 border border-dashed border-[#D6DED2] rounded-2xl bg-[#F7F8F3]/30">
                              <Camera className="h-6 w-6 opacity-40" />
                              <span className="text-[9px] font-bold">Belum Ada Bukti Foto Defect</span>
                              <span className="text-[8px] text-[#66736A]/50 text-center px-4 leading-normal">
                                Tambahkan bukti foto jika terdapat cacat fisik pada unit ready stock.
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* Remarks/Notes for Non-Ready Stock */
                      unit.notes && (
                        <div className="bg-white rounded-[2rem] p-5 border border-[#D6DED2] shadow-sage transition-all hover:shadow-sage-lg text-left mt-5">
                          <span className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider block mb-1">
                            {t("siteplan_viewer.unit_notes")}
                          </span>
                          <p className="text-xs text-[#243028] bg-[#F7F8F3]/80 border border-[#D6DED2]/50 p-3 rounded-2xl leading-relaxed">
                            {unit.notes}
                          </p>
                        </div>
                      )
                    )}
                  </>
                )}

                {unit.status === "belum_siap" && (
                  <div className="bg-white rounded-[2rem] p-6 border border-[#D6DED2] shadow-sage text-center transition-all mt-5">
                    <div className="h-14 w-14 rounded-full bg-[#F7F8F3] flex items-center justify-center mx-auto mb-4 border border-[#D6DED2]">
                      <AlertTriangle className="h-6 w-6 text-[#AAB5AF]" />
                    </div>
                    <h4 className="text-sm font-black text-[#243028] mb-1.5 uppercase tracking-wider">{t("siteplan_viewer.not_ready")}</h4>
                    <p className="text-xs text-[#66736A] leading-relaxed mb-5 whitespace-pre-line">
                      {t("siteplan_viewer.not_ready_desc")}
                    </p>
                    {canEdit && (
                      <UnitForm 
                        id={unit.id}
                        projects={projects || []}
                        vendors={vendors || []}
                        initialData={{
                          projectId: projects?.[0]?.id || "",
                          code: unit.code,
                          cluster: unit.cluster || undefined,
                          typeName: unit.typeName || undefined,
                          landArea: unit.landArea || 0,
                          buildingArea: unit.buildingArea || 0,
                          price: unit.price || 0,
                          status: "belum_siap",
                          isReadyStock: unit.isReadyStock || false,
                          readyStockSource: (unit?.readyStockSource as "construction_flow" | "legacy_ready_stock" | "manual_ready_stock") || "construction_flow",
                          notes: unit.notes || undefined,
                        }}
                      />
                    )}
                  </div>
                )}

                {/* Activity Timeline Section */}
                {unit && (
                  <div className="bg-white rounded-[2rem] p-5 border border-[#D6DED2] shadow-sage transition-all hover:shadow-sage-lg mt-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Activity className="h-4 w-4 text-[#4F6F52]" />
                      <span className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider">
                        Riwayat Aktivitas Unit
                      </span>
                    </div>
                    <UnitTimeline unitId={unit.id} />
                  </div>
                )}
              </>
            ) : (
              <div className="mt-8 px-4 py-8 text-center bg-white rounded-[2rem] border border-[#D6DED2] shadow-sage animate-fade-in space-y-6">
                <div className="h-16 w-16 rounded-full bg-[#F7F8F3] border border-[#D6DED2] flex items-center justify-center mx-auto text-[#66736A] shadow-inner">
                  <HelpCircle className="h-8 w-8 text-[#A8B0AA] animate-pulse" />
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-sm font-black text-[#243028] uppercase tracking-wider">
                    Shape Koordinat Belum Terhubung
                  </h4>
                  <p className="text-xs text-[#66736A] leading-relaxed max-w-sm mx-auto">
                    {t("siteplan_viewer.unlinked_shape")}
                  </p>
                </div>

                {/* We only allow editing/linking if the user has editor/admin permissions */}
                {canEdit ? (
                  <div className="space-y-4 pt-2 border-t border-[#D6DED2]/60">
                    <div className="flex flex-col gap-3.5">
                      
                      {/* Option 1: Link to existing unlinked unit */}
                      {unlinkedUnits.length > 0 ? (
                        <div className="bg-[#F7F8F3]/60 p-4 rounded-2xl border border-[#D6DED2]/50 text-left space-y-3">
                          <label className="text-[10px] font-black uppercase text-[#66736A] tracking-wider block">
                            Hubungkan ke Unit / Kavling yang Sudah Ada
                          </label>
                          <div className="flex gap-2">
                            <Select
                              value={selectedUnitId}
                              onValueChange={(val) => setSelectedUnitId(val || "")}
                            >
                              <SelectTrigger className="flex-1 text-xs rounded-xl border border-[#D6DED2] bg-white h-9 px-3">
                                <SelectValue placeholder="Pilih unit/kavling..." />
                              </SelectTrigger>
                              <SelectContent className="border-[#D6DED2] rounded-xl bg-white max-h-60">
                                {unlinkedUnits.map((u) => (
                                  <SelectItem key={u.id} value={u.id} className="text-xs">
                                    {u.code} - Rp {u.price.toLocaleString("id-ID")}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              disabled={!selectedUnitId || isLinking}
                              onClick={handleLinkShapeToUnit}
                              className="bg-[#4F6F52] hover:bg-[#3D563F] text-white font-extrabold text-xs h-9 rounded-xl px-4 flex items-center gap-1.5 shadow-sm"
                            >
                              {isLinking ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Link2 className="h-3.5 w-3.5" />
                              )}
                              Hubungkan
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl text-[10px] text-amber-800 font-bold text-center leading-normal">
                          Tidak ada unit/kavling tanpa koordinat. Silakan buat unit baru di bawah.
                        </div>
                      )}

                      {/* Option 2: Create new unit directly and link it */}
                      <div className="bg-[#F7F8F3]/60 p-4 rounded-2xl border border-[#D6DED2]/50 text-left space-y-3 flex flex-col items-center">
                        <div className="w-full">
                          <label className="text-[10px] font-black uppercase text-[#66736A] tracking-wider block mb-1">
                            Buat Unit / Kavling Baru
                          </label>
                          <p className="text-[10px] text-[#66736A] leading-normal mb-3">
                            Buat data unit baru di database dan hubungkan secara otomatis ke shape ini.
                          </p>
                        </div>
                        <UnitForm
                          projects={projects || []}
                          vendors={vendors || []}
                          initialData={{
                            projectId: projects?.[0]?.id || "",
                            code: selectedShape?.label || "", // Default to the shape label if set
                            status: "available",
                            isReadyStock: false,
                            readyStockSource: "construction_flow",
                            price: 0,
                            landArea: 0,
                            buildingArea: 0,
                            cluster: undefined,
                            typeName: undefined,
                          }}
                          onSuccess={handleCreateUnitAndLink}
                          triggerButton={
                            <Button className="w-full bg-white hover:bg-[#DDE8D8]/20 border border-[#D6DED2] text-[#4F6F52] font-black text-xs h-10 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all hover:scale-[1.01]">
                              <PlusCircle className="h-4 w-4 text-[#4F6F52]" />
                              Buat &amp; Hubungkan Kavling Baru
                            </Button>
                          }
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-100 rounded-xl text-[10px] text-slate-500 font-bold justify-center">
                    <Lock className="h-3.5 w-3.5" />
                    Silakan masuk sebagai Admin untuk mengaitkan unit.
                  </div>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* DIALOG: UPLOAD BAST VENDOR TO DEVELOPER PDF */}
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

            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-semibold">
                {errorMessage}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground text-xs">Unggah File PDF BAST (Tanda Tangan Basah/Digital)</label>
              <div 
                onClick={() => document.getElementById('siteplan-bast-pdf-upload')?.click()}
                className="border-2 border-dashed border-[#8FAF9A]/30 hover:border-primary/50 bg-[#F7F8F3]/60 hover:bg-[#8FAF9A]/5 rounded-2xl p-6 text-center cursor-pointer transition-all duration-150 group"
              >
                <input
                  id="siteplan-bast-pdf-upload"
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
                    Selesai &amp; Jadikan Siap Huni
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
