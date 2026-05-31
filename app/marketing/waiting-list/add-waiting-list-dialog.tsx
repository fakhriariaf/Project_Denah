"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createWaitingList } from "@/server/actions/waiting-list";
import { PlusCircle, Clock, AlertCircle, Loader2 } from "lucide-react";
import { parseServerError } from "@/lib/error-parser";
import { useI18n } from "@/lib/i18n";

interface Props {
  projects: { id: string; name: string }[];
  customers: { id: string; name: string; phone: string | null }[];
}

export function AddToWaitingListDialog({ projects, customers }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const schema = z.object({
    customerId: z.string().min(1, t("val.booking_customer")),
    projectId: z.string().min(1, t("val.booking_project")),
    preferredType: z.string().optional(),
    budgetMin: z.coerce.number().min(0).optional(),
    budgetMax: z.coerce.number().min(0).optional(),
    priority: z.coerce.number().int().min(1).max(999).default(1),
  });
  type FormValues = z.infer<typeof schema>;

  const form = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: { customerId: "", projectId: "", preferredType: "", budgetMin: undefined, budgetMax: undefined, priority: 1 },
  });

  const customerVal = form.watch("customerId") as string;
  const projectVal  = form.watch("projectId") as string;

  async function onSubmit(values: FormValues) {
    setLoading(true);
    setErrorMsg(null);
    try {
      await createWaitingList(values);
      alert("Antrean pembeli (waiting list) berhasil disimpan!");
      setOpen(false);
      form.reset();
      window.location.reload();
    } catch (err: unknown) {
      setErrorMsg(parseServerError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="btn-premium bg-[#4F6F52] hover:bg-[#3D563F] text-white gap-2 shrink-0">
        <PlusCircle className="h-4 w-4" />
        {t("waiting_dialog.add_btn")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl bg-white/98 backdrop-blur-md border border-[#D6DED2] shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden font-sans">
          <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-[#D6DED2]">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[#DDE8D8] flex items-center justify-center shadow-inner">
                  <Clock className="h-5 w-5 text-[#4F6F52]" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-black text-[#243028] tracking-tight">{t("waiting_dialog.add_title")}</DialogTitle>
                  <DialogDescription className="text-xs text-[#66736A] mt-1 leading-relaxed">{t("waiting_dialog.add_desc")}</DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-4 pt-3 overflow-y-auto max-h-[75vh]">
            {errorMsg && (
              <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />{errorMsg}
              </div>
            )}

            {/* Konsumen */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-[#243028]">{t("waiting_dialog.customer")} <span className="text-red-500">*</span></Label>
              <Select required value={customerVal} onValueChange={(v: string | null) => form.setValue("customerId", v ?? "")}>
                <SelectTrigger className="border-[#D6DED2] focus:ring-[#8FAF9A]/50">
                  <SelectValue placeholder={t("waiting_dialog.customer_ph")}>
                    {customerVal ? (() => {
                      const c = customers.find(cust => cust.id === customerVal);
                      return c ? `${c.name}${c.phone ? ` — ${c.phone}` : ""}` : undefined;
                    })() : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-xl border-[#D6DED2] bg-white/95 backdrop-blur-md max-h-52">
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
              {form.formState.errors.customerId && <p className="text-xs text-rose-500">{String(form.formState.errors.customerId?.message)}</p>}
            </div>

            {/* Proyek */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-[#243028]">{t("waiting_dialog.project")} <span className="text-red-500">*</span></Label>
              <Select required value={projectVal} onValueChange={(v: string | null) => form.setValue("projectId", v ?? "")}>
                <SelectTrigger className="border-[#D6DED2] focus:ring-[#8FAF9A]/50">
                  <SelectValue placeholder={t("waiting_dialog.project_ph")}>
                    {projectVal ? projects.find(p => p.id === projectVal)?.name : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="rounded-xl border-[#D6DED2] bg-white/95 backdrop-blur-md">
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {form.formState.errors.projectId && <p className="text-xs text-rose-500">{String(form.formState.errors.projectId?.message)}</p>}
            </div>

            {/* Tipe & Prioritas */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-[#243028]">{t("waiting_dialog.pref_type")} <span className="text-[#8FAF9A] font-normal">{t("waiting_dialog.optional")}</span></Label>
                <Input {...form.register("preferredType")} placeholder="Misal: Type 36, Type 45" className="border-[#D6DED2] placeholder:text-[#A8B0AA]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-[#243028]">{t("waiting_dialog.priority")} <span className="text-[#8FAF9A] font-normal">{t("waiting_dialog.optional")}</span></Label>
                <Input type="number" {...form.register("priority")} min={1} max={999} className="border-[#D6DED2] font-mono" />
              </div>
            </div>

            {/* Budget */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-[#243028]">{t("waiting_dialog.budget_min")} <span className="text-[#8FAF9A] font-normal">{t("waiting_dialog.optional")}</span></Label>
                <Input type="number" step="1000000" {...form.register("budgetMin")} placeholder="0" className="border-[#D6DED2] font-mono placeholder:text-[#A8B0AA]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-[#243028]">{t("waiting_dialog.budget_max")} <span className="text-[#8FAF9A] font-normal">{t("waiting_dialog.optional")}</span></Label>
                <Input type="number" step="1000000" {...form.register("budgetMax")} placeholder="0" className="border-[#D6DED2] font-mono placeholder:text-[#A8B0AA]" />
              </div>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-[#D6DED2]">{t("waiting_dialog.cancel")}</Button>
              <Button type="submit" disabled={loading} className="btn-premium bg-[#4F6F52] hover:bg-[#3D563F] text-white gap-2">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("waiting_dialog.submit")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
