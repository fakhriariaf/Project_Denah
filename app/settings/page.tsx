import { requireAuth, getSessionRole } from "@/server/permissions";
import { redirect } from "next/navigation";
import { getAppSettings } from "@/server/actions/settings";
import { SettingsForm } from "./settings-form";
import { Card } from "@/components/ui/card";
import { Settings } from "lucide-react";
import { Translate } from "@/components/translate";

export const revalidate = 0;

export default async function SettingsPage() {
  const activeUser = await requireAuth();
  
  // Enforce absolute Super Admin RBAC for settings page
  const { isSuperAdmin } = await getSessionRole(activeUser.id);
  if (!isSuperAdmin) {
    redirect("/unauthorized");
  }

  // Load app settings from DB (auto initializes if empty)
  const settings = await getAppSettings();

  return (
    <div className="flex flex-col gap-6">
      
      {/* ── PREMIUM HEADER ── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#DDE8D8]/70 via-card/90 to-[#DDE8D8]/40 border border-[#D6DED2] shadow-sage p-6">
        <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-[#8FAF9A]/10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 h-20 w-20 rounded-full bg-[#4F6F52]/8 blur-xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-[#4F6F52] flex items-center justify-center shadow-[0_4px_12px_rgba(79,111,82,0.3)] shrink-0">
              <Settings className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-[#243028] tracking-tight"><Translate namespace="settings" translationKey="title" /></h2>
              <p className="text-sm text-[#66736A] mt-0.5"><Translate namespace="settings" translationKey="subtitle" /></p>
            </div>
          </div>
        </div>
      </div>

      {/* Main tabbed settings form */}
      <SettingsForm initialSettings={settings} />

    </div>
  );
}
