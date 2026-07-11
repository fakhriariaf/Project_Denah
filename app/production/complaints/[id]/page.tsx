import { db } from "@/db";
import {
  complaints as complaintsTable,
} from "@/db/schema/production";
import {
  projects as projectsTable,
  units as unitsTable,
  customers as customersTable,
  vendors as vendorsTable,
} from "@/db/schema/master";
import { user as userTable } from "@/db/schema/auth";
import { attachments as attachmentsTable } from "@/db/schema/system";
import { eq } from "drizzle-orm";
import { requireAuth, getSessionRole } from "@/server/permissions";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  User,
  Home,
  FileText,
  CheckCircle,
  Clock,
  Tag,
  Truck,
  Download,
  Paperclip,
  Calendar,
  CircleDot,
} from "lucide-react";
import { formatDate } from "@/lib/format-utils";

export const revalidate = 0;

interface ComplaintDetailPageProps {
  params: Promise<{ id: string }>;
}

const statusColors: Record<string, string> = {
  open: "bg-amber-50 text-amber-700 border-amber-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed: "bg-gray-100 text-gray-600 border-gray-200",
  in_review: "bg-blue-50 text-blue-700 border-blue-200",
  need_revision: "bg-amber-50 text-amber-700 border-amber-200",
  approved_extension: "bg-blue-50 text-blue-700 border-blue-200",
  follow_up_required: "bg-amber-50 text-amber-700 border-amber-200",
  waiting_customer_confirmation: "bg-amber-50 text-amber-700 border-amber-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

const statusLabels: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
  in_review: "In Review",
  need_revision: "Need Revision",
  approved_extension: "Approved Extension",
  follow_up_required: "Follow Up Required",
  waiting_customer_confirmation: "Waiting Confirmation",
  rejected: "Rejected",
};

