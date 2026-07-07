"use client";
import { useRouter } from "next/navigation";

import { useState } from "react";
import { createBooking } from "@/server/actions/marketing";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PlusCircle, AlertCircle, CheckCircle, Building2, User, DollarSign, CalendarDays } from "lucide-react";
import { parseServerError } from "@/lib/error-parser";
import { handleActionResult, type ActionResult } from "@/lib/action-utils";
import { useI18n } from "@/lib/i18n";
import { Translate } from "@/components/translate";

interface Props {
  projects: { id: string; name: string }[];
  units: { id: string; code: string; projectId: string; price: number; status: string }[];
  customers: { id: string; name: string; phone?: string | null }[];
  leads?: { id: string; name: string; phone: string; status: string; assignedMarketingId: string | null }[];
  marketings: { id: string; name: string; roleName?: string | null }[];
  currentUser: { id: string; name: string };
  initialProjectId?: string;
  initialUnitId?: string;
  triggerButton?: React.ReactElement;
  onSuccess?: () => void;
}

export default function AddBookingDialog({
  projects,
  units,
  customers,
  leads = [],
  marketings,
  currentUser,
  initialProjectId = "",
  initialUnitId = "",
  triggerButton,
  onSuccess,
}: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state — rupiah fields stored as raw integer, displayed with formatting
  const [projectId, setProjectId] = useState(initialProjectId);
  const [unitId, setUnitId] = useState(initialUnitId);
  const [customerId, setCustomerId] = useState("");
  const [marketingId, setMarketingId] = useState(currentUser.id);
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split("T")[0]);
  const [bookingFeeRaw, setBookingFeeRaw] = useState(5_000_000); // stored as integer
  const [dpAmountRaw, setDpAmountRaw] = useState(0);             // stored as integer
  const [paymentScheme, setPaymentScheme] = useState<"cash" | "kpr" | "installment">("kpr");
  const [bookingNumber, setBookingNumber] = useState("");

  const [isLeadSelected, setIsLeadSelected] = useState(false);
  const [nik, setNik] = useState("");
  const [installmentTerm, setInstallmentTerm] = useState<number>(3);

  // Filter units by selected project
  const filteredUnits = units.filter(
    (u) => (projectId === "" || u.projectId === projectId) && (u.status === "available" || u.id === initialUnitId)
  );

  // Auto fill unit price as DP hint
  const selectedUnit = units.find((u) => u.id === unitId);

  const selectedLeadName = leads?.find((l) => l.id === customerId)?.name || "";

  const reset = () => {
    setProjectId(initialProjectId);
    setUnitId(initialUnitId);
    setCustomerId("");
    setMarketingId(currentUser.id);
    setBookingDate(new Date().toISOString().split("T")[0]);
    setBookingFeeRaw(5_000_000);
    setDpAmountRaw(0);
    setPaymentScheme("kpr");
    setBookingNumber("");
    setInstallmentTerm(3);
    setIsLeadSelected(false);
    setNik("");
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!projectId) { setError(t("booking_form.error_project")); return; }
    if (!unitId) { setError(t("booking_form.error_unit")); return; }
    if (!customerId) { setError(t("booking_form.error_customer")); return; }
    if (!marketingId) { setError(t("booking_form.error_marketing")); return; }
    if (isLeadSelected && (!nik || !/^\d{16}$/.test(nik))) { setError(t("booking_form.error_nik")); return; }

    setLoading(true);
    try {
      const res = await createBooking({
        projectId,
        unitId,
        customerId,
        marketingId,
        bookingDate: new Date(bookingDate),
        bookingFee: bookingFeeRaw,
        dpAmount: dpAmountRaw,
        paymentScheme,
        bookingNumber: bookingNumber || undefined,
        status: "active",
        nik: isLeadSelected ? nik : undefined,
        isLead: isLeadSelected,
        termin: paymentScheme === "installment" ? installmentTerm : undefined,
      });

      const unitCode = units.find((u) => u.id === unitId)?.code || "";
      const result: ActionResult<typeof res> = { success: true, data: res };
      if (handleActionResult(result, { successMessage: `Booking ${res.bookingNumber || bookingNumber} untuk unit ${unitCode} berhasil dibuat` })) {
        setTimeout(() => {
          setOpen(false);
          reset();
          if (onSuccess) {
            onSuccess();
          } else {
            router.refresh();
          }
        }, 1200);
      }
    } catch (err: any) {
      const errorMsg = parseServerError(err);
      handleActionResult({ success: false, error: errorMsg });
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Format display only — raw value stored separately
  const formatRupiahDisplay = (val: number) =>
    val.toLocaleString("id-ID");

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger nativeButton render={
        triggerButton || (
          <Button className="bg-[#4F6F52] hover:bg-[#3F5941] text-white font-bold rounded-xl px-4 py-2 flex items-center gap-2 shadow-[0_2px_8px_rgba(79,111,82,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all">
            <PlusCircle className="h-4 w-4" />
            {t("booking_form.add_btn")}
          </Button>
        )
      } />

      <DialogContent className="sm:max-w-2xl bg-white/98 rounded-3xl backdrop-blur-md border border-[#D6DED2] shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-[#D6DED2]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-[#243028] tracking-tight flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-[#4F6F52] text-white flex items-center justify-center">
                <PlusCircle className="h-4 w-4" />
              </div>
              {t("booking_form.add_title")}
            </DialogTitle>
            <p className="text-xs text-[#66736A] mt-1">
              {t("booking_form.add_desc")}
            </p>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[65vh]">
          {/* Alerts */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {error.startsWith("val.") ? t(error as any) : error}
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-semibold">
              <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {success}
            </div>
          )}

          {/* Project & Unit */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-[#D6DED2]/60">
              <Building2 className="h-4 w-4 text-[#8FAF9A]" />
              <span className="text-xs font-bold text-[#243028] uppercase tracking-wider">{t("booking_form.section_property")}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#66736A]">{t("booking_form.project")} <span className="text-red-500">*</span></Label>
                {initialProjectId ? (
                  <Input
                    value={projects.find((p) => p.id === projectId)?.name || ""}
                    disabled
                    readOnly
                    className="w-full h-10 rounded-xl border border-[#D6DED2] bg-[#F7F8F3]/60 px-3 text-sm font-semibold text-[#243028] disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                ) : (
                  <select
                    value={projectId}
                    onChange={(e) => { setProjectId(e.target.value); setUnitId(""); }}
                    required
                    className="w-full h-10 rounded-xl border border-[#D6DED2] bg-[#F7F8F3]/60 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8FAF9A]/50 focus:border-[#8FAF9A]"
                  >
                    <option value="">{t("booking_form.project_placeholder")}</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#66736A]">{t("booking_form.unit")} <span className="text-red-500">*</span></Label>
                {initialUnitId ? (
                  <Input
                    value={units.find((u) => u.id === unitId)?.code || ""}
                    disabled
                    readOnly
                    className="w-full h-10 rounded-xl border border-[#D6DED2] bg-[#F7F8F3]/60 px-3 text-sm font-semibold text-[#243028] font-mono disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                ) : (
                  <select
                    value={unitId}
                    onChange={(e) => setUnitId(e.target.value)}
                    required
                    disabled={!projectId}
                    className="w-full h-10 rounded-xl border border-[#D6DED2] bg-[#F7F8F3]/60 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8FAF9A]/50 focus:border-[#8FAF9A] font-mono"
                  >
                    <option value="">{t("booking_form.unit_placeholder")}</option>
                    {filteredUnits.map((u) => (
                      <option key={u.id} value={u.id}>{u.code}</option>
                    ))}
                  </select>
                )}
                {selectedUnit && (
                  <p className="text-[10px] text-[#4F6F52] font-mono font-semibold">
                    {t("booking_form.price")} Rp {selectedUnit.price.toLocaleString("id-ID")}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Konsumen & Marketing */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-[#D6DED2]/60">
              <User className="h-4 w-4 text-[#8FAF9A]" />
              <span className="text-xs font-bold text-[#243028] uppercase tracking-wider">{t("booking_form.section_parties")}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#66736A]">{t("booking_form.customer")} <span className="text-red-500">*</span></Label>
                <select
                  value={customerId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomerId(val);
                    const isLd = leads?.some(l => l.id === val);
                    setIsLeadSelected(!!isLd);
                  }}
                  required
                  className="w-full h-10 rounded-xl border border-[#D6DED2] bg-[#F7F8F3]/60 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8FAF9A]/50 focus:border-[#8FAF9A]"
                >
                  <option value="">{t("booking_form.customer_placeholder")}</option>
                  <optgroup label={t("booking_form.customer_group_customers")}>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                  {leads && leads.length > 0 && (
                    <optgroup label={t("booking_form.customer_group_leads")}>
                      {leads.filter(l => l.status === "converted").map((l) => (
                        <option key={l.id} value={l.id}>{l.name} ({t("booking_form.customer_deal")} - {l.phone})</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#66736A]">{t("booking_form.marketing")} <span className="text-red-500">*</span></Label>
                <select
                  value={marketingId}
                  onChange={(e) => setMarketingId(e.target.value)}
                  required
                  className="w-full h-10 rounded-xl border border-[#D6DED2] bg-[#F7F8F3]/60 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8FAF9A]/50 focus:border-[#8FAF9A]"
                >
                  {marketings.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id === currentUser.id ? `${m.name} (${t("booking_form.marketing_self")})` : m.name}
                    </option>
                  ))}
                </select>
              </div>

              {isLeadSelected && (
                <div className="col-span-2 space-y-1.5 p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl animate-fade-in text-left">
                  <Label className="text-xs font-extrabold text-amber-800 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
                    {t("booking_form.nik")} {selectedLeadName ? `(${selectedLeadName})` : ""} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={nik}
                    onChange={(e) => setNik(e.target.value)}
                    placeholder={t("booking_form.nik_placeholder")}
                    required
                    maxLength={16}
                    minLength={16}
                    className="h-10 rounded-xl border-amber-300 bg-white text-sm font-mono focus:border-amber-500 focus:ring-amber-500/40 text-[#243028]"
                  />
                  <p className="text-[10px] text-amber-700 font-bold leading-normal">
                    {t("booking_form.nik_note")}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Pembayaran */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-[#D6DED2]/60">
              <DollarSign className="h-4 w-4 text-[#8FAF9A]" />
              <span className="text-xs font-bold text-[#243028] uppercase tracking-wider">{t("booking_form.section_payment")}</span>
            </div>

            <div className={`grid ${paymentScheme === "installment" ? "grid-cols-2 md:grid-cols-4" : "grid-cols-3"} gap-3`}>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#66736A]">{t("booking_form.scheme")} <span className="text-red-500">*</span></Label>
                <select
                  value={paymentScheme}
                  onChange={(e) => setPaymentScheme(e.target.value as any)}
                  className="w-full h-10 rounded-xl border border-[#D6DED2] bg-[#F7F8F3]/60 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8FAF9A]/50"
                >
                  <option value="kpr">{t("booking.scheme_kpr")}</option>
                  <option value="cash">{t("booking.scheme_cash")}</option>
                  <option value="installment">{t("booking.scheme_installment")}</option>
                </select>
              </div>

              {paymentScheme === "installment" && (
                <div className="space-y-1 animate-fade-in text-left">
                  <Label className="text-xs font-semibold text-[#66736A]">{t("booking_form.termin")} <span className="text-red-500">*</span></Label>
                  <select
                    value={installmentTerm}
                    onChange={(e) => setInstallmentTerm(Number(e.target.value))}
                    className="w-full h-10 rounded-xl border border-[#D6DED2] bg-[#F7F8F3]/60 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8FAF9A]/50 focus:border-[#8FAF9A]"
                  >
                    <option value={3}>{t("booking_form.termin_3")}</option>
                    <option value={6}>{t("booking_form.termin_6")}</option>
                    <option value={12}>{t("booking_form.termin_12")}</option>
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#66736A]">{t("booking_form.bf")} <span className="text-[#8FAF9A] font-normal">(Opsional)</span></Label>
                <Input
                  type="number"
                  value={bookingFeeRaw || ""}
                  onChange={(e) => setBookingFeeRaw(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="5000000"
                  min={0}
                  className="h-10 rounded-xl border-[#D6DED2] bg-[#F7F8F3]/60 text-sm font-mono focus:border-[#8FAF9A] focus:ring-[#8FAF9A]/40"
                />
                {bookingFeeRaw > 0 && (
                  <p className="text-[10px] text-[#4F6F52] font-mono">Rp {formatRupiahDisplay(bookingFeeRaw)}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#66736A]">{t("booking_form.dp")} <span className="text-[#8FAF9A] font-normal">(Opsional)</span></Label>
                <Input
                  type="number"
                  value={dpAmountRaw || ""}
                  onChange={(e) => setDpAmountRaw(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="0"
                  min={0}
                  className="h-10 rounded-xl border-[#D6DED2] bg-[#F7F8F3]/60 text-sm font-mono focus:border-[#8FAF9A] focus:ring-[#8FAF9A]/40"
                />
                {dpAmountRaw > 0 && (
                  <p className="text-[10px] text-[#4F6F52] font-mono">Rp {formatRupiahDisplay(dpAmountRaw)}</p>
                )}
              </div>
            </div>
          </div>

          {/* Tanggal & Nomor */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-[#D6DED2]/60">
              <CalendarDays className="h-4 w-4 text-[#8FAF9A]" />
              <span className="text-xs font-bold text-[#243028] uppercase tracking-wider">{t("booking_form.section_additional")}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#66736A]">{t("booking_form.date")} <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  required
                  className="h-10 rounded-xl border-[#D6DED2] bg-[#F7F8F3]/60 text-sm focus:border-[#8FAF9A]"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-[#66736A]">{t("booking_form.number")} <span className="text-[#8FAF9A] font-normal">(Opsional)</span></Label>
                <Input
                  value={bookingNumber}
                  onChange={(e) => setBookingNumber(e.target.value)}
                  placeholder={t("booking_form.number_placeholder")}
                  className="h-10 rounded-xl border-[#D6DED2] bg-[#F7F8F3]/60 text-sm font-mono focus:border-[#8FAF9A]"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2 border-t border-[#D6DED2]/50">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setOpen(false); reset(); }}
              className="rounded-xl border-[#D6DED2] text-[#66736A] hover:bg-[#F7F8F3]/50"
            >
              {t("action.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={loading || !!success}
              className="bg-[#4F6F52] hover:bg-[#3F5941] text-white rounded-xl font-bold px-5 shadow-[0_2px_8px_rgba(79,111,82,0.25)] hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t("booking_form.processing")}
                </span>
              ) : t("booking_form.save_add")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
