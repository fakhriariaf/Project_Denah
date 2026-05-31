"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ChevronRight,
  AlertTriangle,
  Eye,
  PowerOff,
  CheckCircle2,
} from "lucide-react";

interface Props {
  projectId: string;
  projectName: string;
  status: "active" | "inactive" | "completed";
  hasSiteplan: boolean;
}

export function ProjectStatusGate({
  projectId,
  projectName,
  status,
  hasSiteplan,
}: Props) {
  const [showInactiveDialog, setShowInactiveDialog] = useState(false);

  // ── ACTIVE → perilaku normal ──────────────────────────────────────
  if (status === "active") {
    return (
      <Button
        size="sm"
        className={`font-bold text-xs rounded-xl h-9 transition-all duration-300 flex items-center justify-center gap-1 ${
          hasSiteplan
            ? "bg-[#4F6F52] hover:bg-[#3D563F] text-white shadow-glow-sage"
            : "bg-white hover:bg-[#F7F8F3] border border-[#D6DED2] text-[#4F6F52] hover:text-[#3D563F]"
        }`}
        nativeButton={false}
        render={
          <Link href={`/siteplan/${projectId}`} className="flex items-center gap-1">
            {hasSiteplan ? "Buka Siteplan" : "Upload Siteplan"}
            <ChevronRight className="h-4 w-4 shrink-0" />
          </Link>
        }
      />
    );
  }

  // ── COMPLETED → view-only link ────────────────────────────────────
  if (status === "completed") {
    return (
      <Button
        size="sm"
        className="font-bold text-xs rounded-xl h-9 transition-all duration-300 flex items-center justify-center gap-1 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 hover:text-purple-800"
        nativeButton={false}
        render={
          <Link href={`/siteplan/${projectId}`} className="flex items-center gap-1">
            <Eye className="h-3.5 w-3.5 shrink-0" />
            Lihat Saja
          </Link>
        }
      />
    );
  }

  // ── INACTIVE → dialog peringatan ─────────────────────────────────
  return (
    <>
      <Button
        size="sm"
        onClick={() => setShowInactiveDialog(true)}
        className="font-bold text-xs rounded-xl h-9 transition-all duration-300 flex items-center justify-center gap-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 hover:text-amber-800"
      >
        <PowerOff className="h-3.5 w-3.5 shrink-0" />
        Non Aktif
      </Button>

      <Dialog open={showInactiveDialog} onOpenChange={setShowInactiveDialog}>
        <DialogContent className="sm:max-w-sm rounded-3xl bg-white/98 backdrop-blur-md border border-[#D6DED2] shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden font-sans">
          {/* Header amber — inactive */}
          <div className="bg-gradient-to-r from-amber-50/80 via-white/90 to-transparent p-5 border-b border-amber-100/60">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center shadow-sm">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <DialogTitle className="text-base font-black text-[#243028] tracking-tight">
                    Perumahan Non Aktif
                  </DialogTitle>
                  <DialogDescription className="text-xs text-amber-600 mt-0.5 font-semibold">
                    Siteplan hanya tersedia untuk dibaca
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="p-5 space-y-4">
            <div className="p-3.5 bg-amber-50/70 border border-amber-100 rounded-xl text-xs text-amber-800 leading-relaxed">
              <span className="font-bold block mb-1">📋 {projectName}</span>
              Proyek ini berstatus <strong>Tidak Aktif</strong>. Siteplan
              masih bisa dilihat namun tidak bisa diedit, ditambah kavling,
              atau dilakukan booking unit baru.
            </div>

            <div className="text-[10px] text-[#66736A] flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#8FAF9A]" />
              Untuk mengaktifkan kembali, ubah status proyek di Master Data.
            </div>
          </div>

          <DialogFooter className="px-5 pb-5 pt-0 gap-2">
            <Button
              variant="outline"
              onClick={() => setShowInactiveDialog(false)}
              className="flex-1 border-[#D6DED2] text-[#66736A] hover:bg-[#F7F8F3] rounded-xl h-10 font-semibold text-xs"
            >
              Tutup
            </Button>
            <Button
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white rounded-xl h-10 text-xs font-bold shadow-[0_4px_14px_rgba(217,119,6,0.25)]"
              nativeButton={false}
              render={
                <Link href={`/siteplan/${projectId}`} className="flex items-center justify-center gap-1.5 w-full">
                  <Eye className="h-3.5 w-3.5" />
                  Tetap Lihat Siteplan
                </Link>
              }
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
