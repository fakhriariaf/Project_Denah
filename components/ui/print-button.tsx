"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

interface PrintButtonProps {
  /** Label teks tombol cetak. Default: "Cetak Kuitansi / STTB" */
  label?: string;
}

export function PrintButton({ label = "Cetak Kuitansi / STTB" }: PrintButtonProps) {
  const router = useRouter();


  return (
    <div className="no-print w-full bg-white/80 backdrop-blur-md border-b border-[#D6DED2] px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm animate-in fade-in duration-300">
      <Button
        variant="outline"
        size="sm"
        onClick={() => router.back()}
        className="rounded-xl border-[#D6DED2] text-[#66736A] hover:bg-[#F7F8F3] hover:text-[#4F6F52] transition-all font-medium text-xs flex items-center gap-1.5"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali
      </Button>

      <Button
        onClick={() => window.print()}
        className="bg-[#4F6F52] hover:bg-[#3F5941] text-white rounded-xl shadow-glow-sage hover:scale-[1.02] active:scale-[0.98] transition-all font-semibold text-xs flex items-center gap-2 px-4 py-2"
      >
        <Printer className="h-4 w-4" />
        {label}
      </Button>
    </div>
  );
}
