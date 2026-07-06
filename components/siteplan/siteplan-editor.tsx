"use client";

import { useState, useRef, useTransition, useMemo, useEffect } from "react";
import { coordsToPolygonPoints, getStatusColor } from "@/lib/siteplan-utils";
import { saveShape, deleteShape, updateShape, saveMultipleShapes } from "@/server/actions/siteplan";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, MousePointer, Info, Layers, RefreshCw, Sparkles, Loader2, ChevronRight, Link2, Unlink, Grid3X3, Move, X, Trash2, PlusCircle } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type Point = { x: number; y: number };

type ExistingShape = {
  id: string;
  coordinates: Point[];
  label: string | null;
  unitId: string | null;
  unit?: { id: string; code: string; status: string; isReadyStock?: boolean | null } | null;
};

type UnitOption = { id: string; code: string; status: string; cluster?: string | null; isReadyStock?: boolean | null };

type SiteplanEditorProps = {
  siteplanId: string;
  existingShapes: ExistingShape[];
  units: UnitOption[];
  imageUrl?: string | null;
  width: number;
  height: number;
  autoScan?: boolean;
};

export function SiteplanEditor({
  siteplanId,
  existingShapes,
  units,
  imageUrl,
  width,
  height,
  autoScan = false,
}: SiteplanEditorProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"view" | "draw">("view");
  const [scanStatus, setScanStatus] = useState<string>("");
  const [isScanning, setIsScanning] = useState<boolean>(false);

  const [drawPoints, setDrawPoints] = useState<Point[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [shapes, setShapes] = useState<ExistingShape[]>(existingShapes);
  const unsavedDetectedShapes = shapes.filter((s) => s.id.startsWith("detected_"));
  const [selectedShapeIds, setSelectedShapeIds] = useState<string[]>([]);

  // Interactive corner drag & translation states
  const [draggingVertexIndex, setDraggingVertexIndex] = useState<number | null>(null);
  const [draggingShape, setDraggingShape] = useState<boolean>(false);
  const [dragStartPoint, setDragStartPoint] = useState<Point | null>(null);
  const [dragStartCoords, setDragStartCoords] = useState<Record<string, Point[]>>({});

  // Grouped Sidebar Accordion Collapse state
  const [expandedBlocks, setExpandedBlocks] = useState<Record<string, boolean>>({});



  const svgRef = useRef<SVGSVGElement>(null);

  const getSVGPoint = (e: React.MouseEvent<SVGElement>): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) {
      const rect = svg.getBoundingClientRect();
      const scaleX = width / rect.width;
      const scaleY = height / rect.height;
      return {
        x: Math.round((e.clientX - rect.left) * scaleX),
        y: Math.round((e.clientY - rect.top) * scaleY),
      };
    }
    const svgPoint = pt.matrixTransform(ctm.inverse());
    return {
      x: Math.round(svgPoint.x),
      y: Math.round(svgPoint.y),
    };
  };

  const handleSVGClick = (e: React.MouseEvent<SVGElement>) => {
    if (mode !== "draw") return;
    const pt = getSVGPoint(e);
    setDrawPoints((prev) => [...prev, pt]);
  };

  const handleSaveShape = () => {
    if (drawPoints.length < 3) return;
    startTransition(async () => {
      const result = await saveShape({
        siteplanId,
        unitId: selectedUnitId || undefined,
        shapeType: "polygon",
        coordinates: drawPoints,
        label: selectedUnitId
          ? units.find((u) => u.id === selectedUnitId)?.code
          : undefined,
      });
      if (result.success) {
        const unit = units.find((u) => u.id === selectedUnitId);
        setShapes((prev) => [
          ...prev,
          {
            id: result.id,
            coordinates: drawPoints,
            label: unit?.code ?? null,
            unitId: selectedUnitId || null,
            unit: unit ? { id: unit.id, code: unit.code, status: unit.status } : null,
          },
        ]);
        setDrawPoints([]);
        setSelectedUnitId("");
      }
    });
  };

  const handleDeleteSelected = () => {
    if (selectedShapeIds.length === 0) return;

    startTransition(async () => {
      const tempIds = selectedShapeIds.filter((id) => id.startsWith("detected_"));
      const dbIds = selectedShapeIds.filter((id) => !id.startsWith("detected_"));

      if (tempIds.length > 0) {
        setShapes((prev) => prev.filter((s) => !tempIds.includes(s.id)));
      }

      for (const id of dbIds) {
        await deleteShape(id);
      }

      if (dbIds.length > 0) {
        setShapes((prev) => prev.filter((s) => !dbIds.includes(s.id)));
      }

      setSelectedShapeIds([]);
    });
  };

  // Python AI Engine Handler
  const handlePythonAutoDetect = async () => {
    if (!imageUrl) return;

    try {
      setIsScanning(true);
      setScanStatus(t("siteplan_editor.connecting_ai"));

      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error(t("siteplan_editor.fail_img"));
      const blob = await response.blob();

      const formData = new FormData();
      const ext = imageUrl.split('.').pop()?.toLowerCase() || 'png';

      let blobToSend = blob;
      let finalExt = ext;

      // SVG → kirim langsung ke Python SVG analyzer (koordinat EXACT dari elemen SVG)
      // Jauh lebih presisi dibanding rasterisasi → OpenCV
      // Python SVG analyzer membaca polygon/rect element native SVG
      if (ext === 'svg') {
        blobToSend = blob;
        finalExt = 'svg'; // Python akan route ke svg_analyzer
      }

      formData.append("file", blobToSend, `siteplan.${finalExt}`);

      setScanStatus(t("siteplan_editor.processing_ai"));

      // Call Python FastAPI AI Engine (configurable via env var for production)
      const aiBaseUrl = process.env.NEXT_PUBLIC_AI_ENGINE_URL || "http://127.0.0.1:8000";
      const aiResponse = await fetch(`${aiBaseUrl}/api/v1/analyze-siteplan`, {
        method: "POST",
        body: formData,
      });

      if (!aiResponse.ok) {
        throw new Error(t("siteplan_editor.fail_ai"));
      }

      const aiData = await aiResponse.json();

      if (aiData.status === "success" && aiData.data) {
        const origWidth = aiData.meta?.original_width || width;
        const origHeight = aiData.meta?.original_height || height;

        // ── PERBAIKAN PRESISI ──────────────────────────────────────────────────────
        // SVG viewer menggunakan preserveAspectRatio="xMidYMid meet"
        // sehingga gambar di-scale uniform (scale terkecil) dan mungkin ada offset
        // jika aspek rasio gambar ≠ aspek rasio viewBox
        const effectiveScale = Math.min(width / origWidth, height / origHeight);
        const offsetX = (width - origWidth * effectiveScale) / 2;
        const offsetY = (height - origHeight * effectiveScale) / 2;
        // ──────────────────────────────────────────────────────────────────────────

        const newShapes: ExistingShape[] = aiData.data.map((item: any, index: number) => {
          let coords: Point[];

          if (item.polygon_points && item.polygon_points.length >= 3) {
            // ✅ Gunakan titik polygon ASLI dari Python (lebih presisi)
            coords = (item.polygon_points as { x: number, y: number }[]).map(pt => ({
              x: Math.round(pt.x * effectiveScale + offsetX),
              y: Math.round(pt.y * effectiveScale + offsetY),
            }));
          } else {
            // Fallback: rekonstruksi bounding box rectangle
            const cx = item.center_x * effectiveScale + offsetX;
            const cy = item.center_y * effectiveScale + offsetY;
            const hw = (item.width * effectiveScale) / 2;
            const hh = (item.height * effectiveScale) / 2;
            coords = [
              { x: Math.round(cx - hw), y: Math.round(cy - hh) },
              { x: Math.round(cx + hw), y: Math.round(cy - hh) },
              { x: Math.round(cx + hw), y: Math.round(cy + hh) },
              { x: Math.round(cx - hw), y: Math.round(cy + hh) },
            ];
          }

          const detectedLabel = item.detected_label || null;

          // Auto-match dengan unit database berdasarkan nomor/label kavling
          let matchedUnit = null;
          if (detectedLabel) {
            matchedUnit = units.find(u => u.code.toLowerCase().trim() === detectedLabel.toLowerCase().trim());
          }

          return {
            id: `detected_${Date.now()}_${index}_${item.generated_id}`,
            coordinates: coords,
            label: detectedLabel,
            unitId: matchedUnit ? matchedUnit.id : null,
            unit: matchedUnit ? matchedUnit : null
          };
        });

        if (newShapes.length > 0) {
          setShapes(prev => [...prev, ...newShapes]);
          alert(`Sukses! AI menemukan ${aiData.summary.total} kavling. (${aiData.summary.sudah_ada_nomor} memiliki nomor).`);
        } else {
          alert("AI tidak menemukan kavling pada gambar ini.");
        }
      }
    } catch (err: any) {
      console.error("AI Error:", err);
      alert(err.message || "Terjadi kesalahan saat memproses gambar dengan Python AI Engine.");
    } finally {
      setIsScanning(false);
      setScanStatus("");
    }
  };

  // Bulk Save Server Action Handler
  const handleBulkSave = () => {
    const unsavedDetected = shapes.filter((s) => s.id.startsWith("detected_"));
    if (unsavedDetected.length === 0) return;

    startTransition(async () => {
      const dataToSave = unsavedDetected.map((s) => ({
        siteplanId,
        unitId: s.unitId || undefined,
        shapeType: "polygon" as const,
        coordinates: s.coordinates,
        label: s.label || undefined,
      }));

      const result = await saveMultipleShapes(dataToSave);
      if (result.success && result.inserted) {
        const dbInserted = result.inserted;
        setShapes((prev) => {
          const filteredPrev = prev.filter((s) => !s.id.startsWith("detected_"));
          const newDbShapes: ExistingShape[] = dbInserted.map((dbShape: any) => {
            const unitObj = units.find((u) => u.id === dbShape.unitId);
            return {
              id: dbShape.id,
              coordinates: dbShape.coordinates,
              label: dbShape.label,
              unitId: dbShape.unitId,
              unit: unitObj ? { id: unitObj.id, code: unitObj.code, status: unitObj.status, isReadyStock: unitObj.isReadyStock } : null,
            };
          });
          return [...filteredPrev, ...newDbShapes];
        });
        setSelectedShapeIds([]);
        alert("Berhasil menyimpan seluruh kavling terdeteksi ke database!");
      }
    });
  };



  // Interactive coordinate editing mouse movements
  const handleSVGMouseMove = (e: React.MouseEvent<SVGElement>) => {
    if (draggingVertexIndex !== null && selectedShapeIds.length === 1) {
      const pt = getSVGPoint(e);
      setShapes((prev) =>
        prev.map((s) => {
          if (s.id === selectedShapeIds[0]) {
            const newCoords = [...s.coordinates];
            newCoords[draggingVertexIndex] = pt;
            return { ...s, coordinates: newCoords };
          }
          return s;
        })
      );
    } else if (draggingShape && selectedShapeIds.length > 0 && dragStartPoint && Object.keys(dragStartCoords).length > 0) {
      const pt = getSVGPoint(e);
      const dx = pt.x - dragStartPoint.x;
      const dy = pt.y - dragStartPoint.y;
      setShapes((prev) =>
        prev.map((s) => {
          if (selectedShapeIds.includes(s.id) && dragStartCoords[s.id]) {
            const newCoords = dragStartCoords[s.id].map((c) => ({
              x: Math.round(c.x + dx),
              y: Math.round(c.y + dy)
            }));
            return { ...s, coordinates: newCoords };
          }
          return s;
        })
      );
    }
  };

  const handleSVGMouseUp = () => {
    if (draggingVertexIndex !== null && selectedShapeIds.length === 1) {
      setDraggingVertexIndex(null);
      saveModifiedShape(selectedShapeIds[0]);
    } else if (draggingShape) {
      setDraggingShape(false);
      setDragStartPoint(null);
      setDragStartCoords({});
      // Save all modified shapes that are already in DB
      selectedShapeIds.forEach(id => {
        saveModifiedShape(id);
      });
    }
  };

  const saveModifiedShape = (shapeId: string) => {
    const currentShape = shapes.find((s) => s.id === shapeId);
    if (currentShape && !currentShape.id.startsWith("detected_")) {
      startTransition(async () => {
        await updateShape(currentShape.id, {
          siteplanId,
          unitId: currentShape.unitId || undefined,
          shapeType: "polygon",
          coordinates: currentShape.coordinates,
          label: currentShape.label || undefined,
        });
      });
    }
  };

  // Linking a unit to the selected shape
  const handleLinkUnitToSelectedShape = (unitId: string) => {
    if (selectedShapeIds.length !== 1) {
      alert("Pilih tepat satu poligon kavling di denah terlebih dahulu!");
      return;
    }
    const targetShapeId = selectedShapeIds[0];
    const unitObj = units.find((u) => u.id === unitId);
    setShapes((prev) =>
      prev.map((s) => {
        if (s.id === targetShapeId) {
          return {
            ...s,
            unitId: unitId || null,
            label: unitObj ? unitObj.code : null,
            unit: unitObj ? { id: unitObj.id, code: unitObj.code, status: unitObj.status, isReadyStock: unitObj.isReadyStock } : null
          };
        }
        return s;
      })
    );
    setSelectedUnitId(unitId);

    // Save immediately if it's a database shape
    const currentShape = shapes.find((s) => s.id === targetShapeId);
    if (currentShape && !currentShape.id.startsWith("detected_")) {
      startTransition(async () => {
        await updateShape(currentShape.id, {
          siteplanId,
          unitId: unitId || undefined,
          shapeType: "polygon",
          coordinates: currentShape.coordinates,
          label: unitObj ? unitObj.code : undefined,
        });
      });
    }
  };

  // Unlinking a unit from selected shape
  const handleUnlinkUnit = () => {
    if (selectedShapeIds.length !== 1) return;
    const targetShapeId = selectedShapeIds[0];

    setShapes((prev) =>
      prev.map((s) => {
        if (s.id === targetShapeId) {
          return {
            ...s,
            unitId: null,
            label: null,
            unit: null
          };
        }
        return s;
      })
    );
    setSelectedUnitId("");

    const currentShape = shapes.find((s) => s.id === targetShapeId);
    if (currentShape && !currentShape.id.startsWith("detected_")) {
      startTransition(async () => {
        await updateShape(currentShape.id, {
          siteplanId,
          unitId: null,
          shapeType: "polygon",
          coordinates: currentShape.coordinates,
          label: null,
        });
      });
    }
  };

  const usedUnitIds = useMemo(() => new Set(shapes.map((s) => s.unitId).filter(Boolean)), [shapes]);
  const availableUnits = useMemo(() => units.filter(
    (u) => !usedUnitIds.has(u.id) || u.id === selectedUnitId
  ), [units, usedUnitIds, selectedUnitId]);

  // Group unmapped units by cluster/block
  const groupedUnits = useMemo(() => {
    return availableUnits.reduce<Record<string, UnitOption[]>>((acc, u) => {
      const blockName = u.cluster || "Tanpa Blok";
      if (!acc[blockName]) acc[blockName] = [];
      acc[blockName].push(u);
      return acc;
    }, {});
  }, [availableUnits]);

  const selectedShape = useMemo(() => selectedShapeIds.length === 1 ? shapes.find((s) => s.id === selectedShapeIds[0]) : null, [shapes, selectedShapeIds]);

  return (
    <div className="flex flex-col gap-5">

      {/* ── PREMIUM INTEGRATED TOOLBAR ── */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#D6DED2] bg-white p-3.5 shadow-sage">

        {/* View Mode Button */}
        <Button
          size="sm"
          variant={mode === "view" ? "default" : "outline"}
          onClick={() => {
            setMode("view");
            setDrawPoints([]);
          }}
          className={`text-xs font-bold transition-all h-9 rounded-xl btn-premium px-4 ${mode === "view"
              ? "bg-[#4F6F52] hover:bg-[#3D563F] text-white shadow-glow-sage"
              : "border-[#D6DED2] hover:bg-[#F7F8F3] hover:text-[#4F6F52] text-[#66736A]"
            }`}
        >
          <MousePointer className="mr-1.5 h-3.5 w-3.5" />
          {t("siteplan_editor.viewer_mode")}
        </Button>

        {/* Draw Mode Button */}
        <Button
          size="sm"
          variant={mode === "draw" ? "default" : "outline"}
          onClick={() => {
            setMode("draw");
            setSelectedShapeIds([]);
          }}
          className={`text-xs font-bold transition-all h-9 rounded-xl btn-premium px-4 ${mode === "draw"
              ? "bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/10"
              : "border-[#D6DED2] hover:bg-[#F7F8F3] hover:text-amber-600 text-[#66736A]"
            }`}
        >
          <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
          {t("siteplan_editor.draw_mode")}
        </Button>



        {/* Dynamic Context controls for drawing */}
        {mode === "draw" && (
          <div className="flex flex-wrap items-center gap-2.5 animate-in fade-in duration-300">
            <div className="h-6 w-px bg-[#D6DED2] mx-1.5 hidden md:block" />

            {/* Unit Selection Dropdown */}
            <div className="flex items-center gap-1.5 w-[240px]">
              <Select
                value={selectedUnitId}
                onValueChange={(val) => setSelectedUnitId(val ?? "")}
              >
                <SelectTrigger className="h-9 text-xs border-[#D6DED2] focus:ring-2 focus:ring-[#4F6F52]/20 rounded-xl font-bold bg-[#F7F8F3] text-[#243028] flex-1">
                  <SelectValue placeholder={t("siteplan_editor.select_unit")}>
                    {selectedUnitId ? (
                      units.find((u) => u.id === selectedUnitId)?.code || t("siteplan_editor.no_unit")
                    ) : (
                      t("siteplan_editor.select_unit")
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="border-[#D6DED2] rounded-xl">
                  <SelectItem value="" className="text-xs font-bold text-muted-foreground">
                    {t("siteplan_editor.no_unit_poly")}
                  </SelectItem>
                  {availableUnits.map((u) => (
                    <SelectItem key={u.id} value={u.id} className="text-xs font-mono font-bold">
                      {u.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Clear Selection Button */}
              {selectedUnitId && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setSelectedUnitId("")}
                  className="h-9 w-9 rounded-xl border-[#D6DED2] text-rose-500 hover:text-rose-600 hover:bg-rose-50/50 shrink-0 shadow-sm transition-all active:scale-95 flex items-center justify-center"
                  title={t("siteplan_editor.clear_unit")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <Badge className="bg-[#FFF2C2] text-[#8A6D1D] border border-amber-200 text-[10px] font-bold font-mono h-8 rounded-xl px-3 shadow-sm shrink-0 flex items-center gap-1 animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-[#8A6D1D]" />
              {drawPoints.length} {t("siteplan_editor.corners")}
            </Badge>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setDrawPoints([])}
              disabled={drawPoints.length === 0}
              className="text-xs border-[#D6DED2] hover:bg-rose-50 hover:text-rose-600 h-9 rounded-xl font-bold transition-all px-3"
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              {t("siteplan_editor.reset_points")}
            </Button>

            <Button
              size="sm"
              onClick={handleSaveShape}
              disabled={drawPoints.length < 3 || isPending}
              className="bg-[#4F6F52] hover:bg-[#3D563F] text-white text-xs h-9 rounded-xl font-bold shadow-glow-sage px-4 btn-premium"
            >
              <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
              {isPending ? t("siteplan_editor.saving") : t("siteplan_editor.save_mapping")}
            </Button>
          </div>
        )}

        {/* Delete shape button when shape is selected in view mode */}
        {selectedShapeIds.length > 0 && mode === "view" && (
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-9 rounded-xl font-bold border-[#D6DED2] text-[#4F6F52] hover:bg-[#F7F8F3]"
              onClick={() => setSelectedShapeIds([])}
            >
              {t("siteplan_editor.cancel_selection")} ({selectedShapeIds.length})
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-9 rounded-xl font-bold shadow-sm animate-in slide-in-from-right duration-200 btn-premium px-4"
              onClick={() => handleDeleteSelected()}
              disabled={isPending}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {t("siteplan_editor.delete_selected")}
            </Button>
          </div>
        )}
      </div>

      {/* ── TWO-COLUMN INTERACTIVE EDITOR GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

        {/* LEFT COLUMN: SVG Canvas (col-span-8) */}
        <div className="lg:col-span-8 relative rounded-3xl border border-[#D6DED2] overflow-hidden bg-white shadow-sage-lg">


          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            width="100%"
            style={{
              display: "block",
              maxHeight: "65vh",
              cursor: draggingVertexIndex !== null ? "grabbing" : draggingShape ? "move" : mode === "draw" ? "crosshair" : "default"
            }}
            onClick={handleSVGClick}
            onMouseMove={handleSVGMouseMove}
            onMouseUp={handleSVGMouseUp}
            onMouseLeave={handleSVGMouseUp}
            className="bg-[#F7F8F3]/50"
          >
            {/* Plain white background behind the image */}
            <rect width={width} height={height} fill="#ffffff" />

            {/* Blueprint blueprint image */}
            {imageUrl && (
              <image
                href={imageUrl}
                x={0}
                y={0}
                width={width}
                height={height}
                preserveAspectRatio="xMidYMid meet"
              />
            )}

            {/* Existing & Detected Shapes Loop */}
            {shapes.map((shape) => {
              const isSelected = selectedShapeIds.includes(shape.id);
              const isDraft = shape.id.startsWith("detected_");

              // Custom colors for draft detected lots vs existing lot status
              const color = isDraft
                ? { fill: "rgba(167, 139, 250, 0.15)", stroke: "#8B5CF6", text: "#8B5CF6" } // Lavender glowing border for draft detected shapes
                : getStatusColor(shape.unit?.status, (shape.unit as any)?.isReadyStock);

              const centroid = {
                x: shape.coordinates.reduce((a, c) => a + c.x, 0) / shape.coordinates.length,
                y: shape.coordinates.reduce((a, c) => a + c.y, 0) / shape.coordinates.length,
              };

              return (
                <g
                  key={shape.id}
                  style={{ cursor: mode === "view" ? "pointer" : "default" }}
                  onMouseDown={(e) => {
                    if (mode === "view") {
                      e.stopPropagation();
                      e.preventDefault();

                      let newSelection = [...selectedShapeIds];
                      if (e.shiftKey) {
                        if (isSelected) {
                          newSelection = newSelection.filter((id) => id !== shape.id);
                        } else {
                          newSelection.push(shape.id);
                        }
                      } else {
                        if (!isSelected) {
                          newSelection = [shape.id];
                        }
                      }

                      setSelectedShapeIds(newSelection);
                      setSelectedUnitId(newSelection.length === 1 ? (shape.unitId || "") : "");

                      // Initialize dragging for shape translation
                      setDraggingShape(true);
                      const pt = getSVGPoint(e);
                      setDragStartPoint(pt);

                      const coordsMap: Record<string, Point[]> = {};
                      shapes.forEach(s => {
                        if (newSelection.includes(s.id)) {
                          coordsMap[s.id] = [...s.coordinates];
                        }
                      });
                      setDragStartCoords(coordsMap);
                    }
                  }}
                  className="group"
                >
                  {/* Polygon Shape */}
                  <polygon
                    points={coordsToPolygonPoints(shape.coordinates)}
                    fill={color.fill}
                    fillOpacity={isSelected ? 0.95 : isDraft ? 0.6 : 0.85}
                    stroke={isSelected ? "#FF6B00" : color.stroke}
                    strokeWidth={isSelected ? 3.5 : isDraft ? 1.5 : 2.5}
                    strokeDasharray={isDraft && !isSelected ? "5 3" : undefined}
                    className="transition-all duration-200 group-hover:fill-opacity-50"
                  />

                  {/* Text Label code */}
                  <text
                    x={centroid.x}
                    y={centroid.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={9}
                    fill={isDraft ? "#6D28D9" : color.text || color.stroke}
                    fontFamily="var(--font-mono), monospace"
                    fontWeight="700"
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {shape.label ?? shape.unit?.code ?? (isDraft ? "OTOMATIS" : "")}
                  </text>
                </g>
              );
            })}

            {/* Corner Drag Handles for Selected Shape */}
            {selectedShape && (
              <g>
                {selectedShape.coordinates.map((pt, index) => (
                  <circle
                    key={index}
                    cx={pt.x}
                    cy={pt.y}
                    r={6}
                    fill="#FF6B00"
                    stroke="#ffffff"
                    strokeWidth={2}
                    className="cursor-pointer hover:scale-125 transition-transform"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setDraggingVertexIndex(index);
                    }}
                  />
                ))}
              </g>
            )}

            {/* Active drawing polygon trail */}
            {drawPoints.length > 0 && (
              <g>
                <polygon
                  points={coordsToPolygonPoints(drawPoints)}
                  fill="#FFF2C2"
                  stroke="#D2920F"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  opacity={0.65}
                />

                {/* Drawn points circles */}
                {drawPoints.map((pt, i) => (
                  <circle
                    key={i}
                    cx={pt.x}
                    cy={pt.y}
                    r={5.5}
                    fill="#D2920F"
                    stroke="#ffffff"
                    strokeWidth={1.8}
                    className="shadow-sm"
                  />
                ))}
              </g>
            )}
          </svg>
        </div>

        {/* RIGHT COLUMN: Sidebar Mapping Hub (col-span-4) */}
        <div className="lg:col-span-4 space-y-4">

          {/* AI Auto-Detect Controller */}
          <Card className="border-[#D6DED2] bg-[#F7F8F3]/60 backdrop-blur-sm shadow-sage rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-[#D6DED2]/40 bg-white">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-black text-[#243028] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-emerald-600 animate-pulse" />
                  {t("siteplan_editor.auto_scan")}
                </CardTitle>
              </div>
              <CardDescription className="text-[10px] text-[#66736A] leading-relaxed mt-1" dangerouslySetInnerHTML={{ __html: t("siteplan_editor.auto_scan_desc") }} />
            </CardHeader>
            <CardContent className="pt-4 bg-white/40">
              <Button
                type="button"
                onClick={handlePythonAutoDetect}
                disabled={isScanning || !imageUrl}
                className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {scanStatus}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {t("siteplan_editor.run_scan")}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Bulk Save Unsaved Shapes Panel */}
          {unsavedDetectedShapes.length > 0 && (
            <Card className="border-amber-300 bg-amber-50/70 shadow-md rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs font-black text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Grid3X3 className="h-4 w-4 text-amber-600" />
                  {t("siteplan_editor.save_auto")}
                </CardTitle>
                <CardDescription className="text-[10px] text-amber-700 leading-relaxed mt-1" dangerouslySetInnerHTML={{ __html: t("siteplan_editor.save_auto_desc").replace("{{count}}", unsavedDetectedShapes.length.toString()).replace(/<1>/g, "<strong>").replace(/<\/1>/g, "</strong>") }} />
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedShapeIds(unsavedDetectedShapes.map(s => s.id))}
                  className="w-full h-9 border-amber-300 text-amber-700 hover:bg-amber-100 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5"
                >
                  <MousePointer className="h-3.5 w-3.5" />
                  {t("siteplan_editor.select_all_auto")}
                </Button>
                <Button
                  type="button"
                  onClick={handleBulkSave}
                  disabled={isPending}
                  className="w-full h-10 bg-[#4F6F52] hover:bg-[#3D563F] text-white font-bold rounded-xl text-xs shadow-glow-sage transition-all flex items-center justify-center gap-1.5"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("siteplan_editor.bulk_saving")}
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      {t("siteplan_editor.bulk_save")} ({unsavedDetectedShapes.length} {t("siteplan_editor.unit_suffix")})
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    if (confirm("Batalkan semua hasil deteksi otomatis ini?")) {
                      setShapes((prev) => prev.filter((s) => !s.id.startsWith("detected_")));
                      setSelectedShapeIds([]);
                    }
                  }}
                  disabled={isPending}
                  variant="ghost"
                  className="w-full h-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-[10px] font-bold rounded-lg transition-all"
                >
                  <X className="mr-1.5 h-3 w-3" />
                  {t("siteplan_editor.cancel_auto")}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Selected Shape Inspector */}
          {selectedShape ? (
            <Card className="border-[#4F6F52]/30 bg-white shadow-sage rounded-2xl overflow-hidden animate-in slide-in-from-bottom duration-250">
              <CardHeader className="pb-3 border-b border-[#D6DED2]/40 bg-[#DDE8D8]/30">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-black text-[#4F6F52] uppercase tracking-wider flex items-center gap-1.5">
                    <Info className="h-4 w-4" />
                    {t("siteplan_editor.active_lot")}
                  </CardTitle>
                  <Badge variant="outline" className="text-[9px] font-mono bg-white border-[#D6DED2] text-[#66736A]">
                    {selectedShape.id.startsWith("detected_") ? t("siteplan_editor.draft_auto") : t("siteplan_editor.saved")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="text-[10px] text-[#66736A] space-y-1 bg-[#F7F8F3] p-2.5 rounded-xl border border-[#D6DED2]/40">
                  <div className="flex justify-between">
                    <span>{t("siteplan_editor.poly_id")}</span>
                    <span className="font-mono font-bold truncate max-w-[120px]">
                      {selectedShape.id.startsWith("detected_")
                        ? `Scan #${selectedShape.id.split("_").pop()}`
                        : selectedShape.id.substring(0, 8).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("siteplan_editor.linked_lot")}</span>
                    <span className="font-bold text-[#243028] font-mono">
                      {selectedShape.unit ? (
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                          {selectedShape.unit.code}
                        </span>
                      ) : (
                        <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                          {t("siteplan_editor.not_linked")}
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-1.5">
                  {selectedShape.unitId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleUnlinkUnit}
                      className="w-full text-[10px] h-8 border-rose-200 hover:bg-rose-50 hover:text-rose-600 text-rose-700 rounded-lg font-bold transition-all flex items-center justify-center gap-1"
                    >
                      <Unlink className="h-3 w-3" />
                      {t("siteplan_editor.unlink")}
                    </Button>
                  ) : (
                    <div className="text-[10px] text-center text-[#8FAF9A] w-full font-bold flex items-center justify-center gap-1.5 py-1">
                      <Link2 className="h-3 w-3" />
                      {t("siteplan_editor.link_prompt")}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="hidden lg:flex items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50/40 p-4 text-[10px] text-amber-700 font-bold leading-relaxed shadow-sm">
              <Move className="h-4.5 w-4.5 shrink-0 text-amber-600 group-hover:animate-bounce" />
              <span dangerouslySetInnerHTML={{ __html: t("siteplan_editor.tips").replace(/<1>/g, "<strong>").replace(/<\/1>/g, "</strong>") }} />
            </div>
          )}

          {/* Unmapped Units Collapsible Accordion */}
          <Card className="border-[#D6DED2] bg-white shadow-sage rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-[#D6DED2]/40 bg-[#F7F8F3]/60">
              <CardTitle className="text-xs font-black text-[#243028] uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-[#4F6F52]" />
                {t("siteplan_editor.unmapped")}
              </CardTitle>
              <CardDescription className="text-[10px] text-[#66736A] leading-relaxed mt-1" dangerouslySetInnerHTML={{ __html: t("siteplan_editor.unmapped_desc").replace(/<1>/g, "<strong>").replace(/<\/1>/g, "</strong>") }} />
            </CardHeader>
            <CardContent className="pt-4 max-h-[380px] overflow-y-auto space-y-2.5">
              {Object.keys(groupedUnits).length === 0 ? (
                <div className="py-6 text-center text-xs text-[#8FAF9A] font-bold flex flex-col items-center gap-2">
                  <CheckCircle className="h-8 w-8 text-emerald-500" />
                  <span>{t("siteplan_editor.all_mapped")}</span>
                </div>
              ) : (
                Object.entries(groupedUnits).map(([blockName, blockUnits]) => {
                  const isExpanded = expandedBlocks[blockName] ?? true;
                  return (
                    <div key={blockName} className="border border-[#D6DED2] rounded-xl overflow-hidden bg-[#F7F8F3]/50">
                      <button
                        type="button"
                        onClick={() => setExpandedBlocks((prev) => ({ ...prev, [blockName]: !isExpanded }))}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-black text-[#4F6F52] bg-[#DDE8D8]/50 hover:bg-[#DDE8D8]/70 transition-colors border-b border-[#D6DED2]/40"
                      >
                        <span className="flex items-center gap-1">
                          <Grid3X3 className="h-3.5 w-3.5" />
                          {blockName}
                        </span>
                        <Badge className="bg-white text-[#4F6F52] border border-[#8FAF9A]/20 font-mono text-[9px] font-black mr-1 py-0 px-1.5">
                          {blockUnits.length} {t("siteplan_editor.unit_suffix")}
                        </Badge>
                      </button>

                      {isExpanded && (
                        <div className="p-2 grid grid-cols-3 gap-1.5 bg-white max-h-[200px] overflow-y-auto">
                          {blockUnits.map((u) => {
                            const isCurrent = u.id === selectedUnitId;
                            return (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => handleLinkUnitToSelectedShape(u.id)}
                                className={`px-2 py-1 text-[10px] font-mono font-bold rounded-lg border text-center transition-all truncate
                                  ${isCurrent
                                    ? "bg-[#4F6F52] text-white border-[#4F6F52] shadow-sm"
                                    : "bg-[#F7F8F3] text-[#66736A] border-[#D6DED2] hover:border-[#8FAF9A] hover:bg-[#DDE8D8]/30"
                                  }`}
                              >
                                {u.code}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

        </div>

      </div>

      {/* ── DESIGN STANDARD DOCUMENTATION / HELP FOOTER ── */}
      <div className="flex items-center gap-3 rounded-2xl border border-[#DDE8D8] bg-[#DDE8D8]/20 px-4 py-3.5 text-xs text-[#4F6F52] shadow-sm font-semibold leading-relaxed">
        <Info className="h-4.5 w-4.5 shrink-0 text-[#4F6F52]" />
        {mode === "draw" ? (
          <span dangerouslySetInnerHTML={{ __html: t("siteplan_editor.guide_draw").replace(/<1>/g, "<strong>").replace(/<\/1>/g, "</strong>").replace(/<2>/g, "<strong>").replace(/<\/2>/g, "</strong>") }} />
        ) : (
          <span dangerouslySetInnerHTML={{ __html: t("siteplan_editor.guide_interactive").replace(/<1>/g, "<strong>").replace(/<\/1>/g, "</strong>") }} />
        )}
      </div>

    </div>
  );
}
