"use client";

import * as React from "react";
import { useState, useCallback, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Calendar, Phone, Sparkles } from "lucide-react";
import { useBulkSelection } from "@/hooks/use-bulk-selection";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { BulkDeleteConfirmDialog } from "@/components/ui/bulk-delete-confirm-dialog";
import { bulkDelete, bulkExport } from "@/server/actions/bulk";
import { handleActionResult } from "@/lib/action-utils";
import { formatDate } from "@/lib/format-utils";
import { Translate } from "@/components/translate";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
// Dialog imports — instantiated here in Client Component to avoid Server→Client function prop error
import AddFollowupDialog from "@/app/marketing/leads/add-followup-dialog";
import EditLeadDialog from "@/app/marketing/leads/edit-lead-dialog";
import { DeleteConfirm } from "@/components/delete-confirm";
import { deleteLead } from "@/server/actions/marketing";

export interface LeadRow {
  id: string;
  name: string;
  phone: string;
  source: string;
  status: string;
  notes: string | null;
  createdAt: Date | null;
  assignedMarketingId: string | null;
  interestedProjectId: string | null;
  interestedUnitId: string | null;
  projectName: string | null;
  unitCode: string | null;
  marketingName: string | null;
  customerId: string | null;
}

interface LeadsTableClientProps {
  leads: LeadRow[];
  /** Whether user has role to perform bulk delete (Super Admin / Admin Kantor) */
  canBulkDelete: boolean;
  /** Total filtered items for display */
  totalFilteredItems: number;
  /** Total leads for display */
  totalLeads: number;
  /** Whether mine filter is active */
  mineFilter: boolean;
  /** Whether user is basic marketing */
  isBiasaRole: boolean;
  /** Render function for action buttons */
  renderActions?: (lead: LeadRow) => React.ReactNode;
  /** Data props for action dialogs — replaces renderActions function to fix Server→Client serialization error */
  dialogData?: {
    projects: { id: string; name: string; code: string; [key: string]: unknown }[];
    marketings: { id: string; name: string; email: string; roleId: string | null; roleName: string | null; supervisorId: string | null }[];
    currentUser: { id: string; name: string };
    currentUserRole: {
      role: string;
      isSuperAdmin: boolean;
      isAdminKantor: boolean;
      isMarketingManager: boolean;
      isMarketing: boolean;
      isKeuangan: boolean;
      isDireksi: boolean;
      isPengawas: boolean;
      isViewer: boolean;
      isEditor: boolean;
      isVendor: boolean;
    };
    canEdit: boolean;
    canDelete: boolean;
  };
}

