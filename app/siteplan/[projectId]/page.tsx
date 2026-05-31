import { db } from "@/db"
import { projects, siteplans, siteplanShapes, units, customers, vendors } from "@/db/schema/master"
import { user as userTable } from "@/db/schema/auth"
import { roles as rolesTable } from "@/db/schema/access"
import { leads as leadsTable, bookings as bookingsTable, kprProcesses as kprProcessesTable } from "@/db/schema/marketing"
import { invoices as invoicesTable } from "@/db/schema/finance"
import { requireAuth, getSessionRole } from "@/server/permissions"
import { getProgressPhotosForProject } from "@/server/actions/production"
import { notFound } from "next/navigation"
import { eq } from "drizzle-orm"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SiteplanViewer } from "@/components/siteplan/siteplan-viewer"
import { SiteplanEditor } from "@/components/siteplan/siteplan-editor"
import { CreateSiteplanForm } from "./create-siteplan-form"
import { SiteplanFilters } from "./siteplan-filters"
import { ImageUploadForm } from "./image-upload-form"
import { DirectUploadZone } from "./direct-upload-zone"
import { Badge } from "@/components/ui/badge"
import { STATUS_COLORS, type UnitStatus } from "@/lib/siteplan-utils"
import Link from "next/link"
import { ChevronRight, ArrowLeft, Map, Settings, Layers, SlidersHorizontal, AlertTriangle, Lock, CheckCircle2 } from "lucide-react"
import { Translate } from "@/components/translate"

