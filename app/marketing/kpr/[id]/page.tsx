import { db } from "@/db";
import {
  kprProcesses as kprTable,
  bookings as bookingsTable,
  bankPartners as bankPartnersTable,
  bankSubmissions as submissionsTable,
  customerDocuments as documentsTable,
} from "@/db/schema/marketing";
import {
  projects as projectsTable,
  units as unitsTable,
  customers as customersTable,
} from "@/db/schema/master";
import { user as userTable } from "@/db/schema/auth";
import { attachments } from "@/db/schema/system";
import { eq } from "drizzle-orm";
import { requireAuth, getSessionRole } from "@/server/permissions";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  FileText,
  User,
  Building2,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Download,
  FileImage,
  File,
  Landmark,
} from "lucide-react";
import { formatDate, formatRupiah } from "@/lib/format-utils";
import {
  getKprStatusLabel,
  getBankSubmissionStatusLabel,
  getDocumentVerificationStatusLabel,
} from "@/lib/label-helpers";
import { KprMilestoneTracker } from "../kpr-milestone-tracker";

export const revalidate = 0;

interface KprDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function KprDetailPage({ params }: KprDetailPageProps) {
  const { id } = await params;

  // Auth + RBAC
  const activeUser = await requireAuth();
  const session = await getSessionRole(activeUser.id);

  // Only Super Admin, Admin Kantor, Marketing Manager, Marketing, Direksi can access
  const hasAccess =
    session.isSuperAdmin ||
    session.isAdminKantor ||
    session.isMarketingManager ||
    session.isMarketing ||
    session.isDireksi;

  if (!hasAccess) {
    notFound();
  }

  // Fetch KPR process with relations
  const [kprData] = await db
    .select({
      id: kprTable.id,
      status: kprTable.status,
      biCheckStatus: kprTable.biCheckStatus,
      documentStatus: kprTable.documentStatus,
      slaStartAt: kprTable.slaStartAt,
      slaDeadlineAt: kprTable.slaDeadlineAt,
      bankNotes: kprTable.bankNotes,
      akadDate: kprTable.akadDate,
      realizedDate: kprTable.realizedDate,
      plafondApproved: kprTable.plafondApproved,
      createdAt: kprTable.createdAt,
      bookingId: kprTable.bookingId,
      bookingNumber: bookingsTable.bookingNumber,
      customerId: bookingsTable.customerId,
      customerName: customersTable.name,
      customerPhone: customersTable.phone,
      customerEmail: customersTable.email,
      projectName: projectsTable.name,
      unitId: bookingsTable.unitId,
      unitCode: unitsTable.code,
      unitPrice: unitsTable.price,
      unitStatus: unitsTable.status,
      isReadyStock: unitsTable.isReadyStock,
      readyStockSource: unitsTable.readyStockSource,
      constructionProgress: unitsTable.constructionProgress,
      marketingName: userTable.name,
    })
    .from(kprTable)
    .innerJoin(bookingsTable, eq(kprTable.bookingId, bookingsTable.id))
    .innerJoin(projectsTable, eq(bookingsTable.projectId, projectsTable.id))
    .innerJoin(unitsTable, eq(bookingsTable.unitId, unitsTable.id))
    .innerJoin(customersTable, eq(bookingsTable.customerId, customersTable.id))
    .leftJoin(userTable, eq(bookingsTable.marketingId, userTable.id))
    .where(eq(kprTable.id, id));

  if (!kprData) notFound();

  // Fetch bank submissions
  const bankSubmissions = await db
    .select({
      id: submissionsTable.id,
      bankPartnerId: submissionsTable.bankPartnerId,
      submissionDate: submissionsTable.submissionDate,
      status: submissionsTable.status,
      plafondAmount: submissionsTable.plafondAmount,
      interestRate: submissionsTable.interestRate,
      tenorYear: submissionsTable.tenorYear,
      bankName: bankPartnersTable.name,
    })
    .from(submissionsTable)
    .innerJoin(bankPartnersTable, eq(submissionsTable.bankPartnerId, bankPartnersTable.id))
    .where(eq(submissionsTable.kprProcessId, id));

  // Fetch customer documents
  const customerDocs = await db
    .select({
      id: documentsTable.id,
      documentType: documentsTable.documentType,
      status: documentsTable.status,
      notes: documentsTable.notes,
      fileName: attachments.fileName,
      fileUrl: attachments.fileUrl,
      mimeType: attachments.mimeType,
    })
    .from(documentsTable)
    .innerJoin(attachments, eq(documentsTable.attachmentId, attachments.id))
    .where(eq(documentsTable.customerId, kprData.customerId));

  // SLA calculation
  const now = new Date();
  let slaStatus: "safe" | "warning" | "overdue" | "none" = "none";
  let slaRemainingDays = 0;

