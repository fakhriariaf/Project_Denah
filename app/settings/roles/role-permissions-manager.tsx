"use client";

import { useState, useTransition, Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Shield, Check, X, ChevronDown, ChevronRight, Loader2, Lock,
} from "lucide-react";
import { grantPermission, revokePermission } from "@/server/actions/rbac";
import { useI18n } from "@/lib/i18n";

interface Role { id: string; name: string }
interface Permission { id: string; action: string; resource: string; description: string | null }
type PermsByResource = Record<string, Permission[]>

interface Props {
  roles: Role[];
  permissions: Permission[];
  permsByResource: PermsByResource;
  rolePermMap: Record<string, string[]>; // roleId → [permissionId[]]
}

const ACTION_COLORS: Record<string, string> = {
  create: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/20",
  read:   "text-sky-600 bg-sky-50 dark:text-sky-400 dark:bg-sky-950/20",
  update: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/20",
  delete: "text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/20",
  approve:"text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-950/20",
  reject: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950/20",
  export: "text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/20",
};

function getFriendlyActionInfo(action: string, t: any) {
  const labelMap: Record<string, string> = {
    "user.read":            t("roles.act_view"),
    "user.create":          t("roles.act_add"),
    "user.update":          t("roles.act_edit"),
    "user.delete":          t("roles.act_delete"),
    "user.assign_role":     t("roles.act_assign_role"),
    "profile.read":         t("roles.act_profile_read"),
    "profile.update_own":   t("roles.act_profile_update_own"),
    "profile.update_any":   t("roles.act_profile_update_any"),
    "employment.read":      t("roles.act_employment_read"),
    "employment.update":    t("roles.act_employment_update"),
    "vendor_profile.read":  t("roles.act_vendor_profile_read"),
    "vendor_profile.update":t("roles.act_vendor_profile_update"),
    "account.security.read":t("roles.act_account_security_read"),
    "account.status.update":t("roles.act_account_status_update"),
  };

  const colorKeyMap: Record<string, string> = {
    "user.read":            "read",
    "user.create":          "create",
    "user.update":          "update",
    "user.delete":          "delete",
    "user.assign_role":     "approve",
    "profile.read":         "read",
    "profile.update_own":   "update",
    "profile.update_any":   "update",
    "employment.read":      "read",
    "employment.update":    "update",
    "vendor_profile.read":  "read",
    "vendor_profile.update":"update",
    "account.security.read":"read",
    "account.status.update":"update",
  };

  if (labelMap[action]) {
    return {
      label: labelMap[action],
      colorClass: ACTION_COLORS[colorKeyMap[action]] ?? "text-slate-600 bg-slate-50 dark:text-slate-400 dark:bg-slate-900/30",
    };
  }

  const parts = action.split(".");
  const baseAction = parts.pop() || action;
  
  const baseLabelMap: Record<string, string> = {
    create:  t("roles.act_add"),
    read:    t("roles.act_view"),
    update:  t("roles.act_edit"),
    delete:  t("roles.act_delete"),
    approve: t("roles.act_approve"),
    reject:  t("roles.act_reject"),
    export:  t("roles.act_export"),
  };

  const friendlyLabel = baseLabelMap[baseAction] ?? baseAction;
  const colorClass = ACTION_COLORS[baseAction] ?? "text-slate-600 bg-slate-50 dark:text-slate-400 dark:bg-slate-900/30";

  return {
    label: friendlyLabel,
    colorClass,
  };
}

// Super Admin always has all permissions — immutable
const SUPER_ADMIN_NAME = "Super Admin";

