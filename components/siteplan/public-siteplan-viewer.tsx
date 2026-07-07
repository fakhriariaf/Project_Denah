"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Search,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Building2,
  Ruler,
  HardHat,
  Compass,
  ChevronRight,
  MessageCircle,
  Sparkles,
  Clock,
  CheckCircle2,
  Filter,
} from "lucide-react";
import {
  PublicSiteplanData,
  PublicSiteplanShape,
  PUBLIC_STATUS_COLORS,
  PublicUnitStatus,
  getPublicStatusColor,
} from "@/lib/public-siteplan-utils";

// Filter categories for public siteplan
type StatusFilter = "semua" | "tersedia" | "proses" | "terjual";

const STATUS_FILTER_CONFIG: {
  key: StatusFilter;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  matchStatuses: PublicUnitStatus[];
}[] = [
  {
    key: "semua",
    label: "Semua",
    description: "Tampilkan semua kavling",
    color: "#4F6F52",
    bgColor: "#F7F8F3",
    borderColor: "#D6DED2",
    matchStatuses: [],
  },
  {
    key: "tersedia",
    label: "Tersedia",
    description: "Kavling tersedia untuk dibeli",
    color: "#2D4A30",
    bgColor: "#DDE8D8",
    borderColor: "#4F6F52",
    matchStatuses: ["Tersedia"],
  },
  {
    key: "proses",
    label: "Proses",
    description: "Pemesanan, KPR, atau sedang dibangun",
    color: "#6B4F00",
    bgColor: "#FFF0A0",
    borderColor: "#A07C00",
    matchStatuses: ["Dalam Pemesanan", "Sedang Dibangun"],
  },
  {
    key: "terjual",
    label: "Terjual",
    description: "Kavling sudah terjual",
    color: "#8B1A1A",
    bgColor: "#FFD6D6",
    borderColor: "#C0392B",
    matchStatuses: ["Terjual", "Siap Huni", "Tidak Tersedia"],
  },
];

interface PublicSiteplanViewerProps {
  initialData: PublicSiteplanData;
}

