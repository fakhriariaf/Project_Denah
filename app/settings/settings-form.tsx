"use client";

import * as React from "react";
import { updateAppSettings } from "@/server/actions/settings";
import { checkFollowupReminders } from "@/server/actions/marketing";
import { checkPaymentReminders } from "@/server/actions/finance";
import { resetSimulatedData } from "@/server/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, ShieldCheck, Clock, CheckCircle2, AlertTriangle, Save, Bell, Trash2, Loader2 } from "lucide-react";
import { parseServerError } from "@/lib/error-parser";
import { useI18n } from "@/lib/i18n";

interface AppSettingRow {
  id: string;
  key: string;
  value: string | null;
  description: string | null;
  updatedBy: string | null;
  updatedAt: Date;
}

interface SettingsFormProps {
  initialSettings: AppSettingRow[];
}

export function SettingsForm({ initialSettings }: SettingsFormProps) {
  const [loading, setLoading] = React.useState(false);
  const [resetLoading, setResetLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const { t } = useI18n();

  // Map settings keys to dynamic form states
  const getVal = (key: string) => initialSettings.find((s) => s.key === key)?.value || "";
  
  const [companyName, setCompanyName] = React.useState(getVal("company_name"));
  const [companyAddress, setCompanyAddress] = React.useState(getVal("company_address"));
  const [companyPhone, setCompanyPhone] = React.useState(getVal("company_phone"));
  const [companyEmail, setCompanyEmail] = React.useState(getVal("company_email"));
  const [kprSlaDays, setKprSlaDays] = React.useState(getVal("kpr_sla_days"));
  const [systemMaintenance, setSystemMaintenance] = React.useState(getVal("system_maintenance") === "true");
  const [scanLoading, setScanLoading] = React.useState(false);
  const [scanResult, setScanResult] = React.useState<string | null>(null);

  const handleScanFollowups = async () => {
    setScanLoading(true);
    setScanResult(null);
    setError(null);
    try {
      const res = await checkFollowupReminders();
      if (res.success) {
        setScanResult(t("settings.msg_fu_ok").replace("{count}", res.notifiedCount.toString()));
        setTimeout(() => setScanResult(null), 6000);
      } else {
        setError(t("settings.msg_fu_fail"));
      }
    } catch (err: unknown) {
      setError(parseServerError(err));
    } finally {
      setScanLoading(false);
    }
  };

  const handleScanPayments = async () => {
    setScanLoading(true);
    setScanResult(null);
    setError(null);
    try {
      const res = await checkPaymentReminders();
      if (res.success) {
        setScanResult(t("settings.msg_pay_ok").replace("{count}", res.notifiedCount.toString()));
        setTimeout(() => setScanResult(null), 6000);
      } else {
        setError(t("settings.msg_pay_fail"));
      }
    } catch (err: unknown) {
      setError(parseServerError(err));
    } finally {
      setScanLoading(false);
    }
  };

  const handleResetData = async (mode: "transactions_only" | "all_data") => {
    if (!confirm(mode === "all_data" 
      ? t("settings.msg_wipe_warn") 
      : t("settings.msg_reset_warn")
    )) return;

    setResetLoading(true);
    setError(null);
    try {
      const res = await resetSimulatedData(mode);
      if (res.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 4000);
      }
    } catch (err: unknown) {
      setError(parseServerError(err));
    } finally {
      setResetLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    setError(null);

    // Sanitize and validate SLA days
    const parsedSla = parseInt(kprSlaDays, 10);
    if (isNaN(parsedSla) || parsedSla <= 0) {
      setError(t("settings.msg_sla_err"));
      setLoading(false);
      return;
    }

    try {
      const data = {
        company_name: companyName,
        company_address: companyAddress,
        company_phone: companyPhone,
        company_email: companyEmail,
        kpr_sla_days: parsedSla.toString(),
        system_maintenance: systemMaintenance ? "true" : "false",
      };

      const res = await updateAppSettings(data);
      if (res.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 4000);
      } else {
        setError(t("settings.msg_save_fail"));
      }
    } catch (err: unknown) {
      setError(parseServerError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {success && (
        <div className="p-4 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 rounded-xl border border-emerald-500/25 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 shadow-sm">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          <div className="text-sm font-semibold">{t("settings.msg_save_ok")}</div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-500/10 text-rose-700 dark:text-rose-300 rounded-xl border border-rose-500/25 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 shadow-sm">
          <AlertTriangle className="h-5 w-5 text-rose-600 flex-shrink-0" />
          <div className="text-sm font-semibold">{error}</div>
        </div>
      )}

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid grid-cols-4 w-full max-w-xl mb-6 bg-[#DDE8D8]/50 p-1 border border-[#D6DED2] rounded-xl dark:bg-muted dark:border-border">
          <TabsTrigger value="profile" className="rounded-lg text-xs font-semibold data-[state=active]:bg-[#4F6F52] data-[state=active]:text-white dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground">
            <Building2 className="h-3.5 w-3.5 mr-1.5" /> {t("settings.tab_profile")}
          </TabsTrigger>
          <TabsTrigger value="rules" className="rounded-lg text-xs font-semibold data-[state=active]:bg-[#4F6F52] data-[state=active]:text-white dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground">
            <Clock className="h-3.5 w-3.5 mr-1.5" /> {t("settings.tab_rules")}
          </TabsTrigger>
          <TabsTrigger value="system" className="rounded-lg text-xs font-semibold data-[state=active]:bg-[#4F6F52] data-[state=active]:text-white dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground">
            <ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> {t("settings.tab_system")}
          </TabsTrigger>
          <TabsTrigger value="reminders" className="rounded-lg text-xs font-semibold data-[state=active]:bg-[#4F6F52] data-[state=active]:text-white dark:data-[state=active]:bg-primary dark:data-[state=active]:text-primary-foreground">
            <Bell className="h-3.5 w-3.5 mr-1.5" /> {t("settings.tab_reminders")}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Profil Instansi */}
        <TabsContent value="profile" className="focus-visible:outline-none">
          <Card className="border-[#D6DED2] bg-card shadow-sage hover:shadow-sage-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg text-[#243028] font-bold">{t("settings.profile_title")}</CardTitle>
              <CardDescription className="text-xs">{t("settings.profile_desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="companyName" className="text-xs font-bold text-[#66736A] uppercase tracking-wider">{t("settings.company_name")} <span className="text-red-500">*</span></Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="PT. Denah Property Indonesia"
                  className="border-[#8FAF9A]/30 focus:ring-primary h-10 text-sm font-semibold"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="companyAddress" className="text-xs font-bold text-[#66736A] uppercase tracking-wider">{t("settings.company_address")} <span className="text-red-500">*</span></Label>
                <Textarea
                  id="companyAddress"
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  placeholder="Jl. Raya Cendana No. 12, Jakarta"
                  className="border-[#8FAF9A]/30 focus:ring-primary min-h-[100px] text-sm font-semibold"
                  required
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="companyPhone" className="text-xs font-bold text-[#66736A] uppercase tracking-wider">{t("settings.company_phone")} <span className="text-red-500">*</span></Label>
                  <Input
                    id="companyPhone"
                    value={companyPhone}
                    onChange={(e) => setCompanyPhone(e.target.value)}
                    placeholder="+62 812-3456-7890"
                    className="border-[#8FAF9A]/30 focus:ring-primary h-10 text-sm font-semibold font-mono"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="companyEmail" className="text-xs font-bold text-[#66736A] uppercase tracking-wider">{t("settings.company_email")} <span className="text-red-500">*</span></Label>
                  <Input
                    id="companyEmail"
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                    type="email"
                    placeholder="info@denahproperty.com"
                    className="border-[#8FAF9A]/30 focus:ring-primary h-10 text-sm font-semibold"
                    required
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Aturan & SLA */}
        <TabsContent value="rules" className="focus-visible:outline-none">
          <Card className="border-[#D6DED2] bg-card shadow-sage hover:shadow-sage-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg text-[#243028] font-bold">{t("settings.rules_title")}</CardTitle>
              <CardDescription className="text-xs">{t("settings.rules_desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 max-w-sm">
                <Label htmlFor="kprSlaDays" className="text-xs font-bold text-[#66736A] uppercase tracking-wider">{t("settings.kpr_sla")} <span className="text-red-500">*</span></Label>
                <div className="flex items-center gap-3">
                  <Input
                    id="kprSlaDays"
                    type="number"
                    value={kprSlaDays}
                    onChange={(e) => setKprSlaDays(e.target.value)}
                    className="border-[#8FAF9A]/30 focus:ring-primary h-10 text-sm font-semibold w-24 text-center font-mono"
                    required
                    min="1"
                    max="30"
                  />
                  <span className="text-xs font-bold text-[#66736A]">{t("settings.kpr_sla_days")}</span>
                </div>
                <p className="text-[10px] text-[#A8B0AA] mt-1">{t("settings.kpr_sla_note")}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Sistem & Mode */}
        <TabsContent value="system" className="focus-visible:outline-none">
          <Card className="border-[#D6DED2] bg-card shadow-sage hover:shadow-sage-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg text-[#243028] font-bold">{t("settings.sys_title")}</CardTitle>
              <CardDescription className="text-xs">{t("settings.sys_desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-xl border border-rose-500/20 bg-rose-500/8 dark:bg-rose-950/20 max-w-2xl">
                <div className="space-y-1 pr-4">
                  <Label htmlFor="maintenance" className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-rose-600" /> {t("settings.maint_title")}
                  </Label>
                  <p className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold leading-relaxed">
                    {t("settings.maint_desc")}
                  </p>
                </div>
                <button
                  id="maintenance"
                  type="button"
                  onClick={() => setSystemMaintenance(!systemMaintenance)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 ${
                    systemMaintenance ? "bg-rose-600" : "bg-[#DDE8D8]"
                  }`}
                  aria-pressed={systemMaintenance}
                >
                  <span className="sr-only">Toggle Mode Pemeliharaan</span>
                  <span
                    className={`pointer-events-none relative inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      systemMaintenance ? "translate-x-5" : "translate-x-0"
                    }`}
                  >
                    <span
                      className={`absolute inset-0 flex h-full w-full items-center justify-center transition-opacity duration-200 ${
                        systemMaintenance
                          ? "opacity-100 ease-in duration-200 text-rose-600"
                          : "opacity-0 ease-out duration-100"
                      }`}
                      aria-hidden="true"
                    >
                      <AlertTriangle className="h-2.5 w-2.5" />
                    </span>
                    <span
                      className={`absolute inset-0 flex h-full w-full items-center justify-center transition-opacity duration-200 ${
                        systemMaintenance
                          ? "opacity-0 ease-out duration-100"
                          : "opacity-100 ease-in duration-200 text-emerald-600"
                      }`}
                      aria-hidden="true"
                    >
                      <CheckCircle2 className="h-2.5 w-2.5" />
                    </span>
                  </span>
                </button>
              </div>

              {/* DANGER ZONE - HARD DELETE */}
              <div className="pt-6 mt-6 border-t border-rose-200 dark:border-rose-900/50">
                <h4 className="text-sm font-bold text-rose-600 mb-4 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> {t("settings.danger_zone")}
                </h4>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 flex flex-col justify-between gap-4">
                    <div>
                      <h5 className="text-sm font-bold text-rose-700">{t("settings.reset_trx_title")}</h5>
                      <p className="text-[10px] text-rose-600/80 mt-1">
                        {t("settings.reset_trx_desc")}
                      </p>
                    </div>
                    <Button 
                      type="button" 
                      variant="destructive"
                      disabled={resetLoading}
                      onClick={() => handleResetData("transactions_only")}
                      className="w-full text-xs font-bold"
                    >
                      {resetLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Trash2 className="h-3.5 w-3.5 mr-2" />}
                      {t("settings.btn_reset_trx")}
                    </Button>
                  </div>

                  <div className="p-4 rounded-xl border border-red-300 bg-red-100 flex flex-col justify-between gap-4">
                    <div>
                      <h5 className="text-sm font-bold text-red-800">{t("settings.wipe_data_title")}</h5>
                      <p className="text-[10px] text-red-700/80 mt-1">
                        {t("settings.wipe_data_desc")}
                      </p>
                    </div>
                    <Button 
                      type="button" 
                      variant="destructive"
                      disabled={resetLoading}
                      onClick={() => handleResetData("all_data")}
                      className="w-full text-xs font-bold bg-red-600 hover:bg-red-700"
                    >
                      {resetLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <AlertTriangle className="h-3.5 w-3.5 mr-2" />}
                      {t("settings.btn_wipe_data")}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Pemicu Pengingat */}
        <TabsContent value="reminders" className="focus-visible:outline-none">
          <Card className="border-[#D6DED2] bg-card shadow-sage hover:shadow-sage-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg text-[#243028] font-bold">{t("settings.rem_title")}</CardTitle>
              <CardDescription className="text-xs">{t("settings.rem_desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {scanResult && (
                <div className="p-4 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 rounded-xl border border-emerald-500/25 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 shadow-sm">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                  <div className="text-sm font-semibold">{scanResult}</div>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                {/* Follow-up Reminder Scanner */}
                <div className="p-5 rounded-2xl border border-[#D6DED2] bg-[#F7F8F3]/40 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Clock className="h-5 w-5" />
                    </div>
                    <h4 className="text-sm font-bold text-[#243028]">{t("settings.scan_fu_title")}</h4>
                    <p className="text-xs text-[#66736A] leading-relaxed">
                      {t("settings.scan_fu_desc")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleScanFollowups}
                    disabled={scanLoading}
                    className="bg-[#4F6F52] hover:bg-[#3D563F] text-white font-bold text-xs px-4 rounded-xl shadow-glow-sage flex items-center gap-1.5 h-10 w-full justify-center transition-all duration-300"
                  >
                    {scanLoading ? t("settings.txt_processing") : t("settings.btn_scan_fu")}
                  </Button>
                </div>

                {/* Payment Reminder Scanner */}
                <div className="p-5 rounded-2xl border border-[#D6DED2] bg-[#F7F8F3]/40 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                      <Bell className="h-5 w-5" />
                    </div>
                    <h4 className="text-sm font-bold text-[#243028]">{t("settings.scan_pay_title")}</h4>
                    <p className="text-xs text-[#66736A] leading-relaxed">
                      {t("settings.scan_pay_desc")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleScanPayments}
                    disabled={scanLoading}
                    className="bg-[#4F6F52] hover:bg-[#3D563F] text-white font-bold text-xs px-4 rounded-xl shadow-glow-sage flex items-center gap-1.5 h-10 w-full justify-center transition-all duration-300"
                  >
                    {scanLoading ? t("settings.txt_processing") : t("settings.btn_scan_pay")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
 
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#D6DED2]">
        <Button
          type="submit"
          className="bg-[#4F6F52] hover:bg-[#3D563F] text-white font-bold text-xs px-5 rounded-xl btn-premium shadow-glow-sage flex items-center gap-1.5 h-10 transition-all duration-300"
          disabled={loading}
        >
          {loading ? t("settings.txt_saving") : (
            <>
              <Save className="h-4 w-4" /> {t("settings.btn_save")}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
