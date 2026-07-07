"use client";

import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { GitCompareArrows, BarChart3, TrendingUp, Building2, Loader2 } from "lucide-react";
import {
  getProjectComparisonData,
  type ProjectComparisonMetrics,
} from "@/server/actions/compare";

const ComparisonChart = dynamic(() => import("./comparison-chart"), {
  ssr: false,
  loading: () => (
    <div className="h-[320px] flex items-center justify-center text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin mr-2" />
      Memuat grafik...
    </div>
  ),
});

const PROJECT_COLORS = ["#4F6F52", "#8FAF9A", "#D4956A", "#6B8EAD"];

interface CompareShellProps {
  projects: { id: string; name: string }[];
}

export function CompareShell({ projects }: CompareShellProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<ProjectComparisonMetrics[] | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggleProject = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 4) return prev; // max 4
      return [...prev, id];
    });
  };

  const handleCompare = () => {
    if (selectedIds.length < 2) return;
    startTransition(async () => {
      const data = await getProjectComparisonData(selectedIds);
      setMetrics(data);
    });
  };

  const formatCurrency = (val: number) =>
    `Rp ${val.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#4F6F52] text-white shadow-sm">
          <GitCompareArrows className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold font-sans text-foreground">
            Perbandingan Proyek
          </h1>
          <p className="text-sm text-muted-foreground">
            Bandingkan metrik penjualan, pendapatan, dan konstruksi antar proyek
          </p>
        </div>
      </div>

      {/* Project Selector */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h2 className="font-semibold text-sm text-foreground">
              Pilih Proyek (2-4)
            </h2>
            <p className="text-xs text-muted-foreground">
              {selectedIds.length} dari 4 proyek dipilih
            </p>
          </div>
          <button
            onClick={handleCompare}
            disabled={selectedIds.length < 2 || isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-[#4F6F52] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#3d5940] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BarChart3 className="h-4 w-4" />
            )}
            Bandingkan
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {projects.map((project) => {
            const isSelected = selectedIds.includes(project.id);
            const colorIdx = selectedIds.indexOf(project.id);
            return (
              <button
                key={project.id}
                onClick={() => toggleProject(project.id)}
                disabled={!isSelected && selectedIds.length >= 4}
                className={`relative rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-all ${
                  isSelected
                    ? "border-[#4F6F52] bg-[#4F6F52]/10 text-foreground ring-1 ring-[#4F6F52]"
                    : "border-border bg-background text-muted-foreground hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed"
                }`}
              >
                <span className="flex items-center gap-2">
                  {isSelected && (
                    <span
                      className="inline-block h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: PROJECT_COLORS[colorIdx] || "#4F6F52" }}
                    />
                  )}
                  {project.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading skeleton */}
      {isPending && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: selectedIds.length }).map((_, i) => (
              <div key={i} className="rounded-xl border bg-card p-5 animate-pulse">
                <div className="h-4 w-24 bg-muted rounded mb-4" />
                <div className="space-y-3">
                  <div className="h-3 w-full bg-muted rounded" />
                  <div className="h-3 w-3/4 bg-muted rounded" />
                  <div className="h-3 w-1/2 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comparison Results */}
      {metrics && !isPending && (
        <div className="space-y-6">
          {/* KPI Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((m, idx) => (
              <div
                key={m.projectId}
                className="rounded-xl border bg-card p-5 shadow-sm"
                style={{ borderTopColor: PROJECT_COLORS[idx], borderTopWidth: "3px" }}
              >
                <h3 className="font-bold text-sm text-foreground mb-3 truncate">
                  {m.projectName}
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Unit</span>
                    <span className="font-semibold">{m.totalUnits}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Terjual</span>
                    <span className="font-semibold text-emerald-600">{m.unitsSold}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tersedia</span>
                    <span className="font-semibold">{m.unitsAvailable}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Velocity</span>
                    <span className="font-semibold">{m.salesVelocity} unit/bln</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Revenue</span>
                    <span className="font-semibold text-emerald-600">
                      {formatCurrency(m.totalRevenue)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Konstruksi</span>
                    <span className="font-semibold">{m.avgConstructionProgress}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bar Chart */}
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h3 className="font-bold text-sm text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#4F6F52]" />
              Perbandingan Visual
            </h3>
            <ComparisonChart metrics={metrics} colors={PROJECT_COLORS} />
          </div>

          {/* Comparison Table */}
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="p-5 border-b">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#4F6F52]" />
                Tabel Perbandingan KPI
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-3 text-left font-semibold text-muted-foreground">
                      Metrik
                    </th>
                    {metrics.map((m, idx) => (
                      <th
                        key={m.projectId}
                        className="px-4 py-3 text-right font-semibold"
                      >
                        <span className="flex items-center justify-end gap-1.5">
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: PROJECT_COLORS[idx] }}
                          />
                          <span className="truncate max-w-[120px]">{m.projectName}</span>
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <TableRow label="Total Unit" values={metrics.map((m) => String(m.totalUnits))} />
                  <TableRow label="Unit Terjual" values={metrics.map((m) => String(m.unitsSold))} highlight="max" rawValues={metrics.map((m) => m.unitsSold)} />
                  <TableRow label="Unit Booking" values={metrics.map((m) => String(m.unitsBooked))} />
                  <TableRow label="Unit Tersedia" values={metrics.map((m) => String(m.unitsAvailable))} />
                  <TableRow label="Sales Velocity (unit/bln)" values={metrics.map((m) => String(m.salesVelocity))} highlight="max" rawValues={metrics.map((m) => m.salesVelocity)} />
                  <TableRow label="Revenue Terealisasi" values={metrics.map((m) => formatCurrency(m.totalRevenue))} highlight="max" rawValues={metrics.map((m) => m.totalRevenue)} />
                  <TableRow label="Potensi Revenue" values={metrics.map((m) => formatCurrency(m.potentialRevenue))} />
                  <TableRow label="Rata-rata Harga Unit" values={metrics.map((m) => formatCurrency(m.avgUnitPrice))} />
                  <TableRow label="Progress Konstruksi" values={metrics.map((m) => `${m.avgConstructionProgress}%`)} highlight="max" rawValues={metrics.map((m) => m.avgConstructionProgress)} />
                  <TableRow label="SPK Aktif" values={metrics.map((m) => String(m.spksActive))} />
                  <TableRow label="SPK Selesai" values={metrics.map((m) => String(m.spksCompleted))} highlight="max" rawValues={metrics.map((m) => m.spksCompleted)} />
                  <TableRow label="Booking Aktif" values={metrics.map((m) => String(m.activeBookings))} />
                  <TableRow label="Booking Batal" values={metrics.map((m) => String(m.cancelledBookings))} highlight="min" rawValues={metrics.map((m) => m.cancelledBookings)} />
                  <TableRow label="Booking Selesai" values={metrics.map((m) => String(m.completedBookings))} highlight="max" rawValues={metrics.map((m) => m.completedBookings)} />
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!metrics && !isPending && (
        <div className="rounded-xl border bg-card p-12 text-center shadow-sm">
          <GitCompareArrows className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-sm text-muted-foreground">
            Pilih minimal 2 proyek dan klik &ldquo;Bandingkan&rdquo; untuk melihat perbandingan metrik
          </p>
        </div>
      )}
    </div>
  );
}

// Helper: Table row with optional highlighting
function TableRow({
  label,
  values,
  highlight,
  rawValues,
}: {
  label: string;
  values: string[];
  highlight?: "max" | "min";
  rawValues?: number[];
}) {
  let bestIdx = -1;
  if (highlight && rawValues && rawValues.length > 0) {
    if (highlight === "max") {
      const maxVal = Math.max(...rawValues);
      bestIdx = rawValues.indexOf(maxVal);
    } else {
      const minVal = Math.min(...rawValues);
      bestIdx = rawValues.indexOf(minVal);
    }
  }

  return (
    <tr className="hover:bg-muted/20 transition-colors">
      <td className="px-4 py-2.5 font-medium text-muted-foreground">{label}</td>
      {values.map((val, idx) => (
        <td
          key={idx}
          className={`px-4 py-2.5 text-right font-mono tabular-nums ${
            idx === bestIdx ? "font-bold text-emerald-600" : ""
          }`}
        >
          {val}
        </td>
      ))}
    </tr>
  );
}