export default async function ComplaintDetailPage({ params }: ComplaintDetailPageProps) {
  const { id } = await params;

  // Auth + RBAC
  const activeUser = await requireAuth();
  const session = await getSessionRole(activeUser.id);

  // Same access as production page: Super Admin, Admin Kantor, Direksi, Pengawas, Vendor
  const hasAccess =
    session.isSuperAdmin ||
    session.isAdminKantor ||
    session.isDireksi ||
    session.isPengawas ||
    session.isVendor;

  if (!hasAccess) {
    notFound();
  }

  // Fetch complaint with relations
  const [complaintData] = await db
    .select({
      id: complaintsTable.id,
      complaintNumber: complaintsTable.complaintNumber,
      complaintType: complaintsTable.complaintType,
      customerId: complaintsTable.customerId,
      unitId: complaintsTable.unitId,
      vendorId: complaintsTable.vendorId,
      projectId: complaintsTable.projectId,
      title: complaintsTable.title,
      category: complaintsTable.category,
      description: complaintsTable.description,
      status: complaintsTable.status,
      resolvedAt: complaintsTable.resolvedAt,
      repairAction: complaintsTable.repairAction,
      developerNote: complaintsTable.developerNote,
      supervisorNote: complaintsTable.supervisorNote,
      assignedTo: complaintsTable.assignedTo,
      createdAt: complaintsTable.createdAt,
      customerName: customersTable.name,
      customerPhone: customersTable.phone,
      unitCode: unitsTable.code,
      projectName: projectsTable.name,
    })
    .from(complaintsTable)
    .leftJoin(customersTable, eq(complaintsTable.customerId, customersTable.id))
    .leftJoin(unitsTable, eq(complaintsTable.unitId, unitsTable.id))
    .leftJoin(projectsTable, eq(unitsTable.projectId, projectsTable.id))
    .where(eq(complaintsTable.id, id));

  if (!complaintData) notFound();

  // Fetch vendor info if assigned
  let vendorName: string | null = null;
  if (complaintData.vendorId) {
    const [vendor] = await db
      .select({ name: vendorsTable.name })
      .from(vendorsTable)
      .where(eq(vendorsTable.id, complaintData.vendorId));
    vendorName = vendor?.name || null;
  }

  // Fetch assigned user name if exists
  let assignedUserName: string | null = null;
  if (complaintData.assignedTo) {
    const [assignedUser] = await db
      .select({ name: userTable.name })
      .from(userTable)
      .where(eq(userTable.id, complaintData.assignedTo));
    assignedUserName = assignedUser?.name || null;
  }

  // Fetch attachments for this complaint
  const complaintAttachments = await db
    .select()
    .from(attachmentsTable)
    .where(eq(attachmentsTable.entityId, id));

  const statusColor = statusColors[complaintData.status || "open"] || statusColors.open;
  const statusLabel = statusLabels[complaintData.status || "open"] || complaintData.status;

  const categoryLabels: Record<string, string> = {
    quality: "Kualitas",
    delay: "Keterlambatan",
    document: "Dokumen",
    payment: "Pembayaran",
    other: "Lainnya",
  };

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Back Link */}
        <Link
          href="/production?tab=complaints"
          className="inline-flex items-center gap-2 text-sm text-primary hover:text-[#3d5a40] font-medium transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Daftar Komplain
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground font-sans">
              {complaintData.complaintNumber}
            </h1>
            {complaintData.title && (
              <p className="text-sm text-muted-foreground">{complaintData.title}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`border font-semibold shadow-none ${statusColor}`}>
              {statusLabel}
            </Badge>
            <Badge
              variant="outline"
              className="text-xs border-primary/50 text-primary bg-[#8FAF9A]/5 font-semibold shadow-none"
            >
              {categoryLabels[complaintData.category] || complaintData.category}
            </Badge>
          </div>
        </div>

        {/* Timeline Section */}
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative pl-6 space-y-6">
              {/* Vertical line */}
              <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-[#8FAF9A]/30" />

              {/* Created */}
              <div className="relative">
                <div className="absolute -left-6 top-0.5 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                  <CircleDot className="h-3 w-3 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Komplain Dibuka</p>
                  <p className="text-xs text-muted-foreground">{formatDate(complaintData.createdAt)}</p>
                </div>
              </div>

              {/* Category Assignment */}
              <div className="relative">
                <div className="absolute -left-6 top-0.5 h-5 w-5 rounded-full bg-[#8FAF9A] flex items-center justify-center">
                  <Tag className="h-3 w-3 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Kategori Ditetapkan</p>
                  <p className="text-xs text-muted-foreground">
                    {categoryLabels[complaintData.category] || complaintData.category}
                  </p>
                </div>
              </div>

              {/* Vendor Assignment */}
              {vendorName && (
                <div className="relative">
                  <div className="absolute -left-6 top-0.5 h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <Truck className="h-3 w-3 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Vendor Ditugaskan</p>
                    <p className="text-xs text-muted-foreground">{vendorName}</p>
                  </div>
                </div>
              )}

              {/* Resolution */}
              {complaintData.resolvedAt && (
                <div className="relative">
                  <div className="absolute -left-6 top-0.5 h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <CheckCircle className="h-3 w-3 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Komplain Diselesaikan</p>
                    <p className="text-xs text-muted-foreground">{formatDate(complaintData.resolvedAt)}</p>
                    {complaintData.repairAction && (
                      <p className="text-xs text-primary mt-1">{complaintData.repairAction}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Detail Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Customer Info */}
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Informasi Pelanggan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-xs text-muted-foreground">Nama</p>
                <p className="text-sm font-medium text-foreground">{complaintData.customerName || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Telepon</p>
                <p className="text-sm font-medium text-foreground">{complaintData.customerPhone || "-"}</p>
              </div>
            </CardContent>
          </Card>

          {/* Unit Info */}
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <Home className="h-4 w-4 text-primary" />
                Informasi Unit
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-xs text-muted-foreground">Kode Unit</p>
                <p className="text-sm font-medium text-foreground">{complaintData.unitCode || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Proyek</p>
                <p className="text-sm font-medium text-foreground">{complaintData.projectName || "-"}</p>
              </div>
            </CardContent>
          </Card>

          {/* Complaint Details */}
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Detail Komplain
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {complaintData.title && (
                <div>
                  <p className="text-xs text-muted-foreground">Judul</p>
                  <p className="text-sm font-medium text-foreground">{complaintData.title}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Deskripsi</p>
                <p className="text-sm font-medium text-foreground whitespace-pre-wrap">{complaintData.description}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Kategori</p>
                <p className="text-sm font-medium text-foreground">
                  {categoryLabels[complaintData.category] || complaintData.category}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Resolution Details */}
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                Detail Resolusi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="text-sm font-medium text-foreground">{statusLabel}</p>
              </div>
              {complaintData.resolvedAt && (
                <div>
                  <p className="text-xs text-muted-foreground">Tanggal Selesai</p>
                  <p className="text-sm font-medium text-foreground">{formatDate(complaintData.resolvedAt)}</p>
                </div>
              )}
              {complaintData.repairAction && (
                <div>
                  <p className="text-xs text-muted-foreground">Tindakan Perbaikan</p>
                  <p className="text-sm font-medium text-foreground whitespace-pre-wrap">{complaintData.repairAction}</p>
                </div>
              )}
              {complaintData.developerNote && (
                <div>
                  <p className="text-xs text-muted-foreground">Catatan Developer</p>
                  <p className="text-sm font-medium text-foreground whitespace-pre-wrap">{complaintData.developerNote}</p>
                </div>
              )}
              {assignedUserName && (
                <div>
                  <p className="text-xs text-muted-foreground">Ditangani Oleh</p>
                  <p className="text-sm font-medium text-foreground">{assignedUserName}</p>
                </div>
              )}
              {!complaintData.resolvedAt && !complaintData.repairAction && !complaintData.developerNote && !assignedUserName && (
                <p className="text-sm text-muted-foreground italic">Belum ada resolusi</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Attachments Section */}
        {complaintAttachments.length > 0 && (
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-primary" />
                Lampiran ({complaintAttachments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {complaintAttachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    href={attachment.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg border border-primary/20 hover:border-primary/50/50 hover:bg-secondary/30 transition-all group"
                  >
                    <div className="h-9 w-9 rounded-md bg-secondary/50 flex items-center justify-center flex-shrink-0">
                      <Download className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate">{attachment.fileName}</p>
                      {attachment.mimeType && (
                        <p className="text-[10px] text-muted-foreground">{attachment.mimeType}</p>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