const statusMap: Record<string, { bg: string; dot: string; label: string }> = {
  new: { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", label: "Baru" },
  contacted: { bg: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500", label: "Dihubungi" },
  follow_up: { bg: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500", label: "Follow Up" },
  converted: { bg: "bg-secondary text-primary border-primary/40", dot: "bg-primary", label: "Deal ✓" },
  lost: { bg: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500", label: "Tidak Jadi" },
};

export function LeadsTableClient({
  leads,
  canBulkDelete,
  totalFilteredItems,
  totalLeads,
  mineFilter,
  isBiasaRole,
  renderActions,
  dialogData,
}: LeadsTableClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const {
    selectedIds,
    toggleItem,
    togglePage,
    clearSelection,
    isSelected,
    selectedCount,
  } = useBulkSelection();

  // Get page item IDs for "select all" on current page
  const pageIds = leads.map((l) => l.id);

  // Check if all items on this page are selected
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => isSelected(id));

  // Handle export
  const handleExport = useCallback(async () => {
    setIsProcessing(true);
    try {
      const result = await bulkExport({
        entityType: "lead",
        ids: Array.from(selectedIds),
      });

      if (handleActionResult(result, { successMessage: `${result.success ? (result.data as { rowCount: number }).rowCount : 0} lead berhasil diekspor` })) {
        // Decode base64 and trigger download
        const data = (result as { success: true; data: { fileBase64: string; fileName: string; rowCount: number } }).data;
        const byteCharacters = atob(data.fileBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        clearSelection();
      }
    } catch {
      toast.error("Operasi gagal. Tidak ada data yang berubah.");
      clearSelection();
    } finally {
      setIsProcessing(false);
    }
  }, [selectedIds, clearSelection]);

  // Handle delete confirmation
  const handleDeleteConfirm = useCallback(async () => {
    setIsProcessing(true);
    try {
      const result = await bulkDelete({
        entityType: "lead",
        ids: Array.from(selectedIds),
      });

      if (result.success) {
        const { deleted, skipped } = result.data;
        let msg = `${deleted} lead berhasil dihapus.`;
        if (skipped.length > 0) {
          msg += ` ${skipped.length} item dilewati.`;
        }
        toast.success(msg);
        clearSelection();
        setShowDeleteDialog(false);
        startTransition(() => {
          router.refresh();
        });
      } else {
        toast.error(result.error, { duration: 6000 });
        clearSelection();
        setShowDeleteDialog(false);
      }
    } catch {
      toast.error("Operasi gagal. Tidak ada data yang berubah.");
      clearSelection();
      setShowDeleteDialog(false);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedIds, clearSelection, router]);

  return (
    <>
      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedCount}
        onExport={handleExport}
        onDelete={canBulkDelete ? () => setShowDeleteDialog(true) : undefined}
        isProcessing={isProcessing || isPending}
        className="mb-3"
      />

      {/* Data Table */}
      <div className="bg-card border border-border rounded-2xl shadow-sage overflow-hidden">
        {/* Table Header */}
        <div className="px-6 py-3.5 border-b border-border bg-muted/30/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <Translate namespace="lead" translationKey="list_title" />
              {mineFilter && !isBiasaRole && (
                <span className="ml-2 text-primary bg-secondary px-2 py-0.5 rounded-full normal-case font-semibold">
                  <Translate namespace="lead" translationKey="filter_mine" />
                </span>
              )}
            </span>
            <span className="text-xs font-mono text-primary/70 tabular-nums">
              <Translate
                namespace="lead"
                translationKey="list_subtitle"
                values={{ filtered: totalFilteredItems.toString(), total: totalLeads.toString() }}
              />
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs font-bold uppercase tracking-wider">
                {/* Checkbox column */}
                <th className="py-3 px-3 w-10">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={() => togglePage(pageIds)}
                    className="h-4 w-4 rounded border-[#B7CDB3] text-primary focus:ring-ring cursor-pointer"
                    aria-label="Pilih semua di halaman ini"
                  />
                </th>
                <th className="py-3 px-6">
                  <Translate namespace="lead" translationKey="col_prospect" />
                </th>
                <th className="py-3 px-6">
                  <Translate namespace="lead" translationKey="col_source_interest" />
                </th>
                <th className="py-3 px-6">
                  <Translate namespace="lead" translationKey="col_marketing" />
                </th>
                <th className="py-3 px-6 text-center">
                  <Translate namespace="lead" translationKey="col_status" />
                </th>
                <th className="py-3 px-6">
                  <Translate namespace="lead" translationKey="col_date" />
                </th>
                <th className="py-3 px-6 text-right">
                  <Translate namespace="lead" translationKey="col_action" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D6DED2]/60">
              {leads.length > 0 ? (
                leads.map((lead) => {
                  const statusInfo = statusMap[lead.status] || {
                    bg: "bg-slate-50 text-slate-600 border-slate-200",
                    dot: "bg-slate-400",
                    label: lead.status,
                  };
                  const selected = isSelected(lead.id);

                  return (
                    <tr
                      key={lead.id}
                      className={`hover:bg-muted/30/80 transition-colors duration-150 group ${
                        selected ? "bg-secondary/30" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-4 px-3">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleItem(lead.id)}
                          className="h-4 w-4 rounded border-[#B7CDB3] text-primary focus:ring-ring cursor-pointer"
                          aria-label={`Pilih lead ${lead.name}`}
                        />
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 rounded-full bg-secondary text-primary flex items-center justify-center font-bold text-xs shrink-0 border border-primary/20">
                            {lead.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="space-y-0.5">
                            <div className="font-semibold text-foreground text-sm">
                              {lead.name}
                            </div>
                            <div className="flex items-center text-xs text-muted-foreground font-mono">
                              <Phone className="h-3 w-3 mr-1 text-primary/70" />{" "}
                              {lead.phone}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-0.5">
                          <div className="text-sm font-semibold text-foreground">
                            {lead.projectName || (
                              <span className="text-muted-foreground/70 italic font-normal">
                                <Translate
                                  namespace="lead"
                                  translationKey="unassigned_project"
                                />
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                            {lead.unitCode && (
                              <span className="font-mono bg-secondary/60 text-primary px-1.5 py-0.5 rounded text-[10px] font-semibold border border-primary/20">
                                {lead.unitCode}
                              </span>
                            )}
                            <span className="text-muted-foreground/70">•</span>
                            <span className="font-medium">
                              <Translate
                                namespace="lead"
                                translationKey={`source_${lead.source}`}
                              />
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          {lead.marketingName ? (
                            <>
                              <div className="h-6 w-6 rounded-full bg-secondary text-primary flex items-center justify-center text-[9px] font-bold shrink-0">
                                {lead.marketingName.slice(0, 2).toUpperCase()}
                              </div>
                              <span className="text-sm font-medium text-foreground">
                                {lead.marketingName}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground/70 italic">
                              <Translate
                                namespace="lead"
                                translationKey="unassigned_marketing"
                              />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <Badge
                          className={`border font-semibold text-xs ${statusInfo.bg} flex items-center gap-1.5 w-fit mx-auto`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${statusInfo.dot} shrink-0`}
                          />
                          <Translate
                            namespace="lead"
                            translationKey={`status_${lead.status}`}
                          />
                        </Badge>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5 text-primary/70" />
                          <span className="font-mono">
                            {lead.createdAt ? formatDate(lead.createdAt) : "-"}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* BUG FIX: Dialogs instantiated here in Client Component instead of
                              passing renderActions function from Server Component (caused serialization error) */}
                          {dialogData ? (
                            <>
                              <AddFollowupDialog lead={lead} />
                              {dialogData.canEdit && (
                                <EditLeadDialog
                                  lead={lead}
                                  projects={dialogData.projects}
                                  marketings={dialogData.marketings}
                                  currentUser={dialogData.currentUser}
                                  currentUserRole={dialogData.currentUserRole}
                                />
                              )}
                              {dialogData.canDelete && (
                                <DeleteConfirm
                                  onConfirm={() => deleteLead(lead.id)}
                                  label={`lead "${lead.name}"`}
                                />
                              )}
                            </>
                          ) : renderActions?.(lead)}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-16 w-16 rounded-full bg-secondary/50 flex items-center justify-center">
                        <Sparkles className="h-8 w-8 text-primary/70" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">
                          <Translate
                            namespace="lead"
                            translationKey="not_found"
                          />
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          <Translate
                            namespace="lead"
                            translationKey="not_found_desc_1"
                          />
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <BulkDeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        count={selectedCount}
        onConfirm={handleDeleteConfirm}
        isProcessing={isProcessing}
      />
    </>
  );
}