export function PublicSiteplanViewer({ initialData }: PublicSiteplanViewerProps) {
  const router = useRouter();
  const [hoveredShape, setHoveredShape] = useState<PublicSiteplanShape | null>(null);
  const [selectedShape, setSelectedShape] = useState<PublicSiteplanShape | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("semua");

  // Zoom and Pan State
  const [scale, setScale] = useState(1);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);

  const { project, siteplan, shapes, projects } = initialData;
  const width = siteplan?.width || 1200;
  const height = siteplan?.height || 800;

  // Check if a shape matches the active status filter
  const matchesStatusFilter = (shape: PublicSiteplanShape): boolean => {
    if (statusFilter === "semua") return true;
    const filterConfig = STATUS_FILTER_CONFIG.find((f) => f.key === statusFilter);
    if (!filterConfig) return true;
    // Non-unit shapes don't match specific filters
    if (!shape.unit) return false;
    return filterConfig.matchStatuses.includes(shape.unit.publicStatus);
  };

  // Filter shapes by search query AND status filter
  const filteredShapes = shapes.map((shape) => {
    const matchesSearch =
      searchQuery === "" ||
      shape.unit?.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shape.label?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shape.unit?.cluster?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shape.unit?.typeName?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = matchesStatusFilter(shape);
    const isMatching = matchesSearch && matchesFilter;

    return { ...shape, isMatching };
  });

  // Track cursor coordinates for tooltip
  const handleMouseMoveSVG = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({ x: e.clientX - rect.left + 12, y: e.clientY - rect.top - 10 });

    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    if (Math.hypot(dx, dy) > 2) {
      setHasDragged(true);
      setTranslateX((prev) => prev + dx);
      setTranslateY((prev) => prev + dy);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return; // Only pan with left click
    setIsDragging(true);
    setHasDragged(false);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeaveSVG = () => {
    setIsDragging(false);
    setHoveredShape(null);
  };

  const handleTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setHasDragged(false);
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  };

  const handleTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (!isDragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStart.x;
    const dy = e.touches[0].clientY - dragStart.y;

    if (Math.hypot(dx, dy) > 2) {
      setHasDragged(true);
      setTranslateX((prev) => prev + dx);
      setTranslateY((prev) => prev + dy);
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  };

  const resetView = () => {
    setScale(1);
    setTranslateX(0);
    setTranslateY(0);
  };

  const coordsToPolygonPoints = (coords: { x: number; y: number }[]): string => {
    return coords.map((c) => `${c.x},${c.y}`).join(" ");
  };

  // WhatsApp CTA Config
  const whatsappNumber = process.env.NEXT_PUBLIC_MARKETING_WHATSAPP || "6281234567890";
  const getWhatsAppLink = (unitCode: string) => {
    const text = `Halo Marketing, saya tertarik dengan unit/kavling *${unitCode}* di perumahan *${project?.name || ""}*. Apakah unit ini tersedia dan bagaimana prosedur pemesanan selanjutnya? Terima kasih.`;
    return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="flex flex-col gap-6 w-full flex-1 min-h-0">
      {/* Header Panel with Dropdown & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-[#D6DED2] shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase text-[#66736A] tracking-wider mb-1">
              Proyek Terpilih
            </span>
            <h2 className="text-lg font-bold text-[#243028] flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#4F6F52]" />
              {project?.name}
            </h2>
          </div>

          {projects.length > 1 && (
            <div className="flex items-center gap-2 border-l border-[#D6DED2] pl-4">
              <select
                value={project?.id}
                onChange={(e) => router.push(`?project=${e.target.value}`)}
                className="text-xs font-bold bg-[#F7F8F3] hover:bg-[#DDE8D8]/50 border border-[#D6DED2] rounded-xl px-3 py-2 outline-none focus:border-[#8FAF9A] text-[#243028] cursor-pointer transition-colors"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Floating Search Bar */}
        <div className="w-full md:w-80 shadow-sm bg-white rounded-2xl border border-[#D6DED2] p-1.5 flex items-center gap-2 transition-all focus-within:border-[#8FAF9A] focus-within:ring-2 focus-within:ring-[#8FAF9A]/20">
          <span className="text-[#4F6F52] pl-2 flex-shrink-0">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Cari nomor kavling, tipe, atau cluster..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-0 outline-none text-xs font-medium placeholder:text-[#66736A]/60 text-[#243028]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-[#66736A] hover:text-[#243028] p-1 rounded-full hover:bg-[#DDE8D8]/50 flex-shrink-0 flex items-center justify-center transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Status Filter Bar & Legend */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#D6DED2] shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#66736A] flex items-center gap-1.5 pr-2 border-r border-[#D6DED2]/60 shrink-0">
            <Filter className="h-3.5 w-3.5" />
            Filter
          </span>
          {STATUS_FILTER_CONFIG.map((filter) => {
            const isActive = statusFilter === filter.key;
            // Count matching shapes for badge
            const count =
              filter.key === "semua"
                ? shapes.length
                : shapes.filter(
                    (s) => s.unit && filter.matchStatuses.includes(s.unit.publicStatus)
                  ).length;

            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => setStatusFilter(filter.key)}
                title={filter.description}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all active:scale-95 ${
                  isActive
                    ? "shadow-sm ring-1 ring-offset-1"
                    : "opacity-70 hover:opacity-100 hover:shadow-sm"
                }`}
                style={{
                  backgroundColor: isActive ? filter.bgColor : "transparent",
                  color: filter.color,
                  borderColor: isActive ? filter.borderColor : "#D6DED2",
                  ...(isActive ? { ringColor: filter.borderColor } : {}),
                }}
              >
                {filter.key !== "semua" && (
                  <span
                    className="w-2.5 h-2.5 rounded-full border"
                    style={{
                      backgroundColor: filter.bgColor,
                      borderColor: filter.borderColor,
                    }}
                  />
                )}
                {filter.label}
                <span
                  className="text-[9px] font-extrabold rounded-md px-1.5 py-0.5"
                  style={{
                    backgroundColor: isActive ? `${filter.borderColor}20` : "#F7F8F3",
                    color: filter.color,
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Inline Legend */}
        <div className="flex items-center gap-3 text-[10px] pl-2 sm:pl-0 sm:border-l sm:border-[#D6DED2]/60 sm:ml-2">
          <span className="font-extrabold text-[#66736A] uppercase tracking-wider shrink-0 hidden sm:inline">
            Legenda:
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-3 h-3 rounded-sm border" style={{ backgroundColor: "#DDE8D8", borderColor: "#4F6F52" }} />
            <span className="font-bold text-[#243028]">Tersedia</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-3 h-3 rounded-sm border" style={{ backgroundColor: "#FFF0A0", borderColor: "#A07C00" }} />
            <span className="font-bold text-[#243028]">Proses</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-3 h-3 rounded-sm border" style={{ backgroundColor: "#FFD6D6", borderColor: "#C0392B" }} />
            <span className="font-bold text-[#243028]">Terjual</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div className="siteplan-container relative w-full flex-1 overflow-hidden rounded-3xl border border-[#D6DED2] bg-white shadow-lg h-[65vh] min-h-[450px]">
        {/* Navigation Help overlay */}
        <div className="absolute top-4 left-4 z-10 hidden sm:flex items-center gap-2 bg-[#4F6F52]/10 backdrop-blur-md border border-[#4F6F52]/20 px-3.5 py-1.5 rounded-2xl text-[10px] font-bold text-[#4F6F52] pointer-events-none">
          <Compass className="h-3.5 w-3.5 text-[#4F6F52] animate-pulse" />
          <span>Klik/Sentuh kavling untuk melihat detail</span>
        </div>

        {/* Zoom Controls */}
        <div className="absolute bottom-16 right-4 z-10 flex flex-row items-center gap-1.5 shadow-md bg-white/95 backdrop-blur-md rounded-2xl border border-[#D6DED2] p-1.5 pointer-events-auto">
          <button
            type="button"
            onClick={() => setScale((prev) => Math.min(prev + 0.25, 4.0))}
            className="h-8 w-8 hover:bg-[#4F6F52] hover:text-white text-[#4F6F52] rounded-xl transition-all flex items-center justify-center bg-white/50 active:scale-90 shadow-sm"
            title="Perbesar"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setScale((prev) => Math.max(prev - 0.25, 0.5))}
            className="h-8 w-8 hover:bg-[#4F6F52] hover:text-white text-[#4F6F52] rounded-xl transition-all flex items-center justify-center bg-white/50 active:scale-90 shadow-sm"
            title="Perkecil"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <div className="h-5 w-[1px] bg-[#D6DED2] mx-1" />
          <button
            type="button"
            onClick={resetView}
            className="h-8 px-3 hover:bg-[#4F6F52] hover:text-white text-[#4F6F52] rounded-xl transition-all flex items-center gap-1.5 bg-white/50 active:scale-90 shadow-sm"
            title="Reset Tampilan"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="text-[10px] uppercase font-black tracking-wider">Reset</span>
          </button>
        </div>

        {/* The SVG element */}
        {siteplan ? (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            width="100%"
            height="100%"
            className={`bg-[#F7F8F3]/50 transition-shadow ${
              isDragging ? "cursor-grabbing" : "cursor-grab"
            }`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMoveSVG}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeaveSVG}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleMouseUp}
          >
            <defs>
              <filter id="glow-highlight" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feComponentTransfer in="blur" result="glow">
                  <feFuncA type="linear" slope="0.75" />
                </feComponentTransfer>
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <filter id="glow-selected" x="-25%" y="-25%" width="150%" height="150%">
                <feGaussianBlur stdDeviation="5.5" result="blur" />
                <feComponentTransfer in="blur" result="glow">
                  <feFuncA type="linear" slope="0.9" />
                </feComponentTransfer>
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              {/* Drop-shadow filter for polygon hover using sage green color */}
              <filter id="drop-shadow-sage" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="rgba(79, 111, 82, 0.25)" floodOpacity="1" />
              </filter>
            </defs>

            {/* Transform Group (Zoom/Pan) */}
            <g transform={`translate(${translateX}, ${translateY}) scale(${scale})`}>
              <rect width={width} height={height} fill="#ffffff" />

              {siteplan.imageUrl && (
                <image
                  href={siteplan.imageUrl}
                  x={0}
                  y={0}
                  width={width}
                  height={height}
                  preserveAspectRatio="xMidYMid meet"
                />
              )}

              {/* Shapes Loop */}
              {filteredShapes.map((shape) => {
                const isSelected = shape.id === selectedShape?.id;
                const isHovered = shape.id === hoveredShape?.id;
                const isFiltering = searchQuery !== "" || statusFilter !== "semua";
                const isMatching = shape.isMatching;
                const isDimmed = isFiltering && !isMatching;

                // Color definition based on public status mapping
                const color = shape.colorOverride
                  ? { fill: shape.colorOverride, stroke: "#66736A", text: "#243028", dot: "#66736A" }
                  : shape.unit
                  ? PUBLIC_STATUS_COLORS[shape.unit.publicStatus]
                  : { fill: "#E7E9E7", stroke: "#5F6861", text: "#3D4840", dot: "#7A8880" };

                // Centroid coordinates for text placement
                const centroid = shape.coordinates.reduce(
                  (acc: { x: number; y: number }, c: { x: number; y: number }) => ({
                    x: acc.x + c.x / shape.coordinates.length,
                    y: acc.y + c.y / shape.coordinates.length,
                  }),
                  { x: 0, y: 0 }
                );

                return (
                  <g
                    key={shape.id}
                    onClick={(e) => {
                      if (hasDragged) {
                        e.stopPropagation();
                        return;
                      }
                      setSelectedShape(isSelected ? null : shape);
                    }}
                    onMouseEnter={() => !isDragging && setHoveredShape(shape)}
                    onMouseLeave={() => setHoveredShape(null)}
                    className="cursor-pointer"
                  >
                    <polygon
                      points={coordsToPolygonPoints(shape.coordinates)}
                      fill={color.fill}
                      fillOpacity={isDimmed ? 0.15 : isSelected ? 0.95 : isHovered ? 1.0 : 0.7}
                      stroke={isSelected ? "#FF6B00" : isHovered ? color.stroke : color.stroke}
                      strokeWidth={isSelected ? 3.5 : isHovered ? 2.5 : 1.5}
                      filter={
                        isSelected
                          ? "url(#glow-selected)"
                          : isHovered
                          ? "url(#drop-shadow-sage)"
                          : undefined
                      }
                      className="transition-[opacity,filter] duration-200 ease-in-out"
                    />

                    {/* Code label text */}
                    <text
                      x={centroid.x}
                      y={shape.unit && shape.unit.publicStatus === "Sedang Dibangun" ? centroid.y - 2 : centroid.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={10}
                      fill={color.text}
                      fontFamily="var(--font-mono), monospace"
                      fontWeight="700"
                      className={`pointer-events-none select-none transition-opacity ${isDimmed ? "opacity-20" : "opacity-100"}`}
                    >
                      {shape.label ?? shape.unit?.code ?? ""}
                    </text>

                    {/* Progress percentage label for constructing units */}
                    {shape.unit && shape.unit.publicStatus === "Sedang Dibangun" && !isDimmed && (
                      <g
                        transform={`translate(${centroid.x}, ${centroid.y + 9})`}
                        className="pointer-events-none select-none"
                      >
                        <rect
                          x={-14}
                          y={-5}
                          width={28}
                          height={10}
                          rx={3}
                          fill="#E9DDF7"
                          stroke="#5D4382"
                          strokeWidth={0.5}
                        />
                        <text
                          x={0}
                          y={2}
                          textAnchor="middle"
                          fontSize={7}
                          fontFamily="var(--font-mono), monospace"
                          fontWeight="850"
                          fill="#5D4382"
                        >
                          {shape.unit.constructionProgress}%
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Watermark in bottom corner */}
              <text
                x={width - 20}
                y={height - 20}
                textAnchor="end"
                fontSize={12}
                fill="#A8B0AA"
                fontWeight="800"
                fontFamily="var(--font-sans), sans-serif"
                opacity="0.45"
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                DENAH PROPERTY — Public View
              </text>
            </g>
          </svg>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-[#F7F8F3]/50">
            <Building2 className="w-16 h-16 text-[#A8B0AA] mb-4 stroke-1 animate-pulse" />
            <h3 className="text-lg font-bold text-[#243028]">Denah Belum Tersedia</h3>
            <p className="text-sm text-[#66736A] max-w-sm mt-1">
              Kavling terdaftar namun blueprint gambar siteplan belum diunggah untuk proyek ini.
            </p>
          </div>
        )}

        {/* Hover Tooltip (Desktop only) */}
        {hoveredShape && !selectedShape && !isDragging && (
          <div
            className="pointer-events-none absolute z-20 rounded-2xl border border-[#D6DED2] bg-white/95 backdrop-blur-md px-3.5 py-2.5 shadow-md text-xs"
            style={{ left: tooltipPos.x, top: tooltipPos.y }}
          >
            {hoveredShape.unit ? (
              <div className="space-y-1 min-w-[120px]">
                <div className="flex justify-between items-center border-b border-[#D6DED2]/40 pb-1.5 mb-1.5">
                  <span className="font-extrabold font-mono text-[#243028] text-[13px]">
                    Kavling {hoveredShape.unit.code}
                  </span>
                  <span className="text-[9px] text-[#66736A] font-black uppercase">
                    {hoveredShape.unit.cluster || "—"}
                  </span>
                </div>
                <p className="text-[10px] text-[#66736A] font-bold">
                  Tipe: {hoveredShape.unit.typeName || "—"}
                </p>
                <div className="pt-1">
                  <span
                    className="inline-flex items-center rounded-lg px-2 py-0.5 text-[9px] font-black border"
                    style={{
                      backgroundColor: PUBLIC_STATUS_COLORS[hoveredShape.unit.publicStatus].fill,
                      color: PUBLIC_STATUS_COLORS[hoveredShape.unit.publicStatus].text,
                      borderColor: PUBLIC_STATUS_COLORS[hoveredShape.unit.publicStatus].stroke + "30",
                    }}
                  >
                    {hoveredShape.unit.publicStatus}
                  </span>
                </div>
              </div>
            ) : (
              <p className="font-black text-[#66736A]">
                {hoveredShape.label ?? "Kavling Non-Unit"}
              </p>
            )}
          </div>
        )}

        {/* Bottom Legends Dock */}
        <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-[#D6DED2] px-4 py-2.5 overflow-x-auto flex items-center gap-4 shadow-sm scrollbar-none">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#66736A] border-r border-[#D6DED2]/60 pr-4 shrink-0">
            Status Kavling
          </span>
          <div className="flex gap-x-4 gap-y-1 items-center flex-nowrap">
            {Object.entries(PUBLIC_STATUS_COLORS).map(([label, color]) => (
              <div key={label} className="flex items-center gap-1.5 text-[10px] shrink-0">
                <div
                  className="h-3 w-4.5 rounded-md border shadow-sm"
                  style={{
                    backgroundColor: color.fill,
                    borderColor: color.stroke,
                  }}
                />
                <span className="font-bold text-[#243028]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Public Unit Detail Drawer (Sheet) */}
      <Sheet open={!!selectedShape} onOpenChange={(open) => !open && setSelectedShape(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-hidden bg-[#F7F8F3] border-l border-[#D6DED2] p-0 shadow-sage-lg rounded-l-[2rem] flex flex-col h-full">
          {selectedShape && (
            <div className="h-full flex flex-col min-h-0 justify-between">
              {/* Sticky Header Panel */}
              <div className="p-6 pb-5 bg-white border-b border-[#D6DED2] sticky top-0 z-20 shadow-sm rounded-tl-[2rem]">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-[#8FAF9A] uppercase tracking-widest flex items-center gap-1">
                      <Compass className="h-3.5 w-3.5 animate-pulse" /> DETAIL KAVLING
                    </span>
                    <SheetTitle className="font-mono text-xl font-extrabold text-[#243028] tracking-tight flex flex-wrap items-center gap-2">
                      <span className="whitespace-nowrap">Kavling {selectedShape.label ?? selectedShape.unit?.code}</span>
                      {selectedShape.unit?.publicStatus === "Siap Huni" && (
                        <span className="inline-flex items-center gap-1 bg-[#DDE8D8] text-[#4F6F52] text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider font-sans whitespace-nowrap">
                          🏡 SIAP HUNI
                        </span>
                      )}
                    </SheetTitle>
                  </div>
                  <div className="flex flex-col gap-1.5 items-end">
                    {selectedShape.unit?.cluster && (
                      <Badge className="bg-[#DDE8D8] text-[#4F6F52] hover:bg-[#DDE8D8] border border-[#8FAF9A]/30 text-[10px] font-extrabold font-mono rounded-lg px-2.5 py-1 shadow-sm">
                        Blok {selectedShape.unit.cluster}
                      </Badge>
                    )}
                    <span className="text-[9px] font-bold text-[#66736A]/50 font-mono">
                      PROYEK #{project?.code?.toUpperCase() || "PRJ"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Scrollable Content Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-sage/40">
                {selectedShape.unit ? (
                  <div className="space-y-6">
                    {/* Status Accent Panel */}
                    <div className="bg-white rounded-[2rem] p-5 border border-[#D6DED2] shadow-sm flex items-center justify-between transition-all hover:shadow-md">
                      <div className="space-y-1">
                        <span className="text-[10px] font-extrabold text-[#66736A] uppercase tracking-wider block">
                          Status Kavling
                        </span>
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black border shadow-sm uppercase"
                          style={{
                            backgroundColor: PUBLIC_STATUS_COLORS[selectedShape.unit.publicStatus].fill,
                            color: PUBLIC_STATUS_COLORS[selectedShape.unit.publicStatus].text,
                            borderColor: PUBLIC_STATUS_COLORS[selectedShape.unit.publicStatus].stroke + "30",
                          }}
                        >
                          {selectedShape.unit.publicStatus === "Tersedia" && <Sparkles className="h-3.5 w-3.5 text-[#4F6F52]" />}
                          {selectedShape.unit.publicStatus === "Dalam Pemesanan" && <Clock className="h-3.5 w-3.5 text-[#8A6D1D]" />}
                          {selectedShape.unit.publicStatus === "Sedang Dibangun" && <HardHat className="h-3.5 w-3.5 text-[#5D4382]" />}
                          {selectedShape.unit.publicStatus === "Siap Huni" && <CheckCircle2 className="h-3.5 w-3.5 text-[#2E7A5E]" />}
                          {selectedShape.unit.publicStatus}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-extrabold text-[#66736A] uppercase tracking-wider block whitespace-nowrap">
                          Tipe Unit
                        </span>
                        <span className="font-mono font-extrabold text-sm md:text-base text-[#4F6F52] tracking-tight block mt-0.5">
                          {selectedShape.unit.typeName || "—"}
                        </span>
                      </div>
                    </div>

                    {/* Specification Grid */}
                    <div className="bg-white rounded-[2rem] p-5 border border-[#D6DED2] shadow-sm space-y-4">
                      <h4 className="text-xs font-extrabold text-[#243028] uppercase tracking-wider border-b border-[#D6DED2]/60 pb-2">
                        Spesifikasi Teknis
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#F7F8F3] p-4 rounded-2xl border border-[#D6DED2]/50 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-[#4F6F52] border border-[#D6DED2] shadow-sm">
                            <Ruler className="w-4.5 h-4.5" />
                          </div>
                          <div>
                            <span className="text-[9px] font-extrabold uppercase text-[#66736A] block tracking-wide">
                              Luas Tanah
                            </span>
                            <p className="text-sm font-extrabold text-[#243028] font-mono mt-0.5">
                              {selectedShape.unit.landArea} m²
                            </p>
                          </div>
                        </div>

                        <div className="bg-[#F7F8F3] p-4 rounded-2xl border border-[#D6DED2]/50 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-[#4F6F52] border border-[#D6DED2] shadow-sm">
                            <Building2 className="w-4.5 h-4.5" />
                          </div>
                          <div>
                            <span className="text-[9px] font-extrabold uppercase text-[#66736A] block tracking-wide">
                              Luas Bangunan
                            </span>
                            <p className="text-sm font-extrabold text-[#243028] font-mono mt-0.5">
                              {selectedShape.unit.buildingArea} m²
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Construction Progress Bar */}
                    {selectedShape.unit.publicStatus === "Sedang Dibangun" && (
                      <div className="bg-white rounded-[2rem] p-5 border border-[#D6DED2] shadow-sm space-y-3">
                        <div className="flex justify-between items-center text-xs font-extrabold text-[#243028] uppercase tracking-wider">
                          <span className="flex items-center gap-1.5">
                            <HardHat className="w-4.5 h-4.5 text-[#5D4382]" /> 
                            Progress Pembangunan
                          </span>
                          <span className="text-[#5D4382] font-mono text-sm">{selectedShape.unit.constructionProgress}%</span>
                        </div>
                        <div className="space-y-1">
                          <Progress
                            value={selectedShape.unit.constructionProgress}
                            className="h-2.5 bg-[#E9DDF7]/50"
                          />
                          <p className="text-[9px] text-[#66736A] font-bold">
                            Unit sedang berada dalam tahap pengerjaan fisik oleh kontraktor.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white p-6 rounded-[2rem] border border-[#D6DED2] shadow-sm text-center py-10">
                    <p className="text-sm font-semibold text-[#66736A]">
                      Kavling ini belum dikaitkan dengan detail unit bangunan di database.
                    </p>
                  </div>
                )}
              </div>

              {/* Sticky Action Footer */}
              {selectedShape.unit && (
                <div className="p-6 bg-white border-t border-[#D6DED2] sticky bottom-0 z-20 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
                  <p className="text-[11px] text-[#66736A] font-bold text-center mb-3">
                    Tertarik dengan kavling ini? Hubungi tim marketing kami.
                  </p>
                  <a
                    href={getWhatsAppLink(selectedShape.label ?? selectedShape.unit.code)}
                    target="_blank"
                    rel="noreferrer"
                    className="block w-full"
                  >
                    <Button className="w-full bg-[#25D366] hover:bg-[#20ba5a] text-white font-extrabold rounded-2xl py-6 flex items-center justify-center gap-2.5 shadow-md hover:shadow-lg active:scale-[0.98] transition-all text-sm border-0">
                      <MessageCircle className="w-5 h-5 fill-current" />
                      Hubungi Marketing (WhatsApp)
                    </Button>
                  </a>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
