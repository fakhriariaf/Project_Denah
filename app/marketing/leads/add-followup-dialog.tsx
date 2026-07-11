"use client";
import { useRouter } from "next/navigation";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { followupSchema } from "@/server/validators/marketing";
import { createFollowup, updateLead } from "@/server/actions/marketing";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription,
  DialogFooter,
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PhoneCall, ChevronRight, AlertCircle, Loader2 } from "lucide-react";
import { z } from "zod";
import { parseServerError } from "@/lib/error-parser";
import { useI18n } from "@/lib/i18n";
import { Translate } from "@/components/translate";
import { toast } from "sonner";

type FormValues = z.infer<typeof followupSchema>;

interface Props {
  lead: any;
}

export default function AddFollowupDialog({ lead }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState<string>(lead.status || "follow_up");

  const { register, handleSubmit, formState: { errors }, reset } = useForm<any>({
    resolver: zodResolver(followupSchema),
    defaultValues: {
      leadId: lead.id,
      customerId: lead.customerId || null,
      followupDate: new Date().toISOString().split('T')[0],
      method: "whatsapp",
      result: "",
      nextFollowupAt: ""
    }
  });

  const onSubmit = async (data: any) => {
    setLoading(true);
    setError(null);
    try {
      let nextFollowupAtVal = null;
      if (data.nextFollowupAt) {
        const d = new Date(data.nextFollowupAt);
        if (!isNaN(d.getTime())) {
          nextFollowupAtVal = d;
        }
      }

      // 1. Save follow-up note
      const res = await createFollowup({
        ...data,
        followupDate: new Date(data.followupDate),
        nextFollowupAt: nextFollowupAtVal,
      });

      // 2. If user chose a different status, update lead status
      if (res.success && newStatus && newStatus !== lead.status) {
        await updateLead(lead.id, {
          name: lead.name,
          phone: lead.phone,
          source: lead.source,
          status: newStatus,
          interestedProjectId: lead.interestedProjectId || null,
          interestedUnitId: lead.interestedUnitId || null,
          assignedMarketingId: lead.assignedMarketingId || null,
          notes: lead.notes || null,
        });
      }

      if (res.success) {
        toast.success("Catatan follow-up berhasil disimpan!");
        setOpen(false);
        reset();
        router.refresh();
      }
    } catch (err: any) {
      setError(parseServerError(err));
    } finally {
      setLoading(false);
    }
  };

  const statusOptions = [
    { value: "new", label: t("lead.status_new") },
    { value: "contacted", label: t("lead.status_contacted") },
    { value: "follow_up", label: t("lead.status_follow_up") },
    { value: "converted", label: t("lead.status_converted") },
    { value: "lost", label: t("lead.status_lost") },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger nativeButton={true} render={
        <Button
          variant="outline"
          size="sm"
          className="border-border text-muted-foreground hover:bg-secondary/40 hover:border-primary/50 hover:text-primary flex items-center gap-1 font-semibold"
        >
          <PhoneCall className="h-3.5 w-3.5" /> {t("followup.btn_add")}
        </Button>
      } />
      <DialogContent className="sm:max-w-lg rounded-3xl bg-white/98 backdrop-blur-md border border-border shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden font-sans">
        <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-border">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/80 border border-border flex items-center justify-center shadow-sm">
                <PhoneCall className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-foreground tracking-tight">
                  {t("followup.title")}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <span className="font-semibold text-primary">{lead.name}</span>
                  <ChevronRight className="h-3 w-3 text-primary/70" />
                  <span>{lead.phone}</span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 pt-2 overflow-y-auto max-h-[75vh]">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />{error.startsWith("val.") ? t(error as any) : error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="method" className="text-xs font-semibold text-foreground font-sans">
                {t("followup.method")} <span className="text-destructive">*</span>
              </Label>
              <select
                id="method"
                {...register("method")}
                className="flex h-10 w-full rounded-lg border border-border bg-muted/30/60 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <option value="whatsapp">{t("followup.method_wa")}</option>
                <option value="call">{t("followup.method_call")}</option>
                <option value="meeting">{t("followup.method_meeting")}</option>
                <option value="site_visit">{t("followup.method_site")}</option>
                <option value="email">{t("followup.method_email")}</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="followupDate" className="text-xs font-semibold text-foreground font-sans">
                {t("followup.date")} <span className="text-destructive">*</span>
              </Label>
              <input
                type="date"
                id="followupDate"
                {...register("followupDate", { valueAsDate: true })}
                className="flex h-10 w-full rounded-lg border border-border bg-muted/30/60 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              {errors.followupDate && (
                <p className="text-xs text-rose-500 font-semibold">{((errors.followupDate as any).message as string).startsWith("val.") ? t((errors.followupDate as any).message as any) : (errors.followupDate as any).message}</p>
              )}
            </div>
          </div>

          {/* Update lead status after follow-up */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-foreground font-sans">
              {t("followup.update_status")}
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setNewStatus(opt.value)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all duration-200 ${
                    newStatus === opt.value
                      ? "bg-primary text-white border-[#4F6F52] shadow-[0_2px_6px_rgba(79,111,82,0.3)]"
                      : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-primary"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-primary/70">
              {t("followup.status_current")} <span className="font-semibold text-muted-foreground">{statusOptions.find(o => o.value === lead.status)?.label || lead.status}</span>
              {newStatus !== lead.status && (
                <span className="ml-1 text-primary">{t("followup.status_change")} <strong>{statusOptions.find(o => o.value === newStatus)?.label}</strong></span>
              )}
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="result" className="text-xs font-semibold text-foreground font-sans">
              {t("followup.result")} <span className="text-destructive">*</span>
            </Label>
            <textarea
              id="result"
              {...register("result")}
              placeholder={t("followup.result_ph")}
              className="flex min-h-[80px] w-full rounded-lg border border-border bg-muted/30/60 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            {errors.result && (
              <p className="text-xs text-rose-500 font-semibold">{((errors.result as any).message as string).startsWith("val.") ? t((errors.result as any).message as any) : (errors.result as any).message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="nextFollowupAt" className="text-xs font-semibold text-foreground font-sans">
              {t("followup.next_date")} <span className="text-primary/70 font-normal">(Opsional)</span>
            </Label>
            <input
              type="date"
              id="nextFollowupAt"
              {...register("nextFollowupAt", { valueAsDate: true })}
              className="flex h-10 w-full rounded-lg border border-border bg-muted/30/60 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

          <DialogFooter className="pt-4 gap-2 border-t border-border mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="rounded-xl border-border text-xs h-9 hover:bg-muted/30/50"
            >
              {t("action.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-primary hover:bg-primary/90 text-white active:scale-95 btn-premium h-9 rounded-xl font-bold text-xs px-4 gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? t("followup.saving") : t("followup.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
