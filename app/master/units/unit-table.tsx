"use client";

import { useState, useTransition, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/format-utils";
import { getStatusBadge } from "@/lib/siteplan-utils";
import { UnitForm } from "./unit-form";
import { DeleteConfirm } from "@/components/delete-confirm";
import { deleteUnit, bulkDeleteUnits } from "@/server/actions/master";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { Trash2, CheckSquare, Square, MinusSquare, AlertTriangle, Loader2 } from "lucide-react";
import type { UnitInput } from "@/server/validators/master";
import { useI18n } from "@/lib/i18n";

type UnitRow = {
  unit: {
    id: string;
    projectId: string;
    code: string;
    cluster: string | null;
    typeName: string | null;
    landArea: number;
    buildingArea: number;
    price: number;
    status: string;
    isReadyStock?: boolean;
    notes: string | null;
  };
  projectName: string | null;
};

type UnitTableProps = {
  paginated: UnitRow[];
  totalFilteredItems: number;
  itemsPerPage: number;
  isEditor: boolean;
  availableProjects: { id: string; name: string }[];
  availableVendors: { id: string; name: string }[];
};

export function UnitTable({
  paginated,
  totalFilteredItems,
  itemsPerPage,
  isEditor,
  availableProjects,
  availableVendors,
}: UnitTableProps) {
  const { t } = useI18n();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [bulkError, setBulkError] = useState<string | null>(null);

  const allPageIds = paginated.map((r) => r.unit.id);
  const allSelected = allPageIds.length > 0 && allPageIds.every((id) => selectedIds.has(id));
  const someSelected = allPageIds.some((id) => selectedIds.has(id));

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allPageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allPageIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }, [allSelected, allPageIds]);

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const confirmed = confirm(t("unit_table.delete_confirm", { count: ids.length.toString() }));
    if (!confirmed) return;

    setBulkError(null);
    startTransition(async () => {
      try {
        await bulkDeleteUnits(ids);
        setSelectedIds(new Set());
      } catch (err) {
        setBulkError(err instanceof Error ? err.message : "Gagal menghapus unit.");
      }
    });
  };

  return (
    <div className="bg-white border border-border rounded-2xl shadow-sage overflow-hidden">
      {/* Table Title Bar */}
      <div className="px-6 py-4 border-b border-border bg-muted/40">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            {t("unit_table.title")}
          </span>
          <div className="flex items-center gap-3">
            {/* Bulk Delete Action Bar */}
            {selectedIds.size > 0 && isEditor && (
              <div className="flex items-center gap-2 animate-in slide-in-from-right-2 duration-200">
                <Badge className="bg-rose-50 text-rose-700 border-rose-200 font-black text-[11px] rounded-lg px-2.5 py-1">
                  {selectedIds.size} {t("unit_table.selected")}
                </Badge>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleBulkDelete}
                  disabled={isPending}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-8 rounded-xl font-bold shadow-sm gap-1.5 px-3"
                >
                  {isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  {isPending ? t("unit_table.deleting") : t("unit_table.delete_selected")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedIds(new Set())}
                  disabled={isPending}
                  className="text-xs h-8 rounded-xl font-bold border-border text-muted-foreground hover:text-foreground px-3"
                >
                  {t("unit_table.cancel_selection")}
                </Button>
              </div>
            )}
            <span className="text-xs font-mono text-primary/70 tabular-nums">
              {totalFilteredItems} {t("unit_table.units_found")}
            </span>
          </div>
        </div>

        {/* Bulk Error Message */}
        {bulkError && (
          <div className="mt-3 flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-700 font-medium animate-in fade-in duration-200">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
            <span>{bulkError}</span>
          </div>
        )}
      </div>

      {paginated.length === 0 ? (
        <EmptyState
          title={t("unit_table.not_found")}
          description={t("unit_table.not_found_desc")}
          icon={<Square className="h-6 w-6" />}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs font-bold uppercase tracking-wider">
                {isEditor && (
                  <th className="py-3.5 px-4 w-10">
                    <button
                      type="button"
                      onClick={toggleAll}
                      className="flex items-center justify-center h-5 w-5 text-primary hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring/20 rounded"
                      title={allSelected ? t("unit_table.deselect_all") : t("unit_table.select_all")}
                    >
                      {allSelected ? (
                        <CheckSquare className="h-[18px] w-[18px]" />
                      ) : someSelected ? (
                        <MinusSquare className="h-[18px] w-[18px]" />
                      ) : (
                        <Square className="h-[18px] w-[18px] text-muted-foreground/50" />
                      )}
                    </button>
                  </th>
                )}
                <th className="py-3.5 px-6">{t("unit_table.col_project")}</th>
                <th className="py-3.5 px-6">{t("unit_table.col_block")}</th>
                <th className="py-3.5 px-6">{t("unit_table.col_type")}</th>
                <th className="py-3.5 px-6 text-right">{t("unit_table.col_area")}</th>
                <th className="py-3.5 px-6 text-right">{t("unit_table.col_price")}</th>
                <th className="py-3.5 px-6 text-center">{t("unit_table.col_status")}</th>
                {isEditor && <th className="py-3.5 px-6 text-right">{t("unit_table.col_action")}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-sm">
              {paginated.map(({ unit: u, projectName }) => {
                const isChecked = selectedIds.has(u.id);
                return (
                  <tr
                    key={u.id}
                    className={`transition-colors duration-150 group ${
                      isChecked
                        ? "bg-rose-50/50 hover:bg-rose-50/70"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    {isEditor && (
                      <td className="py-4 px-4 w-10">
                        <button
                          type="button"
                          onClick={() => toggleOne(u.id)}
                          className={`flex items-center justify-center h-5 w-5 transition-colors focus:outline-none focus:ring-2 focus:ring-ring/20 rounded ${
                            isChecked
                              ? "text-rose-600"
                              : "text-muted-foreground/50 hover:text-primary/70"
                          }`}
                        >
                          {isChecked ? (
                            <CheckSquare className="h-[18px] w-[18px]" />
                          ) : (
                            <Square className="h-[18px] w-[18px]" />
                          )}
                        </button>
                      </td>
                    )}
                    <td className="py-4 px-6 font-semibold text-foreground">
                      {projectName || "â€”"}
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-mono bg-secondary/60 text-primary px-2 py-0.5 rounded text-[11px] font-bold border border-primary/20">
                        {u.code}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-muted-foreground font-medium">
                      {u.typeName || "â€”"}
                    </td>
                    <td className="py-4 px-6 text-right font-mono text-foreground tabular-nums">
                      {u.landArea} / {u.buildingArea}
                    </td>
                    <td className="py-4 px-6 text-right font-mono font-semibold text-primary tabular-nums">
                      {formatRupiah(u.price)}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {(() => {
                        const badge = getStatusBadge(u.status, u.isReadyStock, t);
                        return (
                          <Badge
                            className={`border font-semibold text-xs ${badge.badgeClass || "bg-slate-50"} inline-flex items-center gap-1.5 w-fit mx-auto rounded-full px-2.5 py-0.5`}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: badge.dotColor }}
                            />
                            {badge.label ?? u.status}
                          </Badge>
                        );
                      })()}
                    </td>
                    {isEditor && (
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end items-center gap-2">
                          <UnitForm
                            id={u.id}
                            projects={availableProjects}
                            vendors={availableVendors}
                            initialData={{
                              projectId: u.projectId,
                              code: u.code,
                              cluster: u.cluster || undefined,
                              typeName: u.typeName || undefined,
                              landArea: u.landArea,
                              buildingArea: u.buildingArea,
                              price: u.price,
                              status: u.status as UnitInput["status"],
                              isReadyStock: u.isReadyStock || false,
                              readyStockSource: (u as any).readyStockSource || "construction_flow",
                              notes: u.notes || undefined,
                            }}
                          />
                          <DeleteConfirm
                            label={`unit "${u.code}"`}
                            onConfirm={deleteUnit.bind(null, u.id)}
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <DataTablePagination totalItems={totalFilteredItems} itemsPerPage={itemsPerPage} />
        </div>
      )}
    </div>
  );
}
