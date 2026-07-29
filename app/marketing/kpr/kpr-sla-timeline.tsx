"use client";

/**
 * KPR SLA Timeline Component
 *
 * Menampilkan Timeline_SLA terbaru→terlama pada Detail_KPR.
 * Memuat data dari server action `getKprSlaTimeline` saat mount.
 *
 * Fallback states:
 * - Tracking tersedia → render list kunjungan
 * - Tidak ada tracking, legacy valid → "Data SLA Legacy"
 * - Tidak ada tracking, tidak ada legacy → "Belum Ada SLA"
 * - Legacy invalid → "Data SLA Lama Tidak Valid"
 *
 * **Validates: Requirements 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8, 15.9**
 */

import { useState, useEffect } from "react";
import { Clock, AlertCircle, Info, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getKprSlaTimeline, type TimelineVisitRow } from "@/server/actions/kpr-sla";
import {
  getMeasuredStageLabel,
  getSlaStatusLabel,
  getSlaSourceLabel,
} from "@/lib/label-helpers";

interface KprSlaTimelineProps {
  kprProcessId: string;
  /** Legacy SLA start from kpr_processes.sla_start_at */
  legacySlaStartAt: Date | string | null;
  /** Legacy SLA deadline from kpr_processes.sla_deadline_at */
  legacySlaDeadlineAt: Date | string | null;
}

type TimelineState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "visits"; data: TimelineVisitRow[] }
  | { kind: "legacy"; startAt: Date; deadlineAt: Date }
  | { kind: "empty" }
  | { kind: "legacy_invalid" };

export function KprSlaTimeline({
  kprProcessId,
  legacySlaStartAt,
  legacySlaDeadlineAt,
}: KprSlaTimelineProps) {
  const [state, setState] = useState<TimelineState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState({ kind: "loading" });
      const result = await getKprSlaTimeline(kprProcessId);

      if (cancelled) return;

      if (!result.success) {
        setState({ kind: "error", message: result.error || "Gagal memuat timeline." });
        return;
      }

      const visits = result.data ?? [];

      if (visits.length > 0) {
        setState({ kind: "visits", data: visits });
        return;
      }

      // No tracking visits — check legacy fallback
      if (legacySlaStartAt && legacySlaDeadlineAt) {
        const start = new Date(legacySlaStartAt);
        const deadline = new Date(legacySlaDeadlineAt);
        if (isNaN(start.getTime()) || isNaN(deadline.getTime())) {
          setState({ kind: "legacy_invalid" });
        } else {
          setState({ kind: "legacy", startAt: start, deadlineAt: deadline });
        }
        return;
      }

      // No tracking, no valid legacy
      if (legacySlaStartAt || legacySlaDeadlineAt) {
        // partial legacy data that can't be parsed
        const start = legacySlaStartAt ? new Date(legacySlaStartAt) : null;
        const deadline = legacySlaDeadlineAt ? new Date(legacySlaDeadlineAt) : null;
        if (
          (start && isNaN(start.getTime())) ||
          (deadline && isNaN(deadline.getTime()))
        ) {
          setState({ kind: "legacy_invalid" });
          return;
        }
      }

      setState({ kind: "empty" });
    }

    load();
    return () => { cancelled = true; };
  }, [kprProcessId, legacySlaStartAt, legacySlaDeadlineAt]);

  return (
    <div className="bg-card rounded-3xl p-5 border border-border shadow-sm space-y-4">
      <h4 className="text-xs font-black text-foreground uppercase tracking-wider flex items-center gap-2 border-b border-border/40 pb-3">
        <History className="h-4.5 w-4.5 text-primary" />
        Timeline SLA
      </h4>

      {state.kind === "loading" && <TimelineLoading />}
      {state.kind === "error" && <TimelineError message={state.message} />}
      {state.kind === "visits" && <TimelineVisitsList visits={state.data} />}
      {state.kind === "legacy" && (
        <TimelineLegacyFallback startAt={state.startAt} deadlineAt={state.deadlineAt} />
      )}
      {state.kind === "empty" && <TimelineEmpty />}
      {state.kind === "legacy_invalid" && <TimelineLegacyInvalid />}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function TimelineLoading() {
  return (
    <div className="py-8 flex flex-col items-center justify-center gap-2 text-muted-foreground/60">
      <Clock className="h-8 w-8 animate-pulse" />
      <p className="text-xs font-semibold">Memuat timeline SLA...</p>
    </div>
  );
}

function TimelineError({ message }: { message: string }) {
  return (
    <div className="py-6 flex flex-col items-center justify-center gap-2 text-rose-600">
      <AlertCircle className="h-8 w-8" />
      <p className="text-xs font-bold">{message}</p>
    </div>
  );
}

function TimelineEmpty() {
  return (
    <div className="py-8 flex flex-col items-center justify-center gap-2 text-muted-foreground/60">
      <Info className="h-8 w-8" />
      <p className="text-xs font-bold">Belum Ada SLA</p>
      <p className="text-[10px] text-muted-foreground/50">
        Riwayat SLA belum tersedia untuk proses KPR ini.
      </p>
    </div>
  );
}

function TimelineLegacyInvalid() {
  return (
    <div className="py-6 flex flex-col items-center justify-center gap-2 text-amber-600">
      <AlertCircle className="h-8 w-8" />
      <p className="text-xs font-bold">Data SLA Lama Tidak Valid</p>
      <p className="text-[10px] text-muted-foreground/60">
        Data SLA legacy tidak dapat dirender karena format tidak valid.
      </p>
    </div>
  );
}

function TimelineLegacyFallback({
  startAt,
  deadlineAt,
}: {
  startAt: Date;
  deadlineAt: Date;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <Badge
          variant="outline"
          className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] font-black px-2 py-0.5 rounded-full"
        >
          Data SLA Legacy
        </Badge>
      </div>
      <div className="bg-muted/30 rounded-2xl border border-border/50 p-4 space-y-2">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
              Mulai
            </span>
            <p className="text-xs font-bold tabular-nums">
              {formatDateTime(startAt)}
            </p>
          </div>
          <div>
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
              Tenggat
            </span>
            <p className="text-xs font-bold tabular-nums">
              {formatDateTime(deadlineAt)}
            </p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground/70 italic mt-2">
          Data ini berasal dari sistem SLA lama. Tracking kunjungan per tahap
          belum tersedia.
        </p>
      </div>
    </div>
  );
}

