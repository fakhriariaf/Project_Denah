"use client";

import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center bg-[#F7F8F3] p-4">
        <div className="max-w-md w-full bg-white/80 backdrop-blur-md border border-[#DDE8D8] rounded-2xl p-8 shadow-xl text-center space-y-6 border-l-4 border-l-[#4F6F52]">
          {/* Error Icon */}
          <div className="mx-auto w-16 h-16 bg-[#F5EBEB] text-[#A94A4A] rounded-full flex items-center justify-center shadow-inner">
            <AlertTriangle className="w-8 h-8" />
          </div>

          {/* Heading and Description */}
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold text-[#2C3E2D] tracking-tight">
              Terjadi Kesalahan Sistem
            </h1>
            <p className="text-sm text-[#5C6E5D] leading-relaxed">
              Terjadi kesalahan yang tidak terduga pada sistem. Silakan coba lagi
              atau kembali ke halaman utama.
            </p>
            {error.digest && (
              <p className="text-xs text-[#8FAF9A] font-mono mt-1">
                Kode: {error.digest}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-[#DDE8D8]/50 flex flex-col items-center gap-3">
            <button
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#4F6F52] text-white hover:bg-[#3d5940] font-semibold text-sm transition-all shadow-md shadow-[#4F6F52]/20"
            >
              <RefreshCw className="w-4 h-4" />
              Coba Lagi
            </button>

            <a
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[#4F6F52] hover:bg-[#DDE8D8]/50 font-medium text-sm transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali ke Dashboard
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
