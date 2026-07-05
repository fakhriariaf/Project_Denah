import { redirect } from "next/navigation";
import { Construction, RefreshCw, Phone } from "lucide-react";
import { isMaintenanceMode } from "@/lib/maintenance-cache";

export default async function MaintenancePage() {
  const isActive = await isMaintenanceMode();

  // If maintenance mode is OFF, redirect user back to dashboard
  if (!isActive) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F8F3] p-4 relative overflow-hidden">
      {/* Decorative blurred orbs */}
      <div className="absolute top-[-15%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#8FAF9A]/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#4F6F52]/5 blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-white/80 backdrop-blur-md border border-[#DDE8D8] rounded-2xl p-8 shadow-xl text-center space-y-6 border-l-4 border-l-[#4F6F52] relative z-10">
        {/* Maintenance Icon */}
        <div className="mx-auto w-16 h-16 bg-[#DDE8D8] text-[#4F6F52] rounded-full flex items-center justify-center shadow-inner">
          <Construction className="w-8 h-8" />
        </div>

        {/* Heading and Description */}
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-[#243028] tracking-tight">
            Sistem Sedang Dalam Pemeliharaan
          </h1>
          <p className="text-sm text-[#66736A] leading-relaxed">
            Kami sedang melakukan pemeliharaan untuk meningkatkan layanan.
            Silakan coba beberapa saat lagi.
          </p>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-[#DDE8D8]/50 flex flex-col items-center gap-3">
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#4F6F52] text-white hover:bg-[#3d5940] font-semibold text-sm transition-all shadow-md shadow-[#4F6F52]/20"
          >
            <RefreshCw className="w-4 h-4" />
            Coba Lagi
          </a>

          <div className="flex items-center gap-1.5 text-xs text-[#66736A] mt-2">
            <Phone className="w-3.5 h-3.5" />
            <span>Hubungi Admin jika membutuhkan bantuan</span>
          </div>
        </div>
      </div>
    </div>
  );
}
