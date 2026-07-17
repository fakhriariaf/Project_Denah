"use client";
import { useRouter } from "next/navigation";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createMarketingTarget, updateMarketingTarget } from "@/server/actions/waiting-list";
import { PlusCircle, Target, AlertCircle, Loader2, Pencil } from "lucide-react";
import { parseServerError } from "@/lib/error-parser";
import { useI18n } from "@/lib/i18n";
import { Translate } from "@/components/translate";
import { toast } from "sonner";

const schema = z.object({
  marketingId: z.string().min(1, "targets_form.val_marketing"),
  projectId: z.string().min(1, "targets_form.val_project"),
  periodMonth: z.coerce.number().int().min(1).max(12),
  periodYear: z.coerce.number().int().min(2020).max(2099),
  targetUnits: z.coerce.number().int().min(0).default(0),
  targetAmount: z.coerce.number().min(0).default(0),
});
type FormValues = z.infer<typeof schema>;

const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

interface Props {
  projects: { id: string; name: string }[];
  marketings: { id: string; name: string }[];
}

interface EditProps extends Props {
  target: {
    id: string;
    marketingId: string;
    projectId: string;
    periodMonth: number;
    periodYear: number;
    targetUnits: number;
    targetAmount: number;
  };
}

function TargetForm({
  projects, marketings, defaultValues, onSubmit, loading, errorMsg, isEdit
}: {
  projects: Props["projects"];
  marketings: Props["marketings"];
  defaultValues: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
  loading: boolean;
  errorMsg: string | null;
  isEdit?: boolean;
}) {
  const { t } = useI18n();

  const form = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const mktVal   = form.watch("marketingId") as string;
  const projVal  = form.watch("projectId") as string;
  const monthVal = String(form.watch("periodMonth") ?? 1);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-4 pt-3 overflow-y-auto max-h-[75vh]">
      {errorMsg && (
        <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />{errorMsg.startsWith("targets_form.") ? t(errorMsg as any) : errorMsg}
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-foreground">{t("targets_form.marketing")} <span className="text-rose-500">*</span></Label>
        <Select value={mktVal} onValueChange={(v: string | null) => form.setValue("marketingId", v ?? "")} disabled={isEdit}>
          <SelectTrigger className="border-border focus:ring-ring/50">
            <SelectValue placeholder={t("targets_form.marketing_ph")}>
              {mktVal ? marketings.find(m => m.id === mktVal)?.name : undefined}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-xl border-border bg-popover backdrop-blur-md">
            {marketings.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-foreground">{t("targets_form.project")} <span className="text-rose-500">*</span></Label>
        <Select value={projVal} onValueChange={(v: string | null) => form.setValue("projectId", v ?? "")} disabled={isEdit}>
          <SelectTrigger className="border-border focus:ring-ring/50">
            <SelectValue placeholder={t("targets_form.project_ph")}>
              {projVal ? projects.find(p => p.id === projVal)?.name : undefined}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="rounded-xl border-border bg-popover backdrop-blur-md">
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-foreground">{t("targets_form.month")}</Label>
          <Select value={monthVal} onValueChange={(v: string | null) => form.setValue("periodMonth", parseInt(v ?? "1"))} disabled={isEdit}>
            <SelectTrigger className="border-border focus:ring-ring/50">
              <SelectValue>{monthVal ? MONTHS[parseInt(monthVal) - 1] : undefined}</SelectValue>
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border bg-popover backdrop-blur-md">
              {MONTHS.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-foreground">{t("targets_form.year")}</Label>
          <Input type="number" {...form.register("periodYear")} className="border-border font-mono" disabled={isEdit} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-foreground">{t("targets_form.target_unit")} <span className="text-destructive">*</span></Label>
          <Input type="number" required min={0} {...form.register("targetUnits")} className="border-border font-mono" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-foreground">{t("targets_form.target_amount")} <span className="text-destructive">*</span></Label>
          <Input type="number" required step="1000000" min={0} {...form.register("targetAmount")} placeholder="0" className="border-border font-mono placeholder:text-muted-foreground/70" />
        </div>
      </div>

      <DialogFooter className="pt-2 gap-2">
        <Button type="submit" disabled={loading} className="btn-premium bg-primary hover:bg-primary/90 text-white gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}{isEdit ? "Simpan Perubahan" : t("targets_form.btn_submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AddMarketingTargetDialog({ projects, marketings }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const currentYear = new Date().getFullYear();

  const defaultValues = {
    marketingId: "", projectId: "",
    periodMonth: new Date().getMonth() + 1,
    periodYear: currentYear,
    targetUnits: 0, targetAmount: 0,
  };

  async function onSubmit(values: FormValues) {
    setLoading(true);
    setErrorMsg(null);
    try {
      await createMarketingTarget(values);
      toast.success("Target marketing berhasil disimpan!");
      setOpen(false);
      router.refresh();
    } catch (err: unknown) {
      setErrorMsg(parseServerError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="btn-premium bg-[#4F6F52] hover:bg-[#3D563F] text-white gap-2 shrink-0">
        <PlusCircle className="h-4 w-4" /> {t("targets_form.btn_add")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl bg-white/98 backdrop-blur-md border border-border shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden font-sans">
          <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-border">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center shadow-inner">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-black text-foreground tracking-tight">{t("targets_form.title")}</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-1 leading-relaxed">{t("targets_form.desc")}</DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>
          <TargetForm projects={projects} marketings={marketings} defaultValues={defaultValues} onSubmit={onSubmit} loading={loading} errorMsg={errorMsg} />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function EditMarketingTargetDialog({ projects, marketings, target }: EditProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const defaultValues: FormValues = {
    marketingId: target.marketingId,
    projectId: target.projectId,
    periodMonth: target.periodMonth,
    periodYear: target.periodYear,
    targetUnits: target.targetUnits,
    targetAmount: target.targetAmount,
  };

  async function onSubmit(values: FormValues) {
    setLoading(true);
    setErrorMsg(null);
    try {
      await updateMarketingTarget(target.id, values);
      toast.success("Target berhasil diperbarui!");
      setOpen(false);
      router.refresh();
    } catch (err: unknown) {
      setErrorMsg(parseServerError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-7 w-7 p-0 rounded-lg border border-border text-primary hover:bg-secondary/30"
        title="Edit Target"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl bg-white/98 backdrop-blur-md border border-border shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden font-sans">
          <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-border">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center shadow-inner">
                  <Pencil className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-black text-foreground tracking-tight">Edit Target Marketing</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Ubah jumlah target unit dan nominal. Marketing, proyek, dan periode tidak bisa diubah.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>
          <TargetForm projects={projects} marketings={marketings} defaultValues={defaultValues} onSubmit={onSubmit} loading={loading} errorMsg={errorMsg} isEdit />
        </DialogContent>
      </Dialog>
    </>
  );
}
