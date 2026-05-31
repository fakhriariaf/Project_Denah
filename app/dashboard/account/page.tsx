import { requireAuth, hasPermission, getSessionRole } from "@/server/permissions";
import { getUserProfileData } from "@/server/actions/profile";
import { ProfileShell } from "@/components/dashboard/profile-shell";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, User } from "lucide-react";
import { Translate } from "@/components/translate";

export default async function AccountPage() {
  const activeUser = await requireAuth();
  const { isSuperAdmin } = await getSessionRole(activeUser.id);

  let data;
  let permissions;
  let errorMsg: string | null = null;

  try {
    data = await getUserProfileData(activeUser.id);
    
    // Resolve personal permissions
    const canUpdateOwnBasic = await hasPermission(activeUser.id, "profile.update_own");
    const canUpdateAnyBasic = await hasPermission(activeUser.id, "profile.update_any");
    const canUpdateOwnVendor = await hasPermission(activeUser.id, "vendor_profile.update");

    permissions = {
      canUpdateBasic: canUpdateOwnBasic || canUpdateAnyBasic,
      canUpdateEmployment: false, // Internal staff cannot edit their own employment details (NIP, department, position)
      canUpdateVendor: canUpdateOwnVendor, // Vendors can edit their PIC details
      canUpdateStatus: false, // Users cannot change their own roles or suspend themselves
    };
  } catch (err: any) {
    errorMsg = err.message || "Gagal memuat profil akun Anda.";
  }

  if (errorMsg) {
    return (
      <Card className="border-rose-200 bg-rose-50/50">
        <CardContent className="pt-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-rose-800"><Translate namespace="account" translationKey="error_title" /></h3>
            <p className="text-sm text-rose-700 mt-1">
              {errorMsg === "Gagal memuat profil akun Anda." ? <Translate namespace="account" translationKey="error_load" /> : errorMsg}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── PREMIUM HEADER ── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#DDE8D8]/70 via-white/95 to-[#DDE8D8]/40 border border-[#D6DED2] shadow-sage p-6">
        <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-[#8FAF9A]/10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 h-20 w-20 rounded-full bg-[#4F6F52]/8 blur-xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-[#4F6F52] flex items-center justify-center shadow-[0_4px_12px_rgba(79,111,82,0.3)] shrink-0">
              <User className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-[#243028] tracking-tight"><Translate namespace="account" translationKey="page_title" /></h2>
              <p className="text-sm text-[#66736A] mt-0.5"><Translate namespace="account" translationKey="page_desc" /></p>
            </div>
          </div>
        </div>
      </div>

      <ProfileShell 
        data={data!}
        isOwnProfile={true}
        currentUserRole={activeUser.roleId || null}
        isSuperAdmin={isSuperAdmin}
        permissions={permissions!}
      />
    </div>
  );
}
