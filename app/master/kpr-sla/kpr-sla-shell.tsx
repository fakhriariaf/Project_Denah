"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { FormLabel, FieldError, FormFieldGroup } from "@/components/ui/form-primitives"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  PlusCircle, Edit2, Loader2, AlertCircle, Clock, RefreshCw,
  CheckCircle2, XCircle, Settings2,
} from "lucide-react"
import { toast } from "sonner"
import { parseServerError } from "@/lib/error-parser"
import { getMeasuredStageLabel, getSlaScopeLabel } from "@/lib/label-helpers"
import { MEASURED_SLA_STAGES } from "@/server/services/kpr-sla/resolver"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SlaConfig {
  id: string
  scope: "global" | "perumahan"
  projectId: string | null
  stage: string
  workingDays: number
  isActive: boolean
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
  updatedByName?: string | null
  projectName?: string | null
}

/** Filter lingkup pada tabel Master SLA. */
type ScopeFilter = "all" | "global" | "perumahan"

/** Filter status aktif/nonaktif pada tabel Master SLA. */
type StatusFilter = "all" | "active" | "inactive"

function isScopeFilter(value: string | null | undefined): value is ScopeFilter {
  return value === "all" || value === "global" || value === "perumahan"
}

function isStatusFilter(value: string | null | undefined): value is StatusFilter {
  return value === "all" || value === "active" || value === "inactive"
}

interface Project {
  id: string
  name: string
}

interface KprSlaShellProps {
  configs: SlaConfig[]
  projectList: Project[]
  isSuperAdmin: boolean
  fetchError: string | null
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SUBMIT_TIMEOUT_MS = 30_000

const STAGE_OPTIONS = MEASURED_SLA_STAGES.map((s) => ({
  value: s,
  label: getMeasuredStageLabel(s),
}))

const SCOPE_FILTER_LABELS: Record<ScopeFilter, string> = {
  all: "Semua Lingkup",
  global: "Global",
  perumahan: "Per Perumahan",
}

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: "Semua Status",
  active: "Aktif",
  inactive: "Nonaktif",
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function KprSlaShell({ configs, projectList, isSuperAdmin, fetchError }: KprSlaShellProps) {
  const router = useRouter()

  // Filters
  const [filterScope, setFilterScope] = useState<ScopeFilter>("all")
  const [filterStage, setFilterStage] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all")

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<SlaConfig | null>(null)
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false)
  const [deactivatingConfig, setDeactivatingConfig] = useState<SlaConfig | null>(null)

