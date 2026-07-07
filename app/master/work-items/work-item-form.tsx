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
import { Textarea } from "@/components/ui/textarea";
import { createWorkItem, updateWorkItem } from "@/server/actions/production";
import { PlusCircle, Edit2, Wrench, AlertCircle, Loader2 } from "lucide-react";
import { parseServerError } from "@/lib/error-parser";
import { useI18n } from "@/lib/i18n";

const schema = z.object({
  code: z.string().min(2, "Kode wajib diisi").regex(/^[A-Z0-9-]+$/, "Hanya huruf kapital, angka, dan tanda -"),
  name: z.string().min(2, "Nama wajib diisi"),
  description: z.string().optional(),
  defaultWeightPct: z.coerce.number().int().min(1).max(100, "Maks 100%"),
  status: z.enum(["active", "inactive"]).default("active"),
});
type FormValues = z.infer<typeof schema>;

interface WorkItemRow { id: string; code: string; defaultWeightPct: number; status: string }

interface Props {
  id?: string;
  initialData?: Partial<FormValues>;
  items: WorkItemRow[];
}

export function WorkItemForm({ id, initialData, items }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Calculate remaining weight for new items
  const usedWeight = items
    .filter(i => i.status === "active" && i.id !== id)
    .reduce((s, i) => s + i.defaultWeightPct, 0);
  const remaining = 100 - usedWeight;

  const form = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: initialData?.code ?? "",
      name: initialData?.name ?? "",
      description: initialData?.description ?? "",
      defaultWeightPct: initialData?.defaultWeightPct ?? Math.min(remaining, 20),
      status: initialData?.status ?? "active",
    },
  });

  const statusVal = form.watch("status") as string;

  async function onSubmit(values: FormValues) {
    setLoading(true);
    setErrorMsg(null);
    try {
      if (id) {
        await updateWorkItem(id, values);
        alert("Pekerjaan konstruksi (SPK work item) berhasil diperbarui!");
      } else {
        await createWorkItem(values);
        alert("Pekerjaan konstruksi (SPK work item) berhasil disimpan!");
      }
      setOpen(false);
      form.reset();
      router.refresh();
    } catch (err: unknown) {
      setErrorMsg(parseServerError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {id ? (
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)} className="h-8 w-8 p-0 text-muted-foreground hover:text-[#4F6F52]" title={t("work_item_form.edit_btn")}>
          <Edit2 className="h-4 w-4" />
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)} className="btn-premium bg-[#4F6F52] hover:bg-[#3D563F] text-white gap-2">
          <PlusCircle className="h-4 w-4" />{t("work_item_form.add_btn")}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl bg-white/98 backdrop-blur-md border border-[#D6DED2] shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden font-sans">
          <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-[#D6DED2]">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/80 border border-[#D6DED2] flex items-center justify-center shadow-sm">
                  <Wrench className="h-5 w-5 text-[#4F6F52]" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-black text-[#243028] tracking-tight">{id ? t("work_item_form.edit_title") : t("work_item_form.add_title")}</DialogTitle>
                  <DialogDescription className="text-xs text-[#66736A] mt-1">
                    {id ? t("work_item_form.edit_desc") : t("work_item_form.add_desc", { remaining: remaining.toString() })}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
            {errorMsg && (
              <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />{errorMsg}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#243028]">{t("work_item_form.code")} <span className="text-red-500">*</span></Label>
                <Input
                  required
                  {...form.register("code")}
                  placeholder={t("work_item_form.code_placeholder")}
                  className="bg-white border-[#D6DED2] rounded-xl text-xs h-9 focus:ring-[#8FAF9A] font-mono uppercase placeholder:text-[#A8B0AA]"
                  onChange={e => form.setValue("code", e.target.value.toUpperCase())}
                />
                {form.formState.errors.code && <p className="text-xs text-rose-500">{t("work_item_form.error_code")}</p>}
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold text-[#243028]">{t("work_item_form.name")} <span className="text-red-500">*</span></Label>
                <Input required {...form.register("name")} placeholder={t("work_item_form.name_placeholder")} className="bg-white border-[#D6DED2] rounded-xl text-xs h-9 focus:ring-[#8FAF9A] placeholder:text-[#A8B0AA]" />
                {form.formState.errors.name && <p className="text-xs text-rose-500">{t("work_item_form.error_name")}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#243028]">{t("work_item_form.desc")} <span className="text-[#8FAF9A] font-normal">({t("form.optional")})</span></Label>
              <Textarea {...form.register("description")} placeholder={t("work_item_form.desc_placeholder")} className="bg-white border-[#D6DED2] rounded-xl text-xs focus:ring-[#8FAF9A] placeholder:text-[#A8B0AA] min-h-[70px] resize-none" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#243028]">{t("work_item_form.weight")} <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Input required type="number" min={1} max={100} {...form.register("defaultWeightPct")} className="bg-white border-[#D6DED2] rounded-xl text-xs h-9 focus:ring-[#8FAF9A] font-mono pr-8" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8FAF9A] font-bold">%</span>
                </div>
                {form.formState.errors.defaultWeightPct && <p className="text-xs text-rose-500">{t("work_item_form.error_weight")}</p>}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#243028]">{t("work_item_form.status")} <span className="text-red-500">*</span></Label>
                <Select required value={statusVal} onValueChange={(v: string | null) => form.setValue("status", v ?? "active")}>
                  <SelectTrigger className="w-full text-xs rounded-xl border border-[#D6DED2] bg-white hover:bg-[#F7F8F3]/50 focus:ring-2 focus:ring-[#8FAF9A]/20 h-9 px-3 transition-premium">
                    <SelectValue>
                      {statusVal ? t(`work_item.status_${statusVal}` as any) : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="border-[#D6DED2] rounded-xl bg-white/95 backdrop-blur-md">
                    <SelectItem value="active" className="text-xs">{t("work_item.status_active")}</SelectItem>
                    <SelectItem value="inactive" className="text-xs">{t("work_item.status_inactive")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-4 gap-2 border-t border-[#D6DED2] mt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-xl border-[#D6DED2] text-xs h-9 hover:bg-[#F7F8F3]/50">{t("action.cancel")}</Button>
              <Button type="submit" disabled={loading} className="bg-[#4F6F52] hover:bg-[#3D563F] text-white active:scale-95 shadow-[0_4px_14px_rgba(79,111,82,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 h-9 rounded-xl font-bold text-xs px-4 gap-2">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {id ? t("work_item_form.save_edit") : t("work_item_form.save_add")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
