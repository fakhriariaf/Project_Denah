"use client";

import React, { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, RotateCcw, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n";

interface AuditFilterProps {
  users: { id: string; name: string; email: string }[];
}

export function AuditLogFilter({ users }: AuditFilterProps) {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const userId = searchParams.get("userId") || "";
  const moduleName = searchParams.get("module") || "";
  const actionName = searchParams.get("action") || "";
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";
  const levelFilter = searchParams.get("level") || "";
  const statusFilter = searchParams.get("status") || "";

  // Build & push new parameters
  const updateFilters = (newFilters: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    startTransition(() => {
      router.push(`/dashboard/audit?${params.toString()}`);
    });
  };

  const handleReset = () => {
    startTransition(() => {
      router.push("/dashboard/audit");
    });
  };

  return (
    <div className="bg-card border rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
          <Search className="w-4 h-4" />
          {t("audit.filter_title")}
        </h2>
        {isPending && (
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-mono">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
            {t("audit.updating")}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* User Filter */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">{t("audit.filter_user")}</label>
          <Select
            value={userId || "all"}
            onValueChange={(val) => updateFilters({ userId: val === "all" ? "" : val })}
            disabled={isPending}
            items={[{ label: t("audit.all_users"), value: "all" }, ...users.map((u) => ({ label: `${u.name} (${u.email})`, value: u.id }))] }
          >
            <SelectTrigger className="w-full text-xs rounded-xl border border-[#D6DED2] bg-white hover:bg-[#F7F8F3]/50 focus:ring-2 focus:ring-ring/20 h-10 px-3 transition-premium">
              <SelectValue placeholder={t("audit.all_users")}>
                {userId === "" || userId === "all" ? t("audit.all_users") : (() => {
                  const u = users.find(usr => usr.id === userId);
                  return u ? `${u.name} (${u.email})` : userId;
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="border-[#D6DED2] rounded-xl bg-white/95 backdrop-blur-md">
              <SelectItem value="all" className="text-xs">{t("audit.all_users")}</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id} className="text-xs">
                  {u.name} ({u.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Module Filter */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">{t("audit.filter_module")}</label>
          <Select
            value={moduleName || "all"}
            onValueChange={(val) => updateFilters({ module: val === "all" ? "" : val })}
            disabled={isPending}
            items={[
              { label: t("audit.all_modules"), value: "all" },
              { label: t("audit.mod_auth"), value: "auth" },
              { label: t("audit.mod_master"), value: "master" },
              { label: t("audit.mod_marketing"), value: "marketing" },
              { label: t("audit.mod_finance"), value: "finance" },
              { label: t("audit.mod_production"), value: "production" },
              { label: t("audit.mod_system"), value: "system" }
            ]}
          >
            <SelectTrigger className="w-full text-xs rounded-xl border border-[#D6DED2] bg-white hover:bg-[#F7F8F3]/50 focus:ring-2 focus:ring-ring/20 h-10 px-3 transition-premium text-capitalize">
              <SelectValue placeholder={t("audit.all_modules")}>
                {moduleName === "" || moduleName === "all" ? t("audit.all_modules") : ""}
                {moduleName === "auth" && t("audit.mod_auth")}
                {moduleName === "master" && t("audit.mod_master")}
                {moduleName === "marketing" && t("audit.mod_marketing")}
                {moduleName === "finance" && t("audit.mod_finance")}
                {moduleName === "production" && t("audit.mod_production")}
                {moduleName === "system" && t("audit.mod_system")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="border-[#D6DED2] rounded-xl bg-white/95 backdrop-blur-md">
              <SelectItem value="all" className="text-xs">{t("audit.all_modules")}</SelectItem>
              <SelectItem value="auth" className="text-xs">{t("audit.mod_auth")}</SelectItem>
              <SelectItem value="master" className="text-xs">{t("audit.mod_master")}</SelectItem>
              <SelectItem value="marketing" className="text-xs">{t("audit.mod_marketing")}</SelectItem>
              <SelectItem value="finance" className="text-xs">{t("audit.mod_finance")}</SelectItem>
              <SelectItem value="production" className="text-xs">{t("audit.mod_production")}</SelectItem>
              <SelectItem value="system" className="text-xs">{t("audit.mod_system")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Action Filter */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">{t("audit.filter_action")}</label>
          <Select
            value={actionName || "all"}
            onValueChange={(val) => updateFilters({ action: val === "all" ? "" : val })}
            disabled={isPending}
            items={[
              { label: t("audit.all_actions"), value: "all" },
              { label: t("audit.act_create"), value: "create" },
              { label: t("audit.act_update"), value: "update" },
              { label: t("audit.act_delete"), value: "delete" },
              { label: t("audit.act_approve"), value: "approve" },
              { label: t("audit.act_reject"), value: "reject" },
              { label: t("audit.act_login"), value: "login" },
              { label: t("audit.act_logout"), value: "logout" }
            ]}
          >
            <SelectTrigger className="w-full text-xs rounded-xl border border-[#D6DED2] bg-white hover:bg-[#F7F8F3]/50 focus:ring-2 focus:ring-ring/20 h-10 px-3 transition-premium text-capitalize">
              <SelectValue placeholder={t("audit.all_actions")}>
                {actionName === "" || actionName === "all" ? t("audit.all_actions") : ""}
                {actionName === "create" && t("audit.act_create")}
                {actionName === "update" && t("audit.act_update")}
                {actionName === "delete" && t("audit.act_delete")}
                {actionName === "approve" && t("audit.act_approve")}
                {actionName === "reject" && t("audit.act_reject")}
                {actionName === "login" && t("audit.act_login")}
                {actionName === "logout" && t("audit.act_logout")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="border-[#D6DED2] rounded-xl bg-white/95 backdrop-blur-md">
              <SelectItem value="all" className="text-xs">{t("audit.all_actions")}</SelectItem>
              <SelectItem value="create" className="text-xs">{t("audit.act_create")}</SelectItem>
              <SelectItem value="update" className="text-xs">{t("audit.act_update")}</SelectItem>
              <SelectItem value="delete" className="text-xs">{t("audit.act_delete")}</SelectItem>
              <SelectItem value="approve" className="text-xs">{t("audit.act_approve")}</SelectItem>
              <SelectItem value="reject" className="text-xs">{t("audit.act_reject")}</SelectItem>
              <SelectItem value="login" className="text-xs">{t("audit.act_login")}</SelectItem>
              <SelectItem value="logout" className="text-xs">{t("audit.act_logout")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Start Date */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">{t("audit.start_date")}</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => updateFilters({ startDate: e.target.value })}
            className="w-full text-xs rounded-lg border bg-background px-3 py-2 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none transition-all duration-200"
          />
        </div>

        {/* End Date */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">{t("audit.end_date")}</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => updateFilters({ endDate: e.target.value })}
            className="w-full text-xs rounded-lg border bg-background px-3 py-2 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 outline-none transition-all duration-200"
          />
        </div>

        {/* Level Filter */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Tingkat</label>
          <Select
            value={levelFilter || "all"}
            onValueChange={(val) => updateFilters({ level: val === "all" ? "" : val })}
            disabled={isPending}
          >
            <SelectTrigger className="w-full text-xs rounded-xl border border-[#D6DED2] bg-white hover:bg-[#F7F8F3]/50 focus:ring-2 focus:ring-ring/20 h-10 px-3 transition-premium">
              <SelectValue placeholder="Semua Tingkat">
                {levelFilter === "" || levelFilter === "all" ? "Semua Tingkat" : ""}
                {levelFilter === "log" && "🟢 Normal"}
                {levelFilter === "info" && "🔵 Informasi"}
                {levelFilter === "error" && "🔴 Kesalahan"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="border-[#D6DED2] rounded-xl bg-white/95 backdrop-blur-md">
              <SelectItem value="all" className="text-xs">Semua Tingkat</SelectItem>
              <SelectItem value="log" className="text-xs">🟢 Normal</SelectItem>
              <SelectItem value="info" className="text-xs">🔵 Informasi</SelectItem>
              <SelectItem value="error" className="text-xs">🔴 Kesalahan</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Status Filter */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Status</label>
          <Select
            value={statusFilter || "all"}
            onValueChange={(val) => updateFilters({ status: val === "all" ? "" : val })}
            disabled={isPending}
          >
            <SelectTrigger className="w-full text-xs rounded-xl border border-[#D6DED2] bg-white hover:bg-[#F7F8F3]/50 focus:ring-2 focus:ring-ring/20 h-10 px-3 transition-premium">
              <SelectValue placeholder="Semua Status">
                {statusFilter === "" || statusFilter === "all" ? "Semua Status" : ""}
                {statusFilter === "success" && "✅ Berhasil"}
                {statusFilter === "failed" && "❌ Gagal"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="border-[#D6DED2] rounded-xl bg-white/95 backdrop-blur-md">
              <SelectItem value="all" className="text-xs">Semua Status</SelectItem>
              <SelectItem value="success" className="text-xs">✅ Berhasil</SelectItem>
              <SelectItem value="failed" className="text-xs">❌ Gagal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {(userId || moduleName || actionName || startDate || endDate || levelFilter || statusFilter) && (
        <div className="flex justify-end pt-2">
          <button
            onClick={handleReset}
            disabled={isPending}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 px-4 py-2 rounded-lg flex items-center gap-1.5 hover:bg-emerald-100 transition-all duration-200"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t("audit.reset_filter")}
          </button>
        </div>
      )}
    </div>
  );
}
