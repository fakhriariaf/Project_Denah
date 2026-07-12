"use client";
import { useRouter } from "next/navigation";

import { useState } from "react";
import { updateBooking } from "@/server/actions/marketing";
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
import { Edit3, AlertCircle, CheckCircle, Building2, User, DollarSign, CalendarDays } from "lucide-react";
import { parseServerError } from "@/lib/error-parser";
import { handleActionResult, type ActionResult } from "@/lib/action-utils";
import { useI18n } from "@/lib/i18n";

interface Props {
  booking: {
    id: string;
    bookingNumber: string;
    bookingDate: Date | string | number;
    bookingFee: number;
    dpAmount: number;
    paymentScheme: "cash" | "kpr" | "installment";
    termin?: number | null;
    status: string;
    marketingId: string;
    projectName?: string | null;
    unitCode?: string | null;
    customerName?: string | null;
    projectId?: string | null;
    unitId?: string | null;
    customerId?: string | null;
  };
  marketings: { id: string; name: string; roleName?: string | null }[];
  currentUser: { id: string; name: string };
  triggerButton?: React.ReactElement;
  onSuccess?: () => void;
}

export default function EditBookingDialog({
  booking,
  marketings,
  currentUser,
  triggerButton,
  onSuccess,
}: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Format date correctly to YYYY-MM-DD
  const formatInitialDate = (dateVal: any) => {
    if (!dateVal) return new Date().toISOString().split("T")[0];
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return new Date().toISOString().split("T")[0];
    return d.toISOString().split("T")[0];
  };

  // Form state — rupiah fields stored as raw integer, displayed with formatting
  const [marketingId, setMarketingId] = useState(booking.marketingId);
  const [bookingDate, setBookingDate] = useState(formatInitialDate(booking.bookingDate));
  const [bookingFeeRaw, setBookingFeeRaw] = useState(booking.bookingFee);
  const [dpAmountRaw, setDpAmountRaw] = useState(booking.dpAmount);
  const [paymentScheme, setPaymentScheme] = useState<"cash" | "kpr" | "installment">(booking.paymentScheme);
  const [installmentTerm, setInstallmentTerm] = useState<number>(booking.termin || 3);

  const reset = () => {
    setMarketingId(booking.marketingId);
    setBookingDate(formatInitialDate(booking.bookingDate));
    setBookingFeeRaw(booking.bookingFee);
    setDpAmountRaw(booking.dpAmount);
    setPaymentScheme(booking.paymentScheme);
    setInstallmentTerm(booking.termin || 3);
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!marketingId) { setError(t("booking_form.error_marketing")); return; }

    setLoading(true);
    try {
      const res = await updateBooking(booking.id, {
        projectId: booking.projectId || "",
        unitId: booking.unitId || "",
        customerId: booking.customerId || "",
        marketingId,
        bookingDate: new Date(bookingDate),
        bookingFee: bookingFeeRaw,
        dpAmount: dpAmountRaw,
        paymentScheme,
        bookingNumber: booking.bookingNumber,
        status: booking.status as any,
        termin: paymentScheme === "installment" ? installmentTerm : undefined,
      });

      const result: ActionResult<typeof res> = { success: true, data: res };
      if (handleActionResult(result, { successMessage: `Booking ${booking.bookingNumber} berhasil diperbarui` })) {
        setTimeout(() => {
          setOpen(false);
          setSuccess(null);
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
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); else reset(); }}>
      <DialogTrigger nativeButton render={
        triggerButton || (
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 w-8 rounded-lg border border-border bg-card text-muted-foreground hover:text-primary hover:bg-secondary/30 flex items-center justify-center transition-all shadow-sm"
            title={t("booking_form.edit_btn_title")}
          >
            <Edit3 className="h-3.5 w-3.5" />
          </Button>
        )
      } />

      <DialogContent className="sm:max-w-2xl bg-white/98 rounded-3xl backdrop-blur-md border border-border shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-foreground tracking-tight flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-primary text-white flex items-center justify-center">
                <Edit3 className="h-4 w-4" />
              </div>
              {t("booking_form.edit_title")} <span className="font-mono text-lg font-black text-primary">{booking.bookingNumber}</span>
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {t("booking_form.edit_desc")}
            </p>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[65vh]">
          {/* Alerts */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-semibold">
              <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {success}
            </div>
          )}

          {/* Project & Unit (LOCKED) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-border/60">
              <Building2 className="h-4 w-4 text-primary/70" />
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">{t("booking_form.section_property_locked")}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">{t("booking_form.project")}</Label>
                <Input
                  value={booking.projectName || "—"}
                  disabled
                  readOnly
                  className="w-full h-10 rounded-xl border border-border bg-muted/30/60 px-3 text-sm font-semibold text-foreground disabled:opacity-75 disabled:cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">{t("booking_form.unit_locked")}</Label>
                <Input
                  value={booking.unitCode || "—"}
                  disabled
                  readOnly
                  className="w-full h-10 rounded-xl border border-border bg-muted/30/60 px-3 text-sm font-semibold text-foreground font-mono disabled:opacity-75 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Konsumen & Marketing */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-border/60">
              <User className="h-4 w-4 text-primary/70" />
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">{t("booking_form.section_parties")}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">{t("booking_form.customer_locked")}</Label>
                <Input
                  value={booking.customerName || "—"}
                  disabled
                  readOnly
                  className="w-full h-10 rounded-xl border border-border bg-muted/30/60 px-3 text-sm font-semibold text-foreground disabled:opacity-75 disabled:cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">{t("booking_form.marketing")} <span className="text-destructive">*</span></Label>
                <select
                  value={marketingId}
                  onChange={(e) => setMarketingId(e.target.value)}
                  required
                  className="w-full h-10 rounded-xl border border-border bg-muted/30/60 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary/50"
                >
                  {marketings.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id === currentUser.id ? `${m.name} (${t("booking_form.marketing_self")})` : m.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Pembayaran */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-border/60">
              <DollarSign className="h-4 w-4 text-primary/70" />
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">{t("booking_form.section_payment")}</span>
            </div>

            <div className={`grid ${paymentScheme === "installment" ? "grid-cols-2 md:grid-cols-4" : "grid-cols-3"} gap-3`}>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">{t("booking_form.scheme")} <span className="text-destructive">*</span></Label>
                <select
                  value={paymentScheme}
                  onChange={(e) => setPaymentScheme(e.target.value as any)}
                  className="w-full h-10 rounded-xl border border-border bg-muted/30/60 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                >
                  <option value="kpr">{t("booking.scheme_kpr")}</option>
                  <option value="cash">{t("booking.scheme_cash")}</option>
                  <option value="installment">{t("booking.scheme_installment")}</option>
                </select>
              </div>

              {paymentScheme === "installment" && (
                <div className="space-y-1 animate-fade-in text-left">
                  <Label className="text-xs font-semibold text-muted-foreground">{t("booking_form.termin")} <span className="text-destructive">*</span></Label>
                  <select
                    value={installmentTerm}
                    onChange={(e) => setInstallmentTerm(Number(e.target.value))}
                    className="w-full h-10 rounded-xl border border-border bg-muted/30/60 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary/50"
                  >
                    <option value={3}>{t("booking_form.termin_3")}</option>
                    <option value={6}>{t("booking_form.termin_6")}</option>
                    <option value={12}>{t("booking_form.termin_12")}</option>
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">{t("booking_form.bf")}</Label>
                <Input
                  type="number"
                  value={bookingFeeRaw || ""}
                  onChange={(e) => setBookingFeeRaw(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="5000000"
                  min={0}
                  className="h-10 rounded-xl border-border bg-muted/30/60 text-sm font-mono focus:border-primary/50 focus:ring-ring/40"
                />
                {bookingFeeRaw > 0 && (
                  <p className="text-[10px] text-primary font-mono">Rp {formatRupiahDisplay(bookingFeeRaw)}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">{t("booking_form.dp")}</Label>
                <Input
                  type="number"
                  value={dpAmountRaw || ""}
                  onChange={(e) => setDpAmountRaw(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="0"
                  min={0}
                  className="h-10 rounded-xl border-border bg-muted/30/60 text-sm font-mono focus:border-primary/50 focus:ring-ring/40"
                />
                {dpAmountRaw > 0 && (
                  <p className="text-[10px] text-primary font-mono">Rp {formatRupiahDisplay(dpAmountRaw)}</p>
                )}
              </div>
            </div>
          </div>

          {/* Tanggal Booking */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1 border-b border-border/60">
              <CalendarDays className="h-4 w-4 text-primary/70" />
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">{t("booking_form.section_additional")}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">{t("booking_form.date")} <span className="text-destructive">*</span></Label>
                <Input
                  type="date"
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  required
                  className="h-10 rounded-xl border-border bg-muted/30/60 text-sm focus:border-primary/50"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground">{t("booking_form.number_locked")}</Label>
                <Input
                  value={booking.bookingNumber}
                  disabled
                  readOnly
                  className="h-10 rounded-xl border-border bg-muted/30/60 text-sm font-mono disabled:opacity-75 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setOpen(false); reset(); }}
              className="rounded-xl border-border text-muted-foreground hover:bg-muted/30/50"
            >
              {t("action.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={loading || !!success}
              className="bg-primary hover:bg-[#3F5941] text-white rounded-xl font-bold px-5 shadow-[0_2px_8px_rgba(79,111,82,0.25)] hover:scale-[1.01] active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t("booking_form.processing")}
                </span>
              ) : t("booking_form.save_edit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
