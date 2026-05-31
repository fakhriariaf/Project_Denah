import React from "react";
import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-[#F7F8F3] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white/80 backdrop-blur-md border border-[#DDE8D8] rounded-2xl p-8 shadow-xl text-center space-y-6">
        <div className="mx-auto w-16 h-16 bg-[#F5EBEB] text-[#A94A4A] rounded-full flex items-center justify-center shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-[#2C3E2D] tracking-tight">
            Akses Ditolak
          </h1>
          <p className="text-sm text-[#5C6E5D] leading-relaxed">
            Maaf, Anda tidak memiliki hak akses yang cukup untuk melihat halaman ini. Silakan hubungi administrator jika Anda merasa ini adalah kesalahan.
          </p>
        </div>

        <div className="pt-4 border-t border-[#DDE8D8]/50">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#8FAF9A] text-white hover:bg-[#7da089] font-semibold text-sm transition-all shadow-md shadow-[#8FAF9A]/20"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Dasbor
          </Link>
        </div>
      </div>
    </div>
  );
}