export function RolePermissionsManager({ roles, permsByResource, rolePermMap }: Props) {
  const { t } = useI18n();

  // Local state: track which role+perm combos are granted
  const [localMap, setLocalMap] = useState<Record<string, Set<string>>>(
    Object.fromEntries(
      Object.entries(rolePermMap).map(([roleId, permIds]) => [roleId, new Set(permIds)])
    )
  );
  const [expandedResources, setExpandedResources] = useState<Set<string>>(
    new Set() // semua group collapsed by default — user expand manual
  );
  const [isPending, startTransition] = useTransition();
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  const toggleResource = (resource: string) => {
    setExpandedResources((prev) => {
      const next = new Set(prev);
      if (next.has(resource)) next.delete(resource);
      else next.add(resource);
      return next;
    });
  };

  const hasPermission = (roleId: string, permId: string) => {
    return localMap[roleId]?.has(permId) ?? false;
  };

  const togglePermission = (role: Role, permId: string) => {
    if (role.name === SUPER_ADMIN_NAME) return; // immutable

    const key = `${role.id}:${permId}`;
    setTogglingKey(key);

    const currently = hasPermission(role.id, permId);

    startTransition(async () => {
      try {
        if (currently) {
          await revokePermission(role.id, permId);
          setLocalMap((prev) => {
            const next = { ...prev };
            next[role.id] = new Set(prev[role.id]);
            next[role.id].delete(permId);
            return next;
          });
        } else {
          await grantPermission(role.id, permId);
          setLocalMap((prev) => {
            const next = { ...prev };
            if (!next[role.id]) next[role.id] = new Set();
            next[role.id] = new Set(prev[role.id]);
            next[role.id].add(permId);
            return next;
          });
        }
      } catch (err) {
        console.error("Toggle permission failed:", err);
      } finally {
        setTogglingKey(null);
      }
    });
  };

  const resources = Object.keys(permsByResource).sort();
  // Put Super Admin first in column order
  const sortedRoles = [...roles].sort((a, b) => {
    if (a.name === SUPER_ADMIN_NAME) return -1;
    if (b.name === SUPER_ADMIN_NAME) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <Card className="bg-white border-[#D6DED2] shadow-sage rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-[#D6DED2] bg-[#F7F8F3]/70">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-[#4F6F52]" />
            <span className="text-xs font-bold text-[#66736A] uppercase tracking-wider">{t("roles.matrix_title")}</span>
          </div>
          {isPending && (
            <div className="flex items-center gap-1.5 text-xs text-[#66736A]">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t("roles.matrix_saving")}
            </div>
          )}
        </div>
        <p className="text-xs text-[#66736A] mt-1">
          {t("roles.matrix_desc")}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b border-[#D6DED2] bg-[#F7F8F3]/50 sticky top-0 z-10">
              <th className="py-3.5 px-5 text-left min-w-[200px]">
                <span className="text-xs font-bold text-[#66736A] uppercase tracking-wider">{t("roles.matrix_col_resource")}</span>
              </th>
              {sortedRoles.map((role) => (
                <th key={role.id} className="py-3.5 px-3 text-center min-w-[100px]">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${role.name === SUPER_ADMIN_NAME ? "bg-purple-100 text-purple-700" : "bg-[#DDE8D8] text-[#4F6F52]"}`}>
                      <Shield className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[9px] font-bold text-[#66736A] uppercase tracking-wide text-center leading-tight max-w-[90px]">
                      {role.name}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resources.map((resource) => {
              const perms = permsByResource[resource];
              const expanded = expandedResources.has(resource);
              const label = t(`roles.res_${resource}` as any) || resource;
              return (
                <Fragment key={resource}>
                  {/* Resource group header */}
                  <tr
                    key={`header-${resource}`}
                    onClick={() => toggleResource(resource)}
                    className="cursor-pointer hover:bg-[#DDE8D8]/30 transition-colors border-b border-[#D6DED2]/60 bg-[#F7F8F3]/40"
                  >
                    <td className="py-2.5 px-5" colSpan={sortedRoles.length + 1}>
                      <div className="flex items-center gap-2">
                        {expanded
                          ? <ChevronDown className="h-3.5 w-3.5 text-[#8FAF9A]" />
                          : <ChevronRight className="h-3.5 w-3.5 text-[#8FAF9A]" />
                        }
                        <span className="text-xs font-bold text-[#243028]">{label}</span>
                        <Badge className="border-[#D6DED2] text-[#66736A] text-[9px] px-1.5 py-0 rounded-full font-bold">
                          {perms.length} {t("roles.matrix_action_suffix")}
                        </Badge>
                      </div>
                    </td>
                  </tr>

                  {/* Permission rows */}
                  {expanded && perms.map((perm) => {
                    const info = getFriendlyActionInfo(perm.action, t);
                    return (
                      <tr key={perm.id} className="border-b border-[#D6DED2]/40 hover:bg-[#F7F8F3]/50 transition-colors">
                        <td className="py-2.5 px-5 pl-10">
                          <div className="flex items-center gap-3">
                            <Badge className={`border-transparent text-[9px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 ${info.colorClass}`}>
                              {info.label}
                            </Badge>
                            <span className="text-xs text-[#66736A] font-medium">{perm.description ?? perm.resource}</span>
                          </div>
                        </td>
                        {sortedRoles.map((role) => {
                          const isSuperAdmin = role.name === SUPER_ADMIN_NAME;
                          const granted = isSuperAdmin || hasPermission(role.id, perm.id);
                          const key = `${role.id}:${perm.id}`;
                          const loading = togglingKey === key;

                          return (
                            <td key={role.id} className="py-2.5 px-3 text-center">
                              <button
                                onClick={() => togglePermission(role, perm.id)}
                                disabled={isSuperAdmin || loading}
                                className={`h-6 w-6 rounded-md mx-auto flex items-center justify-center transition-all duration-150 border ${
                                  isSuperAdmin
                                    ? "bg-purple-100 border-purple-200 cursor-not-allowed"
                                    : granted
                                      ? "bg-emerald-100 border-emerald-200 hover:bg-emerald-200 cursor-pointer"
                                      : "bg-white border-[#D6DED2] hover:border-[#8FAF9A] hover:bg-[#DDE8D8]/30 cursor-pointer"
                                }`}
                                title={isSuperAdmin ? t("roles.matrix_tip_super") : granted ? t("roles.matrix_tip_revoke") : t("roles.matrix_tip_grant")}
                              >
                                {loading ? (
                                  <Loader2 className="h-3 w-3 text-[#4F6F52] animate-spin" />
                                ) : granted ? (
                                  <Check className={`h-3 w-3 ${isSuperAdmin ? "text-purple-600" : "text-emerald-600"}`} />
                                ) : (
                                  <X className="h-3 w-3 text-[#A8B0AA]" />
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="px-6 py-3 border-t border-[#D6DED2]/40 bg-[#F7F8F3]/50">
        <div className="flex flex-wrap gap-4 text-xs text-[#66736A]">
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-5 rounded-md bg-emerald-100 border border-emerald-200 flex items-center justify-center">
              <Check className="h-3 w-3 text-emerald-600" />
            </div>
            <span>{t("roles.matrix_legend_granted")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-5 rounded-md bg-white border border-[#D6DED2] flex items-center justify-center">
              <X className="h-3 w-3 text-[#A8B0AA]" />
            </div>
            <span>{t("roles.matrix_legend_denied")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-5 rounded-md bg-purple-100 border border-purple-200 flex items-center justify-center">
              <Check className="h-3 w-3 text-purple-600" />
            </div>
            <span>{t("roles.matrix_legend_super")}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