export default async function SiteplanProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>
  searchParams: Promise<{ status?: string; scan?: string }>
}) {
  const activeUser = await requireAuth()
  const sessionRoleInfo = await getSessionRole(activeUser.id)
  const { isSuperAdmin: isEditor } = sessionRoleInfo
  const canBook = sessionRoleInfo.isMarketing || sessionRoleInfo.isMarketingManager || sessionRoleInfo.isSuperAdmin || sessionRoleInfo.isAdminKantor
  const canViewBooking = sessionRoleInfo.isSuperAdmin || sessionRoleInfo.isAdminKantor || sessionRoleInfo.isMarketing || sessionRoleInfo.isMarketingManager || sessionRoleInfo.isDireksi

  const { projectId } = await params
  const { status: filterStatus, scan: shouldAutoScan } = await searchParams

  const projectRows = await db.select().from(projects).where(eq(projects.id, projectId))
  const project = projectRows[0]
  if (!project) notFound()

  const siteplanList = await db.select().from(siteplans)
    .where(eq(siteplans.projectId, projectId))
    .orderBy(siteplans.createdAt)

  const unitList = await db.select().from(units).where(eq(units.projectId, projectId))

  const customersList = await db.select({
    id: customers.id,
    name: customers.name,
    phone: customers.phone,
  }).from(customers)

  const leadsList = await db.select({
    id: leadsTable.id,
    name: leadsTable.name,
    phone: leadsTable.phone,
    status: leadsTable.status,
    assignedMarketingId: leadsTable.assignedMarketingId,
  }).from(leadsTable)

  const bookingsList = await db.select({
    id: bookingsTable.id,
    unitId: bookingsTable.unitId,
    customerId: bookingsTable.customerId,
    paymentScheme: bookingsTable.paymentScheme,
    status: bookingsTable.status,
  }).from(bookingsTable)

  const invoicesList = await db.select({
    id: invoicesTable.id,
    bookingId: invoicesTable.bookingId,
    type: invoicesTable.type,
    status: invoicesTable.status,
    amount: invoicesTable.amount,
  }).from(invoicesTable).where(eq(invoicesTable.projectId, projectId))

  const kprProcessesList = await db.select().from(kprProcessesTable)

  const marketingsRaw = await db.select({
    id: userTable.id,
    name: userTable.name,
    roleName: rolesTable.name,
  })
  .from(userTable)
  .leftJoin(rolesTable, eq(userTable.roleId, rolesTable.id))
  .where(eq(userTable.status, "active"))

  const marketingsList = marketingsRaw.filter(m =>
    m.roleName === "Marketing" || m.roleName === "Marketing Manager"
  )

  // Fetch real construction progress photos for the gallery
  const progressPhotos = await getProgressPhotosForProject(projectId)

  // Fetch unit attachments (defect photos)
  const { attachments: attachmentsTable } = await import("@/db/schema/system");
  const unitAttachmentsRaw = await db
    .select()
    .from(attachmentsTable)
    .where(eq(attachmentsTable.entityType, "unit"));

  // Group by unitId
  const unitAttachments: Record<string, Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    fileSize: number | null;
    mimeType: string | null;
    createdAt: Date;
  }>> = {};

  for (const row of unitAttachmentsRaw) {
    if (!unitAttachments[row.entityId]) {
      unitAttachments[row.entityId] = [];
    }
    unitAttachments[row.entityId].push({
      id: row.id,
      fileName: row.fileName,
      fileUrl: row.fileUrl,
      fileSize: row.fileSize,
      mimeType: row.mimeType,
      createdAt: row.createdAt,
    });
  }

  // Fetch vendors for unit editing
  const availableVendors = await db.select().from(vendors).where(eq(vendors.status, "active")).orderBy(vendors.name)

  const activeSiteplan = siteplanList[0] ?? null

  const shapesRaw = activeSiteplan
    ? await db.select({ shape: siteplanShapes, unit: units })
        .from(siteplanShapes)
        .leftJoin(units, eq(siteplanShapes.unitId, units.id))
        .where(eq(siteplanShapes.siteplanId, activeSiteplan.id))
    : []

  const shapes = shapesRaw.map(({ shape, unit }) => ({
    id: shape.id,
    shapeType: shape.shapeType,
    coordinates: shape.coordinates as { x: number; y: number }[],
    label: shape.label,
    colorOverride: shape.colorOverride,
    unit: unit ? {
      id: unit.id,
      code: unit.code,
      typeName: unit.typeName,
      landArea: unit.landArea,
      buildingArea: unit.buildingArea,
      price: unit.price,
      status: unit.status,
      isReadyStock: unit.isReadyStock,
      constructionProgress: unit.constructionProgress,
      notes: unit.notes,
      cluster: unit.cluster,
      currentCustomerId: unit.currentCustomerId,
      currentBookingId: unit.currentBookingId,
      currentSpkId: unit.currentSpkId,
    } : null,
  }))

  const statusCounts = unitList.reduce<Record<string, number>>((acc, u) => {
    let key: string = u.status;
    if (u.isReadyStock) {
      if (u.status === "available") key = "available_ready_stock";
      else if (u.status === "construction") key = "construction_ready_stock";
    }
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const activeStatuses = filterStatus ? filterStatus.split(",").filter(Boolean) : []

  return (
    <div className="flex flex-col gap-5 p-1 sm:p-2">
      {/* Status Banner — hanya muncul untuk proyek non-active */}
      {project.status === "inactive" && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <div className="h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-800">Perumahan Non Aktif</p>
            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
              Proyek <strong>{project.name}</strong> saat ini berstatus <strong>Tidak Aktif</strong>. 
              Siteplan ditampilkan dalam mode <strong>view-only</strong> — tidak bisa diedit, ditambah kavling, atau dilakukan booking unit baru.
              Untuk mengaktifkan kembali, ubah status proyek di menu <strong>Master Data → Data Proyek</strong>.
            </p>
          </div>
        </div>
      )}
      {project.status === "completed" && (
        <div className="flex items-start gap-3 p-4 bg-purple-50 border border-purple-200 rounded-2xl">
          <div className="h-9 w-9 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-purple-800">Perumahan Selesai</p>
            <p className="text-xs text-purple-700 mt-0.5 leading-relaxed">
              Proyek <strong>{project.name}</strong> telah berstatus <strong>Selesai</strong>. 
              Siteplan hanya bisa dilihat (view-only) sebagai arsip. Data kavling dan booking tetap tersimpan.
            </p>
          </div>
        </div>
      )}

      {/* Premium Breadcrumb & Navigation */}
      <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between border-b border-[#D6DED2]/50 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-[#66736A] font-semibold">
            <Link 
              href="/siteplan" 
              className="hover:text-[#4F6F52] transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="h-3 w-3" />
              <Translate id="siteplan.hub" />
            </Link>
            <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
            <span className="text-[#243028] font-bold truncate max-w-[200px]">
              {project.name}
            </span>
          </div>
          
          <div className="flex items-baseline gap-2 mt-1">
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#243028]">
              {project.name}
            </h2>
            <span className="font-mono text-[10px] font-bold bg-[#DDE8D8]/50 border border-[#8FAF9A]/20 px-2 py-0.5 rounded-md text-[#4F6F52]">
              {project.code}
            </span>
          </div>
        </div>

        {/* Tombol Create Siteplan — hanya untuk proyek aktif */}
        {isEditor && project.status === "active" && (
          <div className="shrink-0 animate-fade-in mt-2 md:mt-0">
            <CreateSiteplanForm projectId={projectId} />
          </div>
        )}
        {/* View-only badge untuk non-active */}
        {project.status !== "active" && (
          <div className="shrink-0 mt-2 md:mt-0">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${
              project.status === "completed"
                ? "bg-purple-50 border-purple-200 text-purple-700"
                : "bg-amber-50 border-amber-200 text-amber-700"
            }`}>
              <Lock className="h-3.5 w-3.5" />
              View Only
            </div>
          </div>
        )}
      </div>

      {/* Aesthetic Status Summary Dashboard Panel */}
      <div className="flex flex-wrap items-center gap-2 bg-[#F7F8F3]/60 p-3 rounded-2xl border border-[#D6DED2]/60">
        <span className="text-[9px] font-bold text-[#66736A] uppercase tracking-wider block border-r border-[#D6DED2]/60 pr-3 mr-1 shrink-0">
          <Translate id="siteplan.lot_summary" />
        </span>
        <div className="flex flex-wrap gap-2 items-center flex-1">
          {Object.entries(STATUS_COLORS).map(([status, sc]) => {
            const count = statusCounts[status] ?? 0
            if (count === 0) return null
            return (
              <Badge 
                key={status} 
                variant="outline"
                style={{ backgroundColor: sc.fill, color: sc.text, borderColor: sc.stroke + "30" }}
                className="text-[10px] font-extrabold gap-1.5 px-2.5 py-1 rounded-xl transition-all hover:scale-105 shadow-sm shadow-[#4F6F52]/5 border shrink-0"
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: sc.stroke }} />
                <span>{sc.label}</span>
                <span className="font-mono bg-white/70 px-1.5 py-0.5 rounded-md text-[9px] font-black border border-black/5">{count}</span>
              </Badge>
            )
          })}
          <Badge variant="outline" className="text-[10px] font-extrabold bg-white border-[#D6DED2] text-[#243028] px-2.5 py-1 rounded-xl shrink-0">
            <Translate id="siteplan.total_units" />: {unitList.length}
          </Badge>
        </div>
      </div>

      {activeSiteplan ? (
        <Tabs defaultValue={shouldAutoScan === "true" ? "editor" : "viewer"} className="space-y-4">
          {/* Tab navigasi — editor & settings hanya untuk proyek aktif */}
          {isEditor && project.status === "active" && (
            <div className="flex items-center justify-between border-b border-[#D6DED2]/30 pb-1.5">
              <TabsList className="bg-[#DDE8D8]/30 border border-[#D6DED2]/60 p-1 rounded-2xl">
                <TabsTrigger 
                  value="viewer" 
                  className="rounded-xl px-4 py-1.5 text-xs font-bold gap-1.5 data-[state=active]:bg-white data-[state=active]:text-[#4F6F52] data-[state=active]:shadow-sm transition-all"
                >
                  <Map className="h-3.5 w-3.5" />
                  <Translate id="siteplan.tab_viewer" />
                </TabsTrigger>
                <TabsTrigger 
                  value="editor" 
                  className="rounded-xl px-4 py-1.5 text-xs font-bold gap-1.5 data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-sm transition-all"
                >
                  <Layers className="h-3.5 w-3.5" />
                  <Translate id="siteplan.tab_editor" />
                </TabsTrigger>
                <TabsTrigger 
                  value="settings" 
                  className="rounded-xl px-4 py-1.5 text-xs font-bold gap-1.5 data-[state=active]:bg-white data-[state=active]:text-slate-800 data-[state=active]:shadow-sm transition-all"
                >
                  <Settings className="h-3.5 w-3.5" />
                  <Translate id="siteplan.tab_settings" />
                </TabsTrigger>
              </TabsList>
            </div>
          )}

          <TabsContent value="viewer" className="mt-0 space-y-4 focus-visible:outline-none focus-visible:ring-0">
            {/* Filter chips with sleek pill-shaped styling */}
            <div className="bg-white p-3 rounded-2xl border border-[#D6DED2] shadow-sage">
              <SiteplanFilters currentFilter={filterStatus} />
            </div>
            
             {/* Beautiful SVG siteplan canvas */}
            <SiteplanViewer
              shapes={shapes}
              imageUrl={activeSiteplan.imageUrl}
              width={activeSiteplan.width ?? 800}
              height={activeSiteplan.height ?? 600}
              activeStatuses={activeStatuses}
              projects={[{ id: project.id, name: project.name }]}
              units={unitList.map(u => ({ id: u.id, code: u.code, projectId: u.projectId, price: u.price, status: u.status, isReadyStock: u.isReadyStock }))}
              customers={customersList}
              leads={leadsList}
              bookings={bookingsList}
              invoices={invoicesList}
              kprProcesses={kprProcessesList}
              marketings={marketingsList.length > 0 ? marketingsList : marketingsRaw.filter(m => m.roleName?.includes("Marketing"))}
              currentUser={{ id: activeUser.id, name: activeUser.name || "", role: sessionRoleInfo.role }}
              canBook={canBook}
              canViewBooking={canViewBooking}
              progressPhotos={progressPhotos}
              vendors={availableVendors}
              unitAttachments={unitAttachments}
            />
          </TabsContent>

          {isEditor && project.status === "active" && (
            <>
              <TabsContent value="editor" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                <SiteplanEditor
                  siteplanId={activeSiteplan.id}
                  existingShapes={shapes.map(s => ({
                    id: s.id,
                    coordinates: s.coordinates,
                    label: s.label,
                    unitId: s.unit?.id ?? null,
                    unit: s.unit ? { id: s.unit.id, code: s.unit.code, status: s.unit.status, isReadyStock: s.unit.isReadyStock } : null,
                  }))}
                  units={unitList.map(u => ({ id: u.id, code: u.code, status: u.status, isReadyStock: u.isReadyStock }))}
                  imageUrl={activeSiteplan.imageUrl}
                  width={activeSiteplan.width ?? 800}
                  height={activeSiteplan.height ?? 600}
                  autoScan={shouldAutoScan === "true"}
                />
              </TabsContent>

              <TabsContent value="settings" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
                <ImageUploadForm
                  siteplanId={activeSiteplan.id}
                  currentImageUrl={activeSiteplan.imageUrl}
                />
              </TabsContent>
            </>
          )}
        </Tabs>
      ) : (
        <div className="py-6">
          {/* Upload hanya untuk proyek aktif — non-active hanya tampilkan pesan */}
          {isEditor && project.status === "active" ? (
            <DirectUploadZone projectId={projectId} />
          ) : (
            <Card className="border border-[#D6DED2] shadow-sage rounded-2xl p-8 text-center max-w-md mx-auto mt-6 bg-white/95 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold text-[#243028]">
                  <Translate id="siteplan.no_active_siteplan" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-[#66736A] leading-relaxed">
                  {project.status !== "active"
                    ? "Siteplan belum dibuat untuk proyek ini. Aktifkan proyek terlebih dahulu untuk bisa menambah siteplan."
                    : <Translate id="siteplan.no_active_siteplan_desc" />
                  }
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
