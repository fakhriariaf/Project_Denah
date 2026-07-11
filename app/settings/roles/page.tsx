import { requireAnyRole, getSessionRole } from "@/server/permissions"
import { db } from "@/db"
import { roles, permissions, rolePermissions } from "@/db/schema/access"
import { user as userTable } from "@/db/schema/auth"
import { eq, count } from "drizzle-orm"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  ShieldCheck, Users, Lock, KeyRound, Shield, ChevronRight,
} from "lucide-react"
import Link from "next/link"
import { RolePermissionsManager } from "./role-permissions-manager"
import { getI18n } from "@/lib/i18n-server"

export const revalidate = 0

// Role style config (colors & badges remain visual metadata)
const ROLE_STYLE_CFG: Record<string, { color: string; badge: string }> = {
  "Super Admin":       { color: "bg-purple-50/60 border-purple-100 text-purple-700", badge: "bg-purple-50 text-purple-700 border-purple-200" },
  "Admin Kantor":      { color: "bg-[#DDE8D8]/50 border-[#8FAF9A]/30 text-[#4F6F52]#1B2821]/30#8FAF9A]/10#8FAF9A]", badge: "bg-[#DDE8D8] text-[#4F6F52] border-[#8FAF9A]/40#1B2821]/60#8FAF9A]#8FAF9A]/20" },
  "Marketing Manager": { color: "bg-sky-50/60 border-sky-100 text-sky-700", badge: "bg-sky-50 text-sky-700 border-sky-200" },
  "Marketing":         { color: "bg-blue-50/60 border-blue-100 text-blue-700", badge: "bg-blue-50 text-blue-700 border-blue-200" },
  "Admin Keuangan":    { color: "bg-amber-50/60 border-amber-100 text-amber-700", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  "Direksi / Manager": { color: "bg-rose-50/60 border-rose-100 text-rose-700", badge: "bg-rose-50 text-rose-700 border-rose-200" },
  "Pengawas Lapangan": { color: "bg-orange-50/60 border-orange-100 text-orange-700", badge: "bg-orange-50 text-orange-700 border-orange-200" },
  "Kontraktor / Vendor": { color: "bg-indigo-50/60 border-indigo-100 text-indigo-700", badge: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  "Viewer":            { color: "bg-slate-50/60 border-slate-100 text-slate-600", badge: "bg-slate-50 text-slate-600 border-slate-200" },
}

const getRoleKey = (name: string) => {
  switch (name) {
    case "Super Admin": return "roles.desc_super_admin";
    case "Admin Kantor": return "roles.desc_admin_kantor";
    case "Marketing Manager": return "roles.desc_marketing_mgr";
    case "Marketing": return "roles.desc_marketing";
    case "Admin Keuangan": return "roles.desc_admin_keuangan";
    case "Direksi / Manager": return "roles.desc_direksi";
    case "Pengawas Lapangan": return "roles.desc_pengawas";
    case "Kontraktor / Vendor": return "roles.desc_vendor";
    case "Viewer": return "roles.desc_viewer";
    default: return null;
  }
}

export default async function RolesPermissionsPage() {
  const activeUser = await requireAnyRole(["Super Admin"])
  const { isSuperAdmin } = await getSessionRole(activeUser.id)
  if (!isSuperAdmin) redirect("/unauthorized")

  const { t } = await getI18n()

  // Fetch all data
  const [allRoles, allPermissions, allRolePerms, userCounts] = await Promise.all([
    db.select().from(roles).orderBy(roles.name),
    db.select().from(permissions).orderBy(permissions.resource, permissions.action),
    db.select().from(rolePermissions),
    db.select({
      roleId: userTable.roleId,
      count: count(userTable.id),
    })
    .from(userTable)
    .groupBy(userTable.roleId),
  ])

  // Build role → permissions map
  const rolePermMap: Record<string, Set<string>> = {}
  for (const rp of allRolePerms) {
    if (!rolePermMap[rp.roleId]) rolePermMap[rp.roleId] = new Set()
    rolePermMap[rp.roleId].add(rp.permissionId)
  }

  // Build user count map
  const userCountMap: Record<string, number> = {}
  for (const uc of userCounts) {
    if (uc.roleId) userCountMap[uc.roleId] = uc.count
  }

  // Group permissions by resource
  const permsByResource: Record<string, typeof allPermissions> = {}
  for (const perm of allPermissions) {
    if (!permsByResource[perm.resource]) permsByResource[perm.resource] = []
    permsByResource[perm.resource].push(perm)
  }

  const totalRoles = allRoles.length
  const totalPerms = allPermissions.length
  const totalMappings = allRolePerms.length

  return (
    <div className="flex flex-col gap-6">

      {/* ── PREMIUM HEADER ── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#DDE8D8]/70 via-white/95 to-[#DDE8D8]/40 border border-[#D6DED2] shadow-sage p-6">
        <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-[#8FAF9A]/10 blur-2xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-2xl bg-[#4F6F52] flex items-center justify-center shadow-[0_4px_12px_rgba(79,111,82,0.3)] shrink-0">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#243028] tracking-tight">{t("roles.page_title")}</h1>
              <p className="text-sm text-[#66736A] mt-0.5">
                {t("roles.page_desc")}
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/users"
            className="self-end md:self-center btn-premium flex items-center gap-2 px-4 py-2 rounded-xl bg-[#4F6F52] hover:bg-[#3D563F] text-white text-sm font-semibold shadow-sm"
          >
            <Users className="h-4 w-4" />
            {t("roles.manage_users")}
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white border-[#D6DED2] shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-premium">
          <CardContent className="p-5 flex items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[10px] text-[#66736A] font-bold uppercase tracking-wider">{t("roles.kpi_total_roles")}</p>
              <h3 className="text-2xl font-black font-mono text-[#243028] tabular-nums">{totalRoles}</h3>
              <p className="text-[10px] text-[#8FAF9A]">{t("roles.kpi_total_roles_desc")}</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Shield className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-[#D6DED2] shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-premium">
          <CardContent className="p-5 flex items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[10px] text-[#66736A] font-bold uppercase tracking-wider">{t("roles.kpi_total_perms")}</p>
              <h3 className="text-2xl font-black font-mono text-[#243028] tabular-nums">{totalPerms}</h3>
              <p className="text-[10px] text-[#8FAF9A]">{t("roles.kpi_total_perms_desc")}</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <KeyRound className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white border-[#D6DED2] shadow-sage hover:shadow-sage-lg hover:-translate-y-0.5 transition-premium">
          <CardContent className="p-5 flex items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[10px] text-[#66736A] font-bold uppercase tracking-wider">{t("roles.kpi_mappings")}</p>
              <h3 className="text-2xl font-black font-mono text-[#243028] tabular-nums">{totalMappings}</h3>
              <p className="text-[10px] text-[#8FAF9A]">{t("roles.kpi_mappings_desc")}</p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-[#DDE8D8] text-[#4F6F52] flex items-center justify-center shrink-0">
              <Lock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── ROLES OVERVIEW ── */}
      <div className="bg-white border border-[#D6DED2] rounded-2xl shadow-sage overflow-hidden">
        <div className="px-6 py-4 border-b border-[#D6DED2] bg-[#F7F8F3]/70">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#66736A] uppercase tracking-wider">{t("roles.list_title")}</span>
            <span className="text-xs font-mono text-[#8FAF9A] tabular-nums">{totalRoles} {t("roles.list_suffix")}</span>
          </div>
        </div>
        <div className="divide-y divide-[#D6DED2]/60">
          {allRoles.map((role) => {
            const cfg = ROLE_STYLE_CFG[role.name]
            const userCount = userCountMap[role.id] ?? 0
            const permCount = rolePermMap[role.id]?.size ?? 0
            const key = getRoleKey(role.name)
            const roleDesc = key ? t(key) : (role.description ?? "—")
            return (
              <div key={role.id} className="flex items-center gap-4 px-6 py-4 hover:bg-[#F7F8F3]/60#1C2B22]/30 transition-colors bg-white">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center border shrink-0 ${cfg?.color ?? "bg-slate-50 border-slate-100 text-slate-600"}`}>
                  <Shield className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-[#243028] text-sm">{role.name}</p>
                    <Badge className={`border text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg?.badge ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
                      {t("roles.user_badge", { count: userCount })}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#66736A] mt-0.5">{roleDesc}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-mono font-bold text-[#4F6F52] tabular-nums">{permCount}</p>
                  <p className="text-[10px] text-[#8FAF9A]">{t("roles.perm_suffix")}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── PERMISSION MATRIX ── */}
      <RolePermissionsManager
        roles={allRoles}
        permissions={allPermissions}
        permsByResource={permsByResource}
        rolePermMap={Object.fromEntries(
          Object.entries(rolePermMap).map(([k, v]) => [k, Array.from(v)])
        )}
      />
    </div>
  )
}