  if (kprData.slaDeadlineAt) {
    const deadline = new Date(kprData.slaDeadlineAt);
    const diffMs = deadline.getTime() - now.getTime();
    slaRemainingDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (slaRemainingDays < 0) {
      slaStatus = "overdue";
    } else if (slaRemainingDays <= 2) {
      slaStatus = "warning";
    } else {
      slaStatus = "safe";
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Back link */}
      <Link
        href="/marketing/kpr"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors w-fit"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Pipeline KPR
      </Link>

      {/* Page Header */}
      <PageHeader
        icon={<FileText className="h-6 w-6" />}
        title={`Detail KPR — ${kprData.unitCode}`}
        description={`${kprData.customerName} · ${kprData.projectName}`}
        actions={
          <div className="flex items-center gap-3">
            <KprStatusBadge status={kprData.status} />
            {slaStatus !== "none" && <SlaIndicator status={slaStatus} days={slaRemainingDays} />}
          </div>
        }
      />

      {/* Milestone Tracker */}
      <Card className="border-border shadow-sage">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold text-foreground">
            Tahapan Proses KPR
          </CardTitle>
        </CardHeader>
        <CardContent>
          <KprMilestoneTracker
            data={{
              unitStatus: kprData.unitStatus,
              kprStatus: kprData.status,
              isReadyStock: kprData.isReadyStock,
              readyStockSource: kprData.readyStockSource,
              constructionProgress: kprData.constructionProgress ?? 0,
            }}
            orientation="horizontal"
          />
        </CardContent>
      </Card>

      {/* Detail Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Customer Info */}
        <Card className="border-border shadow-sage">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Informasi Konsumen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow label="Nama" value={kprData.customerName} />
            <DetailRow label="Telepon" value={kprData.customerPhone} />
            <DetailRow label="Email" value={kprData.customerEmail || "—"} />
            <DetailRow label="Marketing" value={kprData.marketingName || "—"} />
          </CardContent>
        </Card>

        {/* Unit Info */}
        <Card className="border-border shadow-sage">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Informasi Unit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow label="Kode Unit" value={kprData.unitCode} />
            <DetailRow label="Proyek" value={kprData.projectName} />
            <DetailRow label="Harga" value={formatRupiah(kprData.unitPrice)} />
            <DetailRow label="No. Booking" value={kprData.bookingNumber} />
          </CardContent>
        </Card>

        {/* KPR Process Info */}
        <Card className="border-border shadow-sage">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Landmark className="h-4 w-4 text-primary" />
              Proses KPR
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow label="Status" value={<KprStatusBadge status={kprData.status} />} />
            <DetailRow label="BI Check" value={<BiCheckBadge status={kprData.biCheckStatus} />} />
            <DetailRow label="Dokumen" value={<DocStatusBadge status={kprData.documentStatus} />} />
            <DetailRow label="SLA Mulai" value={formatDate(kprData.slaStartAt)} />
            <DetailRow label="SLA Deadline" value={formatDate(kprData.slaDeadlineAt)} />
            <DetailRow label="Tanggal Akad" value={formatDate(kprData.akadDate)} />
            {kprData.plafondApproved && (
              <DetailRow label="Plafond Disetujui" value={formatRupiah(kprData.plafondApproved)} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bank Submissions Table */}
      <Card className="border-border shadow-sage">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
            <Landmark className="h-4 w-4 text-primary" />
            Pengajuan Bank ({bankSubmissions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bankSubmissions.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bank</TableHead>
                    <TableHead>Tanggal Pengajuan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Plafond</TableHead>
                    <TableHead className="text-right">Tenor</TableHead>
                    <TableHead className="text-right">Bunga (%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bankSubmissions.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell className="font-medium">{sub.bankName}</TableCell>
                      <TableCell>{formatDate(sub.submissionDate)}</TableCell>
                      <TableCell>
                        <BankSubmissionStatusBadge status={sub.status} />
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {sub.plafondAmount ? formatRupiah(sub.plafondAmount) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {sub.tenorYear ? `${sub.tenorYear} thn` : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {sub.interestRate ? `${sub.interestRate}%` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground/70 text-center py-6">
              Belum ada pengajuan bank untuk KPR ini.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Documents Section */}
      <Card className="border-border shadow-sage">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Dokumen Konsumen ({customerDocs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {customerDocs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {customerDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30/50 hover:bg-muted/30 transition-colors"
                >
                  <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <DocTypeIcon mimeType={doc.mimeType} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {getDocTypeLabel(doc.documentType)}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {doc.fileName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <DocVerificationBadge status={doc.status} />
                    {doc.fileUrl && (
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-7 w-7 rounded-lg bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
                        title="Download"
                      >
                        <Download className="h-3.5 w-3.5 text-primary" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground/70 text-center py-6">
              Belum ada dokumen yang diunggah.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Helper Components ─── */

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-foreground font-medium text-right">{typeof value === "string" ? value : value}</span>
    </div>
  );
}

function KprStatusBadge({ status }: { status: string }) {
  const styleMap: Record<string, string> = {
    bi_checking: "bg-indigo-100 text-indigo-700 border-indigo-200",
    pemberkasan: "bg-amber-100 text-amber-700 border-amber-200",
    proses_bank: "bg-blue-100 text-blue-700 border-blue-200",
    offering: "bg-purple-100 text-purple-700 border-purple-200",
    approved: "bg-teal-100 text-teal-700 border-teal-200",
    rejected: "bg-rose-100 text-rose-700 border-rose-200",
    akad: "bg-emerald-100 text-emerald-700 border-emerald-200",
    realisasi: "bg-cyan-100 text-cyan-700 border-cyan-200",
  };
  const className = styleMap[status] || "bg-gray-100 text-gray-700 border-gray-200";
  return (
    <Badge variant="outline" className={`text-[10px] font-bold ${className}`}>
      {getKprStatusLabel(status)}
    </Badge>
  );
}

function BiCheckBadge({ status }: { status: string }) {
  const styleMap: Record<string, string> = {
    pending: "bg-gray-100 text-gray-600 border-gray-200",
    partial: "bg-amber-100 text-amber-700 border-amber-200",
    approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
    rejected_refund: "bg-rose-100 text-rose-700 border-rose-200",
    rejected_no_refund: "bg-rose-100 text-rose-700 border-rose-200",
  };
  const labelMap: Record<string, string> = {
    approved: "Lolos",
    rejected_refund: "Ditolak (Refund)",
    rejected_no_refund: "Ditolak",
  };
  const className = styleMap[status] || "bg-gray-100 text-gray-600 border-gray-200";
  const label = labelMap[status] || getKprStatusLabel(status);
  return (
    <Badge variant="outline" className={`text-[10px] font-bold ${className}`}>
      {label}
    </Badge>
  );
}

function DocStatusBadge({ status }: { status: string }) {
  if (status === "complete") {
    return (
      <Badge variant="outline" className="text-[10px] font-bold bg-emerald-100 text-emerald-700 border-emerald-200">
        <CheckCircle className="h-3 w-3 mr-1" />
        Lengkap
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] font-bold bg-amber-100 text-amber-700 border-amber-200">
      <Clock className="h-3 w-3 mr-1" />
      Belum Lengkap
    </Badge>
  );
}

function BankSubmissionStatusBadge({ status }: { status: string }) {
  const styleMap: Record<string, string> = {
    submitted: "bg-gray-100 text-gray-700 border-gray-200",
    verified: "bg-blue-100 text-blue-700 border-blue-200",
    offering: "bg-purple-100 text-purple-700 border-purple-200",
    approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
    rejected: "bg-rose-100 text-rose-700 border-rose-200",
  };
  const className = styleMap[status] || "bg-gray-100 text-gray-700 border-gray-200";
  return (
    <Badge variant="outline" className={`text-[10px] font-bold ${className}`}>
      {getBankSubmissionStatusLabel(status)}
    </Badge>
  );
}

function DocVerificationBadge({ status }: { status: string }) {
  if (status === "verified") {
    return <CheckCircle className="h-4 w-4 text-emerald-500" />;
  }
  if (status === "rejected") {
    return <XCircle className="h-4 w-4 text-rose-500" />;
  }
  return <Clock className="h-4 w-4 text-amber-500" />;
}

function DocTypeIcon({ mimeType }: { mimeType: string | null }) {
  if (mimeType && mimeType.startsWith("image/")) {
    return <FileImage className="h-4 w-4 text-primary" />;
  }
  return <File className="h-4 w-4 text-primary" />;
}

function SlaIndicator({ status, days }: { status: "safe" | "warning" | "overdue"; days: number }) {
  if (status === "overdue") {
    return (
      <Badge variant="outline" className="text-[10px] font-bold bg-rose-100 text-rose-700 border-rose-200 animate-pulse">
        <AlertTriangle className="h-3 w-3 mr-1" />
        SLA Lewat {Math.abs(days)} hari
      </Badge>
    );
  }
  if (status === "warning") {
    return (
      <Badge variant="outline" className="text-[10px] font-bold bg-amber-100 text-amber-700 border-amber-200">
        <Clock className="h-3 w-3 mr-1" />
        SLA {days} hari lagi
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] font-bold bg-emerald-100 text-emerald-700 border-emerald-200">
      <CheckCircle className="h-3 w-3 mr-1" />
      SLA {days} hari lagi
    </Badge>
  );
}

function getDocTypeLabel(type: string): string {
  return getDocumentVerificationStatusLabel(type);
}
