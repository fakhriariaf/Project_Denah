"use client";
import { useRouter } from "next/navigation";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ProjectForm } from "./project-form";
import { DeleteConfirm } from "@/components/delete-confirm";
import { deleteProject, forceDeleteProject } from "@/server/actions/master";
import { Building2, MapPin, Layers, LayoutGrid, CheckCircle2, AlertCircle, Info, Edit3, Trash2 } from "lucide-react";
import type { ProjectInput } from "@/server/validators/master";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

interface Project {
  id: string;
  code: string;
  name: string;
  location: string | null;
  description: string | null;
  status: string;
  publicEnabled: boolean;
  isFeaturedPublic: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

const STATUS_BADGE: Record<string, string> = {
  active: "bg-[#DDE8D8] text-[#4F6F52] border-[#4F6F52]/20",
  inactive: "bg-[#E7E9E7] text-[#5F6861] border-[#5F6861]/20",
  completed: "bg-[#DCECF7] text-[#33627A] border-[#33627A]/20",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Aktif",
  inactive: "Nonaktif",
  completed: "Selesai",
};

export function ProjectsShell({
  initialProjects,
  allUnits,
  isEditor,
  isSuperAdmin,
}: {
  initialProjects: Project[];
  allUnits: { projectId: string; status: string }[];
  isEditor: boolean;
  isSuperAdmin?: boolean;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filteredProjects = initialProjects.filter((p) => {
    const matchQ =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = !statusFilter || p.status === statusFilter;
    return matchQ && matchStatus;
  });

  const selectedProject = initialProjects.find((p) => p.id === selectedProjectId);

  return (
    <div className="flex flex-col gap-6">
      {/* ── PREMIUM HEADER ── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#DDE8D8]/70 via-white/95 to-[#DDE8D8]/40 border border-[#D6DED2] shadow-sage p-6">
        <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-[#8FAF9A]/10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 h-20 w-20 rounded-full bg-[#4F6F52]/8 blur-xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-[#4F6F52] flex items-center justify-center shadow-[0_4px_12px_rgba(79,111,82,0.3)] shrink-0">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-[#243028] tracking-tight">{t("proj.title")}</h2>
              <p className="text-sm text-[#66736A] mt-0.5">{t("proj.subtitle")}</p>
            </div>
          </div>
          {isEditor && (
            <div className="shrink-0 animate-in fade-in zoom-in-95 duration-200 self-end md:self-center">
              <ProjectForm />
            </div>
          )}
        </div>
      </div>

      {/* Main Dual Pane Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
        {/* Left Pane (Table): 65% width equivalent */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-[#D6DED2]/80 shadow-sage bg-white rounded-2xl overflow-hidden">
            <CardHeader className="pb-4 border-b border-[#D6DED2]/30">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(260px,1fr)_minmax(360px,420px)] xl:items-start">
                <div className="min-w-0">
                  <CardTitle className="text-lg font-bold">{t("proj.list_title")}</CardTitle>
                  <CardDescription className="text-xs">
                    {t("proj.list_desc")}
                  </CardDescription>
                </div>
                {/* Inline Filters */}
                <div className="flex w-full flex-col gap-2">
                  <Input
                    placeholder={t("proj.search_placeholder")}
                    className="h-9 w-full text-xs bg-[#F7F8F3]/50 border-[#D6DED2] rounded-2xl focus:bg-white transition-premium"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <div className="flex w-fit flex-wrap gap-1 bg-[#F7F8F3] p-1 rounded-2xl border border-[#D6DED2]/50">
                    {(["", "active", "inactive", "completed"] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-premium cursor-pointer ${
                          statusFilter === s || (!statusFilter && s === "")
                            ? "bg-[#4F6F52] text-white shadow-sm"
                            : "text-[#66736A] hover:bg-white/60"
                        }`}
                      >
                        {s === "" ? t("proj.all") : (s === "active" ? t("proj.status_active") : s === "inactive" ? t("proj.status_inactive") : t("proj.status_completed"))}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filteredProjects.length === 0 ? (
                <div className="py-16 text-center flex flex-col items-center justify-center">
                  <div className="h-16 w-16 rounded-full bg-[#DDE8D8]/60 flex items-center justify-center mb-3">
                    <Building2 className="h-8 w-8 text-[#4F6F52]" />
                  </div>
                  <p className="font-bold text-[#243028] text-sm">{t("proj.not_found")}</p>
                  <p className="text-xs text-[#66736A] mt-1">{t("proj.not_found_desc")}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow className="border-b border-[#D6DED2]/40 hover:bg-transparent">
                        <TableHead className="w-[120px] font-bold text-[#66736A] uppercase tracking-wider text-[11px] py-4 pl-6">{t("proj.code")}</TableHead>
                        <TableHead className="font-bold text-[#66736A] uppercase tracking-wider text-[11px] py-4">{t("proj.name")}</TableHead>
                        <TableHead className="font-bold text-[#66736A] uppercase tracking-wider text-[11px] py-4">{t("proj.location")}</TableHead>
                        <TableHead className="font-bold text-[#66736A] uppercase tracking-wider text-[11px] py-4">{t("proj.status")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProjects.map((p) => (
                        <TableRow
                          key={p.id}
                          className={`cursor-pointer border-b border-[#D6DED2]/40 transition-premium pl-6 ${
                            selectedProjectId === p.id
                              ? "bg-[#DDE8D8]/50 hover:bg-[#DDE8D8]/70 border-l-4 border-l-[#4F6F52] font-semibold"
                              : "hover:bg-[#F7F8F3]/40"
                          }`}
                          onClick={() => setSelectedProjectId(p.id)}
                        >
                          <TableCell className="font-mono text-xs text-[#4F6F52] py-4 pl-6">{p.code}</TableCell>
                          <TableCell className="text-sm font-semibold text-[#243028] py-4">{p.name}</TableCell>
                          <TableCell className="text-xs text-[#66736A] py-4">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-[#A8B0AA] shrink-0" />
                              {p.location || "-"}
                            </span>
                          </TableCell>
                          <TableCell className="py-4">
                            <Badge variant="outline" className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${STATUS_BADGE[p.status]}`}>
                              {p.status === "active" ? t("proj.status_active") : p.status === "inactive" ? t("proj.status_inactive") : t("proj.status_completed")}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Pane (Interactive Specification Board): 35% width equivalent */}
        <div className="lg:col-span-1 lg:sticky lg:top-[84px] transition-premium">
          {selectedProject ? (
            <Card className="border-[#D6DED2] shadow-sage-lg bg-white rounded-3xl overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
              {/* Header Branding */}
              <div className="bg-[#4F6F52] text-white p-6 relative overflow-hidden">
                <div className="absolute top-[-30%] right-[-10%] w-[50%] h-[150%] rounded-full bg-white/5 blur-xl pointer-events-none" />
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-[#DDE8D8]" />
                    <span className="text-[10px] font-bold tracking-wider uppercase bg-white/10 backdrop-blur-md px-2 py-0.5 rounded border border-white/10">
                      {t("proj.sheet_title")}
                    </span>
                  </div>
                  <Badge variant="outline" className="border-white/30 text-white bg-white/15 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    {selectedProject.status === "active" ? t("proj.status_active") : selectedProject.status === "inactive" ? t("proj.status_inactive") : t("proj.status_completed")}
                  </Badge>
                </div>
                <h3 className="text-xl font-bold tracking-tight text-white mt-4">{selectedProject.name}</h3>
                <p className="text-xs font-mono text-[#DDE8D8]/80 mt-1">{selectedProject.code}</p>
              </div>

              {/* Body Content */}
              <CardContent className="p-6 space-y-6">
                {/* Location */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider block">{t("proj.geo_location")}</span>
                  <div className="bg-[#F7F8F3] border border-[#D6DED2]/50 rounded-xl p-3 flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-[#4F6F52] mt-0.5 shrink-0" />
                    <span className="text-xs text-[#243028] font-medium leading-relaxed">
                      {selectedProject.location || t("proj.geo_empty")}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider block">{t("proj.desc_title")}</span>
                  <p className="text-xs text-[#66736A] leading-relaxed font-medium bg-[#F7F8F3]/50 rounded-xl p-3 border border-[#D6DED2]/30 min-h-[80px]">
                    {selectedProject.description || t("proj.desc_empty")}
                  </p>
                </div>

                {/* Real Unit Distribution from DB */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-[#66736A] uppercase tracking-wider block">{t("proj.unit_dist")}</span>
                {(() => {
                  const projectUnits = allUnits.filter(u => u.projectId === selectedProject.id);
                  const totalProjectUnits = projectUnits.length;

                  const STATUS_DIST: Record<string, { label: string; bg: string; textColor: string }> = {
                    belum_siap:        { label: t("timeline.belum_siap"),    bg: "bg-white/50 border-gray-300",            textColor: "text-gray-500" },
                    available:         { label: t("timeline.available"),      bg: "bg-[#DDE8D8]/50 border-[#8FAF9A]/30",    textColor: "text-[#4F6F52]" },
                    booking:           { label: t("timeline.booking"),       bg: "bg-[#FFF2C2]/50 border-[#E9C46A]/30",    textColor: "text-[#8A6D1D]" },
                    kpr_process:       { label: t("timeline.kpr_process"),    bg: "bg-[#DCECF7]/50 border-[#8FB8D8]/30",    textColor: "text-[#33627A]" },
                    payment_pending:   { label: t("timeline.payment_pending"), bg: "bg-[#FBE4C9]/50 border-[#FBE4C9]/60",    textColor: "text-[#9A5C21]" },
                    sold:              { label: t("timeline.sold"),       bg: "bg-[#F3D1D1]/50 border-[#D77A7A]/30",    textColor: "text-[#8A3030]" },
                    construction:      { label: t("timeline.construction"),      bg: "bg-[#E9DDF7]/50 border-[#B8A4D9]/40",    textColor: "text-[#5D4382]" },
                    construction_done: { label: t("timeline.construction_done"),       bg: "bg-[#D4EEE7]/50 border-[#7AA874]/30",    textColor: "text-[#2D5A4E]" },
                    overdue:           { label: t("timeline.overdue"),       bg: "bg-[#F8D4DA]/50 border-[#E8A0A8]/55",    textColor: "text-[#8B3443]" },
                    cancelled:         { label: t("timeline.cancelled"),         bg: "bg-[#E7E9E7]/50 border-[#A8B0AA]/40",    textColor: "text-[#5F6861]" },
                  };

                  // Count per status
                  const counts: Record<string, number> = {};
                  for (const key of Object.keys(STATUS_DIST)) counts[key] = 0;
                  projectUnits.forEach(u => { if (u.status in counts) counts[u.status]++; });

                  // Only show statuses that have > 0 units
                  const activeStatuses = Object.entries(counts).filter(([, v]) => v > 0);

                  if (totalProjectUnits === 0) {
                    return (
                      <div className="bg-[#F7F8F3] border border-[#D6DED2]/50 rounded-xl p-4 text-center">
                        <LayoutGrid className="w-5 h-5 text-[#A8B0AA] mx-auto mb-1.5" />
                        <p className="text-[10px] text-[#A8B0AA] font-medium">{t("proj.unit_empty")}</p>
                      </div>
                    );
                  }

                  return (
                    <>
                      {/* Total badge */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold text-[#4F6F52] bg-[#DDE8D8] px-2 py-0.5 rounded-full font-mono">
                          {t("proj.unit_total", { count: totalProjectUnits.toString() })}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {activeStatuses.map(([key, count]) => {
                          const cfg = STATUS_DIST[key];
                          return (
                            <div key={key} className={`border ${cfg.bg} p-2.5 rounded-xl text-center`}>
                              <p className={`text-xs font-bold ${cfg.textColor}`}>{count}</p>
                              <p className="text-[9px] font-bold text-[#66736A] mt-0.5 leading-tight">{cfg.label}</p>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()
                }
                </div>

                {/* Info Tip */}
                <div className="bg-[#DCECF7]/40 border border-[#8FB8D8]/20 p-3 rounded-xl flex gap-2">
                  <Info className="w-4 h-4 text-[#33627A] shrink-0 mt-0.5" />
                  <p className="text-[10px] text-[#33627A] leading-relaxed font-medium">
                    {t("proj.info_tip")}
                  </p>
                </div>

                {/* Actions Integrated */}
                {isEditor && (
                  <div className="pt-4 border-t border-[#D6DED2]/40 animate-in fade-in duration-200 space-y-3">
                    <div className="flex gap-2 items-center">
                      <div className="flex-1">
                        <ProjectForm
                          id={selectedProject.id}
                          initialData={{
                            code: selectedProject.code,
                            name: selectedProject.name,
                            location: selectedProject.location || undefined,
                            description: selectedProject.description || undefined,
                            status: selectedProject.status as ProjectInput["status"],
                            publicEnabled: selectedProject.publicEnabled,
                            isFeaturedPublic: selectedProject.isFeaturedPublic,
                          }}
                        />
                      </div>
                      <div className="shrink-0">
                        <DeleteConfirm
                          label={`proyek "${selectedProject.name}"`}
                          onConfirm={async () => {
                            const res = await deleteProject(selectedProject.id);
                            setSelectedProjectId(null);
                            return res;
                          }}
                        />
                      </div>
                    </div>
                    {isSuperAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs text-rose-600 border-rose-200 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 transition-all"
                        onClick={async () => {
                          const confirmed = window.confirm(
                            `⚠️ HAPUS PERMANEN: Proyek "${selectedProject.name}" beserta SEMUA data terkait (booking, pembayaran, SPK, invoice, dll) akan dihapus permanen.\n\nAksi ini TIDAK DAPAT dibatalkan.\n\nKetik OK untuk melanjutkan.`
                          );
                          if (!confirmed) return;
                          try {
                            const res = await forceDeleteProject(selectedProject.id);
                            if (res.success) {
                              toast.success(res.message);
                              setSelectedProjectId(null);
                              router.refresh();
                            }
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Gagal menghapus proyek.");
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Hapus Permanen (+ Semua Data)
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed border-2 border-[#D6DED2] bg-[#F7F8F3]/50 rounded-3xl p-8 text-center min-h-[300px] flex flex-col justify-center items-center">
              <div className="bg-[#DDE8D8] p-4 rounded-full mb-4">
                <Layers className="w-8 h-8 text-[#4F6F52]" />
              </div>
              <h4 className="text-sm font-bold text-[#243028] mb-1">{t("proj.select_title")}</h4>
              <p className="text-xs text-[#66736A] max-w-[220px] leading-relaxed mx-auto">
                {t("proj.select_desc")}
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
