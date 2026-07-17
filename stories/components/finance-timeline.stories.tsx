import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { History } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getActivityActionLabel } from "@/lib/label-helpers";
import { cn } from "@/lib/utils";

/**
 * FinanceTimeline (visual documentation)
 *
 * NOTE: the real `components/finance/finance-timeline.tsx` is an ASYNC server
 * component that fetches `finance_activity_history` (and falls back to
 * `audit_logs`) directly from the database. It therefore cannot be rendered in
 * Storybook, which runs in the browser without DB access.
 *
 * To keep the visual review useful, this story renders a small presentational
 * stand-in that mirrors the real component's markup and uses the same pure
 * label helper (`getActivityActionLabel`) for action labels. It documents the
 * two visual states that matter for review:
 *   1. Populated — newest-first list of activity entries (Req 2.5, 2.13).
 *   2. Empty — the "Data dibuat sebelum timeline finance aktif" fallback (Req 2.6).
 *
 * The stand-in intentionally contains NO data-fetching logic; it is markup-only.
 *
 * Design / requirements: 2.5, 2.6, 2.13.
 */

const EMPTY_MESSAGE = "Data dibuat sebelum timeline finance aktif";

interface StandInEntry {
  id: string;
  action: string;
  reason: string | null;
  actorName: string | null;
  timestamp: string;
}

/** Presentational replica of FinanceTimeline — markup only, no DB access. */
function FinanceTimelineStandIn({
  title = "Timeline Aktivitas",
  entries,
}: {
  title?: string;
  entries: StandInEntry[];
}) {
  const isEmpty = entries.length === 0;
  return (
    <Card className={cn("w-[28rem] max-w-full border-border")}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
          <History className="h-5 w-5 text-primary/70" />
          {title}
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Riwayat aktivitas finance dari terbaru ke terlama
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div className="rounded-md border border-dashed border-border bg-[#F7F8F3] px-4 py-8 text-center">
            <History className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{EMPTY_MESSAGE}</p>
          </div>
        ) : (
          <ol className="relative space-y-6 border-l border-border pl-6">
            {entries.map((entry) => (
              <li key={entry.id} className="relative">
                <span
                  className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-background bg-primary"
                  aria-hidden="true"
                />
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-semibold text-foreground">
                    {getActivityActionLabel(entry.action)}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span>{entry.actorName ?? "\u2014"}</span>
                  <span aria-hidden="true">&middot;</span>
                  <time className="tabular-nums">{entry.timestamp}</time>
                </div>
                {entry.reason && entry.reason.trim() !== "" && (
                  <p className="mt-1.5 rounded-md bg-[#F7F8F3] px-3 py-2 text-sm text-foreground">
                    {entry.reason}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

const meta = {
  title: "Finance/FinanceTimeline",
  component: FinanceTimelineStandIn,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Visual documentation for FinanceTimeline. The real component is an async server component that " +
          "reads the database, so it cannot render in Storybook; this is a markup-only stand-in that mirrors " +
          "its populated and empty states and reuses the pure `getActivityActionLabel` helper.",
      },
    },
  },
} satisfies Meta<typeof FinanceTimelineStandIn>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Populated timeline in reverse chronological order (newest first). */
export const Populated: Story = {
  args: {
    entries: [
      {
        id: "1",
        action: "paid_full",
        reason: null,
        actorName: "Admin Keuangan",
        timestamp: "22 Mei 2026, 14:30",
      },
      {
        id: "2",
        action: "resubmitted",
        reason: "Nominal diperbaiki sesuai bukti transfer.",
        actorName: "Admin Keuangan",
        timestamp: "10 Mei 2026, 10:05",
      },
      {
        id: "3",
        action: "rejected",
        reason: "Nominal pembayaran tidak sesuai bukti.",
        actorName: "Direksi",
        timestamp: "05 Mei 2026, 16:20",
      },
      {
        id: "4",
        action: "created",
        reason: null,
        actorName: "Admin Keuangan",
        timestamp: "01 Mei 2026, 09:12",
      },
    ],
  },
};

/** Empty state fallback when no activity history records exist (Req 2.6). */
export const EmptyState: Story = {
  args: {
    entries: [],
  },
};
