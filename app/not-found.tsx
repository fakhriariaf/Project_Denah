import Link from "next/link";
import { FileQuestion, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="max-w-md w-full bg-white/80 dark:bg-card/80 backdrop-blur-md border border-[#DDE8D8] dark:border-border rounded-2xl p-8 shadow-xl text-center space-y-6 border-l-4 border-l-[#4F6F52]">
        {/* 404 Icon */}
        <div className="mx-auto w-16 h-16 bg-[#DDE8D8] dark:bg-muted text-[#4F6F52] dark:text-primary rounded-full flex items-center justify-center shadow-inner">
          <FileQuestion className="w-8 h-8" />
        </div>

        {/* Heading and Description */}
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-[#2C3E2D] dark:text-foreground tracking-tight">
            Halaman Tidak Ditemukan
          </h1>
          <p className="text-sm text-[#5C6E5D] dark:text-muted-foreground leading-relaxed">
            URL yang Anda akses tidak tersedia. Halaman mungkin telah dipindahkan
            atau tidak pernah ada.
          </p>
          <p className="text-6xl font-bold text-[#DDE8D8] dark:text-muted mt-2">
            404
          </p>
        </div>

        {/* Action */}
        <div className="pt-4 border-t border-[#DDE8D8]/50 dark:border-border/50 flex flex-col items-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#4F6F52] dark:bg-primary text-white hover:bg-[#3d5940] dark:hover:bg-primary/90 font-semibold text-sm transition-all shadow-md shadow-[#4F6F52]/20"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