function TimelineVisitsList({ visits }: { visits: TimelineVisitRow[] }) {
  return (
    <div className="space-y-3">
      {visits.map((visit) => (
        <TimelineVisitItem key={visit.id} visit={visit} />
      ))}
    </div>
  );
}

function TimelineVisitItem({ visit }: { visit: TimelineVisitRow }) {
  const isActive = visit.status === "active";

  // Compute approximate duration in calendar days
  const now = new Date();
  const enteredAt = new Date(visit.enteredAt);
  const exitedAt = visit.exitedAt ? new Date(visit.exitedAt) : now;
  const durationMs = exitedAt.getTime() - enteredAt.getTime();
  const durationDays = Math.max(0, Math.ceil(durationMs / (1000 * 60 * 60 * 24)));

  // Result label
  const resultLabel = getSlaStatusLabel(visit.slaResult);

  // Result badge styling
  const resultClasses = visit.slaResult === "selesai_tepat_waktu"
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : visit.slaResult === "selesai_terlambat"
    ? "bg-rose-50 text-rose-700 border-rose-200"
    : isActive
    ? "bg-blue-50 text-blue-700 border-blue-200"
    : "bg-slate-50 text-slate-600 border-slate-200";

  return (
    <div className="bg-muted/30 rounded-2xl border border-border/50 p-4 space-y-3 transition-all hover:bg-muted/40">
      {/* Header row: stage + visit seq + active badge */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-foreground">
            {getMeasuredStageLabel(visit.stage)}
          </span>
          <span className="text-[10px] font-bold text-muted-foreground">
            Kunjungan ke-{visit.visitSeq}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {isActive && (
            <Badge
              variant="outline"
              className="bg-blue-50 text-blue-700 border-blue-200 text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse"
            >
              Aktif
            </Badge>
          )}
          {visit.dataQuality === "historis_terbatas" && (
            <span className="text-[9px] text-amber-600 font-semibold italic">
              (Data historis terbatas)
            </span>
          )}
        </div>
      </div>

      {/* Detail grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        <DetailCell label="Masuk" value={formatDateTime(enteredAt)} tabularNums />
        <DetailCell
          label="Keluar"
          value={isActive ? "Masih Berjalan" : formatDateTime(new Date(visit.exitedAt!))}
          tabularNums={!isActive}
          highlight={isActive}
        />
        <DetailCell
          label="Target"
          value={`${visit.targetWorkingDays} Hari Kerja`}
          tabularNums
        />
        <DetailCell
          label="Tenggat"
          value={formatDateTime(new Date(visit.slaDeadlineAt))}
          tabularNums
        />
        <DetailCell
          label="Durasi"
          value={`${durationDays} hari${isActive ? " (berjalan)" : ""}`}
          tabularNums
        />
        <div className="space-y-1">
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">
            Hasil
          </span>
          <Badge
            variant="outline"
            className={`text-[9px] font-black px-2 py-0.5 rounded-full ${resultClasses}`}
          >
            {isActive ? "Sedang Berjalan" : resultLabel}
          </Badge>
        </div>
        <DetailCell
          label="Sumber"
          value={getSlaSourceLabel(visit.slaSource)}
        />
        <DetailCell
          label="Aktor"
          value={visit.actorName || "\u2014"}
        />
      </div>

      {/* Revision notes if present */}
      {visit.revisionNotes && (
        <div className="pt-2 border-t border-border/30">
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
            Catatan
          </span>
          <p className="text-[10px] text-foreground/80 font-semibold leading-relaxed">
            {visit.revisionNotes}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Utility ────────────────────────────────────────────────────────────────

function DetailCell({
  label,
  value,
  tabularNums,
  highlight,
}: {
  label: string;
  value: string;
  tabularNums?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="space-y-1">
      <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider block">
        {label}
      </span>
      <p
        className={`text-[11px] font-bold ${tabularNums ? "tabular-nums" : ""} ${
          highlight ? "text-blue-700" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function formatDateTime(date: Date): string {
  if (!date || isNaN(date.getTime())) return "\u2014";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}
