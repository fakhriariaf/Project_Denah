"use client";

import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AlertOctagon, AlertCircle } from "lucide-react";
import { cancelBooking } from "@/server/actions/marketing";
import { parseServerError } from "@/lib/error-parser";
import { useI18n } from "@/lib/i18n";
import { Translate } from "@/components/translate";
import { useOptimisticAction } from "@/hooks/use-optimistic-action";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Props {
  booking: any;
}

export default function CancelBookingDialog({ booking }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { execute, isLoading } = useOptimisticAction({
    action: async (bookingId: string, cancelReason: string) => {
      return await cancelBooking(bookingId, cancelReason);
    },
    onOptimistic: () => {
      // Optimistically close dialog immediately (feels instant)
      setOpen(false);
    },
    onRollback: () => {
      // Reopen dialog on error
      setOpen(true);
    },
    onSuccess: () => {
      setReason("");
      toast.success(`Booking ${booking.unitCode || ""} berhasil dibatalkan`);
      router.refresh();
    },
    onError: (errMsg) => {
      setError(errMsg);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError(t("booking_form.error_reason"));
      return;
    }
    setError(null);
    await execute(booking.id, reason);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger nativeButton={true} render={
        <Button variant="outline" size="sm" className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 flex items-center gap-1.5 h-8 text-xs rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">
          <AlertOctagon className="h-3.5 w-3.5" /> {t("booking_form.cancel_btn_title")}
        </Button>
      } />
      <DialogContent className="sm:max-w-md rounded-3xl bg-white/98 backdrop-blur-md border border-[#D6DED2] shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden font-sans">
        {/* Rose-themed header — cancel action */}
        <div className="bg-gradient-to-r from-rose-50/80 via-white/90 to-transparent p-5 border-b border-rose-100/60">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-100 flex items-center justify-center shadow-sm">
                <AlertOctagon className="h-5 w-5 text-rose-600 animate-pulse" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-[#243028] tracking-tight">{t("booking_form.cancel_title")}</DialogTitle>
                <DialogDescription className="text-xs text-rose-600 mt-0.5 font-semibold">
                  {t("booking_form.cancel_irrev")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3.5 bg-rose-50/80 text-rose-800 rounded-xl text-xs border border-rose-100/70 space-y-1">
            <span className="font-bold text-rose-900">{t("booking_form.cancel_important")}</span> <Translate namespace="booking_form" translationKey="cancel_desc" values={{ unitCode: booking.unitCode }} components={{ unit: <span className="font-mono font-bold bg-white px-1.5 py-0.5 rounded-lg border border-rose-100 shadow-sm text-slate-700" />, status: <span className="font-bold text-emerald-700" /> }} />
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />{error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="reason" className="text-xs font-semibold text-[#243028]">{t("booking_form.reason_label")}</Label>
            <Translate namespace="booking_form" translationKey="reason_placeholder" render={(ph) => (
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={ph}
                className="flex min-h-[100px] w-full bg-white border-[#D6DED2] rounded-xl text-xs focus:ring-[#8FAF9A] focus:ring-2 focus:border-transparent transition-all px-3 py-2"
              />
            )} />
          </div>

          <DialogFooter className="pt-4 gap-2 border-t border-rose-100/60">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              className="rounded-xl border-[#D6DED2] text-xs h-9 hover:bg-[#F7F8F3]/50"
            >
              {t("action.cancel")}
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading} 
              className="bg-rose-600 hover:bg-rose-700 text-white shadow-[0_4px_14px_rgba(220,38,38,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 h-9 rounded-xl font-bold text-xs px-4"
            >
              {isLoading ? t("booking_form.processing") : t("booking_form.cancel_confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