  // Error / loading
  const [error, setError] = useState<string | null>(fetchError)
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    setError(fetchError)
    setRetrying(false)
  }, [fetchError])

  // Retry handler
  const handleRetry = useCallback(() => {
    setRetrying(true)
    router.refresh()
    setTimeout(() => setRetrying(false), 1000)
  }, [router])

  // Filtered data
  const filtered = configs.filter((c) => {
    if (filterScope !== "all" && c.scope !== filterScope) return false
    if (filterStage !== "all" && c.stage !== filterStage) return false
    if (filterStatus === "active" && !c.isActive) return false
    if (filterStatus === "inactive" && c.isActive) return false
    return true
  })

  const isActualEmpty = configs.length === 0
  const isFilterEmpty = !isActualEmpty && filtered.length === 0

  // Open dialog for create
  const handleAdd = () => {
    setEditingConfig(null)
    setDialogOpen(true)
  }

  // Open dialog for edit
  const handleEdit = (config: SlaConfig) => {
    setEditingConfig(config)
    setDialogOpen(true)
  }

  // Deactivate flow
  const handleDeactivate = (config: SlaConfig) => {
    setDeactivatingConfig(config)
    setDeactivateDialogOpen(true)
  }

  // Activate action
  const handleActivate = async (config: SlaConfig) => {
    try {
      const { setKprSlaConfigActive } = await import("@/server/actions/kpr-sla")
      await setKprSlaConfigActive(config.id, true)
      toast.success("Konfigurasi SLA berhasil diaktifkan")
      router.refresh()
    } catch (err: unknown) {
      toast.error(parseServerError(err))
    }
  }

  // Confirm deactivate
  const handleConfirmDeactivate = async () => {
    if (!deactivatingConfig) return
    try {
      const { setKprSlaConfigActive } = await import("@/server/actions/kpr-sla")
      await setKprSlaConfigActive(deactivatingConfig.id, false)
      toast.success("Konfigurasi SLA berhasil dinonaktifkan")
      setDeactivateDialogOpen(false)
      setDeactivatingConfig(null)
      router.refresh()
    } catch (err: unknown) {
      toast.error(parseServerError(err))
    }
  }

  // Get project name from id
  const getProjectName = (config: SlaConfig) => {
    if (config.projectName) return config.projectName
    if (!config.projectId) return "—"
    const project = projectList.find((p) => p.id === config.projectId)
    return project?.name ?? "—"
  }

  // Format date
  const formatDate = (dateStr: string) => {
    try {
      return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(dateStr))
    } catch {
      return "—"
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#DDE8D8]/70 via-white/95 to-[#DDE8D8]/40 border border-[#D6DED2] rounded-2xl p-6 shadow-sage">
        <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-[#8FAF9A]/10 blur-2xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-[#4F6F52] text-white flex items-center justify-center shadow-[0_4px_12px_rgba(79,111,82,0.3)] shrink-0">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#243028] tracking-tight">
                Data SLA KPR
              </h1>
              <p className="text-sm text-[#66736A] mt-0.5">
                Kelola target SLA per tahap proses KPR
              </p>
            </div>
          </div>
          {isSuperAdmin && (
            <Button
              onClick={handleAdd}
              disabled={Boolean(error)}
              title={error ? "Data SLA KPR belum tersedia" : undefined}
              className="btn-premium bg-[#4F6F52] hover:bg-[#3D563F] text-white gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              Tambah Konfigurasi SLA
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select
          disabled={Boolean(error)}
          value={filterScope}
          onValueChange={(v) => {
            if (isScopeFilter(v)) setFilterScope(v)
          }}
        >
          <SelectTrigger className="w-[160px] text-xs rounded-xl border border-[#D6DED2] bg-white h-9" aria-label="Filter lingkup">
            <SelectValue>{SCOPE_FILTER_LABELS[filterScope]}</SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all" className="text-xs">Semua Lingkup</SelectItem>
            <SelectItem value="global" className="text-xs">Global</SelectItem>
            <SelectItem value="perumahan" className="text-xs">Per Perumahan</SelectItem>
          </SelectContent>
        </Select>

        <Select disabled={Boolean(error)} value={filterStage} onValueChange={(v) => setFilterStage(v ?? "all")}>
          <SelectTrigger className="w-[160px] text-xs rounded-xl border border-[#D6DED2] bg-white h-9" aria-label="Filter tahap">
            <SelectValue>
              {filterStage === "all"
                ? "Semua Tahap"
                : STAGE_OPTIONS.find((option) => option.value === filterStage)?.label ?? "Semua Tahap"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all" className="text-xs">Semua Tahap</SelectItem>
            {STAGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          disabled={Boolean(error)}
          value={filterStatus}
          onValueChange={(v) => {
            if (isStatusFilter(v)) setFilterStatus(v)
          }}
        >
          <SelectTrigger className="w-[140px] text-xs rounded-xl border border-[#D6DED2] bg-white h-9" aria-label="Filter status">
            <SelectValue>{STATUS_FILTER_LABELS[filterStatus]}</SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="all" className="text-xs">Semua Status</SelectItem>
            <SelectItem value="active" className="text-xs">Aktif</SelectItem>
            <SelectItem value="inactive" className="text-xs">Nonaktif</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Error state */}
      {error && (
        <div role="alert" className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Data SLA KPR belum dapat dimuat</p>
            <p className="mt-0.5 text-xs font-medium leading-relaxed">{error}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            disabled={retrying}
            className="gap-1.5 text-xs rounded-lg"
          >
            {retrying && <Loader2 className="h-3 w-3 animate-spin" />}
            Coba Lagi
          </Button>
        </div>
      )}

      {/* Table */}
      {!error && (
        <div className="bg-white border border-[#D6DED2] rounded-2xl overflow-hidden shadow-sage">
          <div className="px-6 py-3.5 border-b border-[#D6DED2] bg-[#F7F8F3]/70">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#66736A] uppercase tracking-wider">
                Daftar Konfigurasi SLA
              </span>
              <span className="text-xs font-mono text-[#8FAF9A] tabular-nums">
                {filtered.length} konfigurasi
              </span>
            </div>
          </div>

          {/* Empty states */}
          {isActualEmpty && (
            <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-14 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary/70 text-secondary-foreground">
                <Clock className="h-8 w-8" aria-hidden="true" />
              </div>
              <p className="text-base font-bold text-foreground">
                Data SLA KPR belum dikonfigurasi
              </p>
              <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Tambahkan target SLA untuk setiap tahap KPR. Selama belum ada
                konfigurasi aktif, sistem tetap menggunakan SLA legacy.
              </p>
              {!isSuperAdmin && (
                <p className="mt-4 text-xs font-medium text-muted-foreground">
                  Hubungi Super Admin untuk menambahkan konfigurasi SLA.
                </p>
              )}
            </div>
          )}

          {isFilterEmpty && (
            <div className="py-16 text-center">
              <div className="h-16 w-16 rounded-full bg-[#DDE8D8]/60 flex items-center justify-center mx-auto mb-4">
                <Settings2 className="h-8 w-8 text-[#8FAF9A]" />
              </div>
              <p className="font-bold text-[#243028]">
                Tidak ada konfigurasi SLA yang sesuai dengan filter
              </p>
              <p className="text-xs text-[#66736A] mt-1">
                Coba ubah filter untuk melihat konfigurasi lainnya
              </p>
            </div>
          )}

          {/* Table content */}
          {filtered.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="table">
                <thead>
                  <tr className="border-b border-[#D6DED2] bg-[#F7F8F3]/50">
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-[#66736A] uppercase tracking-wider">Lingkup</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-[#66736A] uppercase tracking-wider">Perumahan</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-[#66736A] uppercase tracking-wider">Tahap KPR</th>
                    <th className="px-4 py-3 text-right text-[10px] font-bold text-[#66736A] uppercase tracking-wider">Target SLA (Hari Kerja)</th>
                    <th className="px-4 py-3 text-center text-[10px] font-bold text-[#66736A] uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-[#66736A] uppercase tracking-wider">Diperbarui Oleh</th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold text-[#66736A] uppercase tracking-wider">Terakhir Diperbarui</th>
                    {isSuperAdmin && (
                      <th className="px-4 py-3 text-center text-[10px] font-bold text-[#66736A] uppercase tracking-wider">Aksi</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D6DED2]/60">
                  {filtered.map((config) => (
                    <tr key={config.id} className="hover:bg-[#F7F8F3]/60 transition-colors">
                      <td className="px-4 py-3 text-xs text-[#243028]">
                        {getSlaScopeLabel(config.scope)}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#243028]">
                        {config.scope === "perumahan" ? getProjectName(config) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#243028] font-medium">
                        {getMeasuredStageLabel(config.stage)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-xs text-[#243028] font-bold">
                        {config.workingDays}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <Badge className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          config.isActive
                            ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                            : "bg-slate-50 border-slate-200 text-slate-500"
                        }`}>
                          {config.isActive ? (
                            <><CheckCircle2 className="h-3 w-3 mr-1 inline" />Aktif</>
                          ) : (
                            <><XCircle className="h-3 w-3 mr-1 inline" />Nonaktif</>
                          )}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#66736A]">
                        {config.updatedByName ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#66736A] font-mono tabular-nums">
                        {formatDate(config.updatedAt)}
                      </td>
                      {isSuperAdmin && (
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(config)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-[#4F6F52]"
                              aria-label={`Ubah konfigurasi ${getMeasuredStageLabel(config.stage)}`}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            {config.isActive ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeactivate(config)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-amber-600"
                                aria-label={`Nonaktifkan konfigurasi ${getMeasuredStageLabel(config.stage)}`}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleActivate(config)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-emerald-600"
                                aria-label={`Aktifkan konfigurasi ${getMeasuredStageLabel(config.stage)}`}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <SlaConfigDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingConfig={editingConfig}
        projectList={projectList}
        onSuccess={() => {
          setDialogOpen(false)
          router.refresh()
        }}
      />

      {/* Deactivate Confirmation Dialog */}
      <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border border-[#D6DED2]">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-[#243028]">
              Nonaktifkan Konfigurasi SLA
            </DialogTitle>
            <DialogDescription className="text-sm text-[#66736A]">
              Menonaktifkan konfigurasi ini akan membuat tahap{" "}
              <span className="font-semibold">
                {deactivatingConfig ? getMeasuredStageLabel(deactivatingConfig.stage) : ""}
              </span>{" "}
              menggunakan konfigurasi fallback (global atau legacy). Lanjutkan?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setDeactivateDialogOpen(false)}
              className="rounded-xl text-xs h-9"
            >
              Batal
            </Button>
            <Button
              onClick={handleConfirmDeactivate}
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs h-9"
            >
              Nonaktifkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── SLA Config Dialog ────────────────────────────────────────────────────────

interface SlaConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingConfig: SlaConfig | null
  projectList: Project[]
  onSuccess: () => void
}

function SlaConfigDialog({ open, onOpenChange, editingConfig, projectList, onSuccess }: SlaConfigDialogProps) {
  const isEdit = !!editingConfig

  // Form state
  const [scope, setScope] = useState<"global" | "perumahan">("global")
  const [projectId, setProjectId] = useState<string>("")
  const [stage, setStage] = useState<string>("")
  const [workingDays, setWorkingDays] = useState<string>("")
  const [isActive, setIsActive] = useState(true)

  // Submission state
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [timedOut, setTimedOut] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset form when dialog opens/closes or editing config changes
  useEffect(() => {
    if (open) {
      if (editingConfig) {
        setScope(editingConfig.scope)
        setProjectId(editingConfig.projectId ?? "")
        setStage(editingConfig.stage)
        setWorkingDays(String(editingConfig.workingDays))
        setIsActive(editingConfig.isActive)
      } else {
        setScope("global")
        setProjectId("")
        setStage("")
        setWorkingDays("")
        setIsActive(true)
      }
      setErrorMsg(null)
      setFieldErrors({})
      setTimedOut(false)
    }
  }, [open, editingConfig])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  // Client-side validation
  const validate = (): boolean => {
    const errors: Record<string, string> = {}
    if (!stage) errors.stage = "Tahap KPR wajib dipilih"
    const days = parseInt(workingDays, 10)
    if (!workingDays || isNaN(days)) {
      errors.workingDays = "Target SLA (Hari Kerja) wajib diisi"
    } else if (!Number.isInteger(days) || days < 1) {
      errors.workingDays = "Target SLA minimal 1 Hari Kerja"
    } else if (days > 60) {
      errors.workingDays = "Target SLA maksimal 60 Hari Kerja"
    }
    if (scope === "perumahan" && !projectId) {
      errors.projectId = "Perumahan wajib dipilih"
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    setErrorMsg(null)
    setTimedOut(false)

    // 30-second timeout
    timeoutRef.current = setTimeout(() => {
      setSubmitting(false)
      setTimedOut(true)
    }, SUBMIT_TIMEOUT_MS)

    try {
      const payload = {
        scope,
        projectId: scope === "global" ? null : projectId,
        stage,
        workingDays: parseInt(workingDays, 10),
        isActive,
      }

      if (isEdit && editingConfig) {
        const { updateKprSlaConfig } = await import("@/server/actions/kpr-sla")
        await updateKprSlaConfig(editingConfig.id, payload)
        toast.success("Konfigurasi SLA berhasil diperbarui")
      } else {
        const { createKprSlaConfig } = await import("@/server/actions/kpr-sla")
        await createKprSlaConfig(payload)
        toast.success("Konfigurasi SLA berhasil ditambahkan")
      }

      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setSubmitting(false)
      onSuccess()
    } catch (err: unknown) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setSubmitting(false)
      setErrorMsg(parseServerError(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-3xl bg-white/98 backdrop-blur-md border border-[#D6DED2] shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden font-sans">
        <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-[#D6DED2]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/80 border border-[#D6DED2] flex items-center justify-center shadow-sm">
                <Clock className="h-5 w-5 text-[#4F6F52]" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-[#243028] tracking-tight">
                  {isEdit ? "Ubah Konfigurasi SLA" : "Tambah Konfigurasi SLA"}
                </DialogTitle>
                <DialogDescription className="text-xs text-[#66736A] mt-1">
                  {isEdit
                    ? "Perbarui target SLA untuk tahap KPR"
                    : "Tentukan target SLA baru untuk tahap KPR"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
          {errorMsg && (
            <div role="alert" className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold rounded-xl">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {errorMsg}
            </div>
          )}

          {timedOut && (
            <div role="alert" className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-xl">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              Penyimpanan belum selesai; periksa koneksi lalu coba lagi
            </div>
          )}

          {/* Scope */}
          <FormFieldGroup>
            <FormLabel required>Lingkup</FormLabel>
            <Select value={scope} onValueChange={(v) => {
              setScope(v as "global" | "perumahan")
              if (v === "global") setProjectId("")
            }}>
              <SelectTrigger className="w-full text-xs rounded-xl border border-input bg-card h-9 focus-visible:ring-2 focus-visible:ring-ring">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="global" className="text-xs">Global</SelectItem>
                <SelectItem value="perumahan" className="text-xs">Per Perumahan</SelectItem>
              </SelectContent>
            </Select>
          </FormFieldGroup>

          {/* Project (only when scope = perumahan) */}
          {scope === "perumahan" && (
            <FormFieldGroup>
              <FormLabel required>Perumahan</FormLabel>
              <Select value={projectId} onValueChange={(v) => setProjectId(v ?? "")}>
                <SelectTrigger
                  className={`w-full text-xs rounded-xl border bg-card h-9 focus-visible:ring-2 focus-visible:ring-ring ${
                    fieldErrors.projectId ? "border-destructive" : "border-input"
                  }`}
                  aria-invalid={!!fieldErrors.projectId}
                >
                  <SelectValue placeholder="Pilih perumahan..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-60">
                  {projectList.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError>{fieldErrors.projectId}</FieldError>
            </FormFieldGroup>
          )}

          {/* Stage */}
          <FormFieldGroup>
            <FormLabel required>Tahap KPR</FormLabel>
            <Select value={stage} onValueChange={(v) => setStage(v ?? "")}>
              <SelectTrigger
                className={`w-full text-xs rounded-xl border bg-card h-9 focus-visible:ring-2 focus-visible:ring-ring ${
                  fieldErrors.stage ? "border-destructive" : "border-input"
                }`}
                aria-invalid={!!fieldErrors.stage}
              >
                <SelectValue placeholder="Pilih tahap..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {STAGE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError>{fieldErrors.stage}</FieldError>
          </FormFieldGroup>

          {/* Working Days */}
          <FormFieldGroup>
            <FormLabel htmlFor="workingDays" required>Target SLA (Hari Kerja)</FormLabel>
            <Input
              id="workingDays"
              type="number"
              min={1}
              max={60}
              value={workingDays}
              onChange={(e) => setWorkingDays(e.target.value)}
              placeholder="1-60"
              aria-invalid={!!fieldErrors.workingDays}
              className={`bg-card rounded-xl text-xs h-9 font-mono tabular-nums focus-visible:ring-2 focus-visible:ring-ring ${
                fieldErrors.workingDays ? "border-destructive" : "border-input"
              }`}
            />
            <FieldError>{fieldErrors.workingDays}</FieldError>
          </FormFieldGroup>

          {/* Footer */}
          <DialogFooter className="pt-4 gap-2 border-t border-border mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs h-9"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground btn-premium h-9 rounded-xl font-bold text-xs px-4 gap-2"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
