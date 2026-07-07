"use client";

import { useEffect, useState } from "react";
import {
  Circle,
  CheckCircle2,
  Activity,
  CreditCard,
  FileText,
  Banknote,
  Hammer,
  TrendingUp,
  Award,
} from "lucide-react";
import { getUnitTimeline, type TimelineEvent } from "@/server/actions/unit-timeline";

interface UnitTimelineProps {
  unitId: string;
}

type FilterTab = "semua" | "status" | "booking" | "pembayaran" | "konstruksi";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "semua", label: "Semua" },
  { key: "status", label: "Status" },
  { key: "booking", label: "Booking" },
  { key: "pembayaran", label: "Pembayaran" },
  { key: "konstruksi", label: "Konstruksi" },
];

const FILTER_MAP: Record<FilterTab, TimelineEvent["type"][]> = {
  semua: ["status_change", "booking", "booking_status", "kpr", "invoice", "payment", "spk", "progress", "bast"],
  status: ["status_change"],
  booking: ["booking", "booking_status", "kpr"],
  pembayaran: ["invoice", "payment"],
  konstruksi: ["spk", "progress", "bast"],
};

function getEventIcon(type: TimelineEvent["type"]) {
  switch (type) {
    case "status_change":
      return <Circle className="h-4 w-4 text-blue-500 fill-blue-500" />;
    case "booking":
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case "booking_status":
      return <Activity className="h-4 w-4 text-blue-500" />;
    case "kpr":
      return <CreditCard className="h-4 w-4 text-purple-500" />;
    case "invoice":
      return <FileText className="h-4 w-4 text-amber-500" />;
    case "payment":
      return <Banknote className="h-4 w-4 text-green-600" />;
    case "spk":
      return <Hammer className="h-4 w-4 text-orange-500" />;
    case "progress":
      return <TrendingUp className="h-4 w-4 text-teal-500" />;
    case "bast":
      return <Award className="h-4 w-4 text-emerald-600" />;
  }
}

function getEventDotColor(type: TimelineEvent["type"]) {
  switch (type) {
    case "status_change":
      return "border-blue-500 bg-blue-50";
    case "booking":
      return "border-green-500 bg-green-50";
    case "booking_status":
      return "border-blue-400 bg-blue-50";
    case "kpr":
      return "border-purple-500 bg-purple-50";
    case "invoice":
      return "border-amber-500 bg-amber-50";
    case "payment":
      return "border-green-500 bg-green-50";
    case "spk":
      return "border-orange-500 bg-orange-50";
    case "progress":
      return "border-teal-500 bg-teal-50";
    case "bast":
      return "border-emerald-500 bg-emerald-50";
  }
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "Baru saja";
  if (diffMinutes < 60) return `${diffMinutes} menit lalu`;
  if (diffHours < 24) return `${diffHours} jam lalu`;
  if (diffDays < 7) return `${diffDays} hari lalu`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} minggu lalu`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} bulan lalu`;
  return `${Math.floor(diffDays / 365)} tahun lalu`;
}

function formatAbsoluteDate(date: Date): string {
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TimelineSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="h-8 w-8 rounded-full bg-[#D6DED2]" />
            {i < 5 && <div className="w-0.5 flex-1 bg-[#D6DED2] mt-1" />}
          </div>
          <div className="flex-1 pb-4">
            <div className="h-4 w-24 bg-[#D6DED2] rounded mb-2" />
            <div className="h-4 w-48 bg-[#D6DED2] rounded mb-1" />
            <div className="h-3 w-36 bg-[#D6DED2] rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function UnitTimeline({ unitId }: UnitTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("semua");

  useEffect(() => {
    let cancelled = false;

    async function fetchTimeline() {
      setLoading(true);
      try {
        const data = await getUnitTimeline(unitId);
        if (!cancelled) {
          // Convert date strings back to Date objects (serialization via server action)
          const parsed = data.map((evt) => ({
            ...evt,
            timestamp: new Date(evt.timestamp),
          }));
          setEvents(parsed);
        }
      } catch (error) {
        console.error("Failed to fetch timeline:", error);
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchTimeline();
    return () => { cancelled = true; };
  }, [unitId]);

  const filteredEvents = events.filter((evt) =>
    FILTER_MAP[activeFilter].includes(evt.type)
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              activeFilter === tab.key
                ? "bg-[#4F6F52] text-white"
                : "bg-[#F7F8F3] text-[#4F6F52] border border-[#D6DED2] hover:bg-[#DDE8D8]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Timeline Content */}
      {loading ? (
        <TimelineSkeleton />
      ) : filteredEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Activity className="h-10 w-10 text-[#8FAF9A] mb-3" />
          <p className="text-sm text-[#4F6F52] font-medium">Belum ada aktivitas</p>
          <p className="text-xs text-[#8FAF9A] mt-1">
            Timeline akan terisi seiring proses unit berjalan
          </p>
        </div>
      ) : (
        <div className="relative">
          {filteredEvents.map((event, idx) => (
            <div key={event.id} className="flex gap-3">
              {/* Left: Icon + Connecting Line */}
              <div className="flex flex-col items-center">
                <div
                  className={`flex items-center justify-center h-8 w-8 rounded-full border-2 shrink-0 ${getEventDotColor(event.type)}`}
                >
                  {getEventIcon(event.type)}
                </div>
                {idx < filteredEvents.length - 1 && (
                  <div className="w-0.5 flex-1 bg-[#D6DED2] min-h-[16px]" />
                )}
              </div>

              {/* Right: Content */}
              <div className="flex-1 pb-5">
                {/* Relative time + absolute on hover */}
                <p
                  className="text-[11px] text-[#8FAF9A] mb-0.5 cursor-default"
                  title={formatAbsoluteDate(event.timestamp)}
                >
                  {formatRelativeTime(event.timestamp)}
                </p>

                {/* Event Title */}
                <p className="text-sm font-semibold text-[#4F6F52] leading-tight">
                  {event.title}
                </p>

                {/* Event Description */}
                {event.description && (
                  <p className="text-xs text-[#8FAF9A] mt-0.5 leading-relaxed">
                    {event.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
