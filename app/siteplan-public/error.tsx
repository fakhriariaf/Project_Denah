"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function SiteplanPublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[siteplan-public error]:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 mb-6">
        <AlertCircle className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-[#243028] mb-2">Terjadi Kesalahan</h2>
      <p className="text-sm text-[#66736A] max-w-md mb-6">
        Maaf, terjadi kesalahan saat memuat siteplan. Silakan coba lagi.
      </p>
      <button
        onClick={reset}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#4F6F52] hover:bg-[#3d5a40] text-white text-sm font-semibold rounded-xl shadow-md transition-all"
      >
        <RefreshCw className="h-4 w-4" />
        Coba Lagi
      </button>
    </div>
  );
}
