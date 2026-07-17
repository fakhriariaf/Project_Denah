"use client";
import { useRouter } from "next/navigation";

import { useTransition, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { unitSchema, type UnitInput } from "@/server/validators/master";
import { createUnit, updateUnit } from "@/server/actions/master";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Home, AlertCircle, Loader2 } from "lucide-react";
import { parseServerError } from "@/lib/error-parser";
import { handleActionResult, type ActionResult } from "@/lib/action-utils";
import { useI18n } from "@/lib/i18n";

// No longer need STATUS_LABELS since we will use t("timeline.[status]")

export function UnitForm({ 
  initialData, 
  id,
  projects,
  vendors,
  triggerButton,
  onSuccess

}: { 
  initialData?: UnitInput; 
  id?: string;
  projects: { id: string; name: string }[];
  vendors: { id: string; name: string }[];
  triggerButton?: React.ReactElement;
  onSuccess?: (createdUnitId: string) => Promise<void> | void;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isWorkflowStatus = !!id && !["available", "belum_siap", "cancelled"].includes(initialData?.status || "");

  const form = useForm<UnitInput>({
    resolver: zodResolver(unitSchema) as unknown as import("react-hook-form").Resolver<UnitInput>,
    defaultValues: initialData ? {
      ...initialData,
      readyStockSource: initialData.readyStockSource || "construction_flow",
    } : {
      projectId: "",
      code: "",
      cluster: "",
      typeName: "",
      landArea: 0,
      buildingArea: 0,
      price: 0,
      status: "available",
      notes: "",
      isReadyStock: false,
      readyStockSource: "construction_flow",
      readyStockVendorId: "",
    },
  });
  
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = form;

  const onSubmit = (data: UnitInput) => {
    startTransition(async () => {
      setError(null);
      try {
        let res;
        if (id) {
          res = await updateUnit(id, data);
          handleActionResult({ success: true, data: res } as ActionResult<typeof res>, { successMessage: `Unit ${data.code} berhasil diperbarui` });
        } else {
          res = await createUnit(data);
          handleActionResult({ success: true, data: res } as ActionResult<typeof res>, { successMessage: `Unit ${data.code} berhasil dibuat` });
        }
        if (onSuccess && (res as any)?.id) {
          await onSuccess((res as any).id);
        }
        setOpen(false);
        if (!id) reset();
        router.refresh();
      } catch (err) {
        const errorMsg = parseServerError(err);
        handleActionResult({ success: false, error: errorMsg });
        setError(errorMsg);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger nativeButton={true} render={
        triggerButton ? (
          triggerButton
        ) : id ? (
          <Button variant="outline" size="sm" className="h-7 text-xs border-input rounded-lg hover:bg-muted/50">{t("unit_form.edit_btn")}</Button>
        ) : (
          <Button className="btn-premium bg-[#4F6F52] hover:bg-[#3D563F] text-white active:scale-95 shadow-[0_4px_14px_rgba(79,111,82,0.25)] transition-all duration-300 h-9 rounded-xl font-bold text-xs px-4">
            <Plus className="mr-2 h-4 w-4" />
            {t("unit_form.add_btn")}
          </Button>
        )
      } />
      <DialogContent className="sm:max-w-lg rounded-3xl bg-white/98 backdrop-blur-md border border-input shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden font-sans">
        <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-input">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/80 border border-input flex items-center justify-center shadow-sm">
                <Home className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-foreground tracking-tight">{id ? t("unit_form.edit_title") : t("unit_form.add_title")}</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  {id ? t("unit_form.edit_desc") : t("unit_form.add_desc")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />{error}
            </div>
          )}
          
          <div className="space-y-1.5">
            <Label htmlFor="projectId" className="text-xs font-semibold text-foreground">{t("unit_form.project")} <span className="text-destructive">*</span></Label>
            <Select 
              value={watch("projectId") ?? ""} 
              onValueChange={(val) => setValue("projectId", val ?? "")}
              required
            >
              <SelectTrigger className="w-full text-xs rounded-xl border border-input bg-card hover:bg-muted/50 focus:ring-2 focus:ring-ring/20 h-9 px-3 transition-premium">
                <SelectValue placeholder={t("unit_form.project_placeholder")}>
                  {watch("projectId") ? projects.find(p => p.id === watch("projectId"))?.name : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="border-input rounded-xl bg-popover backdrop-blur-md">
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.projectId && <p className="text-xs text-destructive">{errors.projectId.message as string}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="code" className="text-xs font-semibold text-foreground">{t("unit_form.code")} <span className="text-destructive">*</span></Label>
            <Input id="code" required {...register("code")} placeholder="A1-001" className="font-mono bg-card border-input rounded-xl text-xs h-9 focus-visible:ring-2 focus-visible:ring-ring tabular-nums" />
            {errors.code && <p className="text-xs text-destructive">{errors.code.message as string}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cluster" className="text-xs font-semibold text-foreground">{t("unit_form.cluster")} <span className="font-normal text-muted-foreground">(Opsional)</span></Label>
              <Input id="cluster" {...register("cluster")} placeholder="Cluster A" className="bg-card border-input rounded-xl text-xs h-9 focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="typeName" className="text-xs font-semibold text-foreground">{t("unit_form.type")} <span className="font-normal text-muted-foreground">(Opsional)</span></Label>
              <Input id="typeName" {...register("typeName")} placeholder="Tipe 36" className="bg-card border-input rounded-xl text-xs h-9 focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="landArea" className="text-xs font-semibold text-foreground">{t("unit_form.land_area")} <span className="text-destructive">*</span></Label>
              <Input id="landArea" required type="number" step="0.01" {...register("landArea", { valueAsNumber: true })} className="font-mono bg-card border-input rounded-xl text-xs h-9 focus-visible:ring-2 focus-visible:ring-ring tabular-nums" />
              {errors.landArea && <p className="text-xs text-destructive">{errors.landArea.message as string}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="buildingArea" className="text-xs font-semibold text-foreground">{t("unit_form.build_area")} <span className="text-destructive">*</span></Label>
              <Input id="buildingArea" required type="number" step="0.01" {...register("buildingArea", { valueAsNumber: true })} className="font-mono bg-card border-input rounded-xl text-xs h-9 focus-visible:ring-2 focus-visible:ring-ring tabular-nums" />
              {errors.buildingArea && <p className="text-xs text-destructive">{errors.buildingArea.message as string}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="price" className="text-xs font-semibold text-foreground">{t("unit_form.price")} <span className="text-destructive">*</span></Label>
            <Input id="price" required type="number" {...register("price", { valueAsNumber: true })} className="font-mono bg-card border-input rounded-xl text-xs h-9 focus-visible:ring-2 focus-visible:ring-ring tabular-nums" />
            {errors.price && <p className="text-xs text-destructive">{errors.price.message as string}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status" className="text-xs font-semibold text-foreground">{t("unit_form.status")} <span className="text-destructive">*</span></Label>
            <Select 
              value={watch("status") ?? ""} 
              onValueChange={(val) => setValue("status", val as UnitInput["status"])}
              required
              disabled={isWorkflowStatus}
            >
              <SelectTrigger className="w-full text-xs rounded-xl border border-input bg-card hover:bg-muted/50 focus:ring-2 focus:ring-ring/20 h-9 px-3 transition-premium disabled:opacity-75 disabled:bg-muted/40">
                <SelectValue placeholder={t("unit_form.status_placeholder")}>
                  {watch("status") ? (t(`timeline.${watch("status")}`) || watch("status")) : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="border-input rounded-xl bg-popover backdrop-blur-md">
                <SelectItem value="belum_siap" className="text-xs">{t("timeline.belum_siap")}</SelectItem>
                <SelectItem value="available" className="text-xs">{t("timeline.available")}</SelectItem>
                <SelectItem value="booking" className="text-xs">{t("timeline.booking")}</SelectItem>
                <SelectItem value="kpr_process" className="text-xs">{t("timeline.kpr_process")}</SelectItem>
                <SelectItem value="payment_pending" className="text-xs">{t("timeline.payment_pending")}</SelectItem>
                <SelectItem value="sold" className="text-xs">{t("timeline.sold")}</SelectItem>
                <SelectItem value="construction" className="text-xs">{t("timeline.construction")}</SelectItem>
                <SelectItem value="construction_done" className="text-xs">{t("timeline.construction_done")}</SelectItem>
                <SelectItem value="overdue" className="text-xs">{t("timeline.overdue")}</SelectItem>
                <SelectItem value="cancelled" className="text-xs">{t("timeline.cancelled")}</SelectItem>
              </SelectContent>
            </Select>
            {isWorkflowStatus && (
              <p className="text-[10px] font-semibold text-amber-600 mt-1">
                ⚠️ Status dikunci karena unit ini memiliki transaksi aktif atau sedang dibangun.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs font-semibold text-foreground">{t("unit_form.notes")} <span className="font-normal text-muted-foreground">(Opsional)</span></Label>
            <Input id="notes" {...register("notes")} placeholder="..." className="bg-card border-input rounded-xl text-xs h-9 focus-visible:ring-2 focus-visible:ring-ring" />
          </div>

          {(watch("status") === "available" || watch("status") === "construction") && (
            <div className="flex flex-col gap-3 bg-muted/30 border border-input rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="isReadyStock"
                  {...register("isReadyStock")}
                  className="w-4 h-4 mt-0.5 rounded border-input text-primary/70 focus:ring-ring"
                />
                <div className="space-y-0.5">
                  <Label htmlFor="isReadyStock" className="cursor-pointer text-sm font-bold text-foreground">
                    {t("unit_form.ready_stock")}
                  </Label>
                  <p className="text-[10px] text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: t("unit_form.ready_stock_desc").replace(/<1>/g, '<span class="font-bold text-primary">').replace(/<\/1>/g, '</span>') }} />
                </div>
              </div>
              {watch("status") === "construction" && !watch("isReadyStock") && (
                <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 rounded-md p-2 mt-1 ml-7 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="h-3.5 w-3.5 text-rose-500 mt-0.5 shrink-0" />
                  <p className="text-[10px] font-medium text-rose-700 leading-tight" dangerouslySetInnerHTML={{ __html: t("unit_form.ready_stock_warn").replace(/<1>/g, '<span class="font-bold">').replace(/<\/1>/g, '</span>') }} />
                </div>
              )}
              {errors.isReadyStock && (
                <p className="text-xs font-semibold text-rose-500 pl-7">{errors.isReadyStock.message as string}</p>
              )}

              {watch("isReadyStock") && (
                <div className="pl-7 mt-1 animate-in fade-in zoom-in-95 duration-200 space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="readyStockSource" className="text-xs font-semibold text-foreground mb-1.5 block">Sumber Unit Siap Huni <span className="text-destructive">*</span></Label>
                    <Select 
                      value={watch("readyStockSource") ?? "construction_flow"} 
                      onValueChange={(val) => {
                        setValue("readyStockSource", val as "construction_flow" | "legacy_ready_stock" | "manual_ready_stock");
                        if (val === "legacy_ready_stock" || val === "manual_ready_stock") {
                          setValue("status", "available");
                        }
                      }}
                      required
                    >
                      <SelectTrigger className="w-full text-xs rounded-xl border border-input bg-card hover:bg-muted/50 focus:ring-2 focus:ring-ring/20 h-9 px-3 transition-premium">
                        <SelectValue placeholder="Pilih Sumber Unit Siap Huni">
                          {watch("readyStockSource") === "construction_flow" && "Dibangun melalui ERP (Konstruksi Baru)"}
                          {watch("readyStockSource") === "legacy_ready_stock" && "Existing Siap Huni (Legacy)"}
                          {watch("readyStockSource") === "manual_ready_stock" && "Manual Siap Huni (Admin)"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="border-input rounded-xl bg-popover backdrop-blur-md">
                        <SelectItem value="construction_flow" className="text-xs">Dibangun melalui ERP (Konstruksi Baru)</SelectItem>
                        <SelectItem value="legacy_ready_stock" className="text-xs">Existing Siap Huni (Legacy)</SelectItem>
                        <SelectItem value="manual_ready_stock" className="text-xs">Manual Siap Huni (Admin)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="readyStockVendorId" className="text-xs font-semibold text-foreground mb-1.5 block">{t("unit_form.vendor")} <span className="text-destructive">*</span></Label>
                    <Select 
                      value={watch("readyStockVendorId") ?? ""} 
                      onValueChange={(val) => setValue("readyStockVendorId", val ?? "")}
                      required
                    >
                      <SelectTrigger className="w-full text-xs rounded-xl border border-input bg-card hover:bg-muted/50 focus:ring-2 focus:ring-ring/20 h-9 px-3 transition-premium">
                        <SelectValue placeholder={t("unit_form.vendor_placeholder")}>
                          {watch("readyStockVendorId") ? vendors.find(v => v.id === watch("readyStockVendorId"))?.name : undefined}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="border-input rounded-xl bg-popover backdrop-blur-md">
                        {vendors.length > 0 ? (
                          vendors.map(v => (
                            <SelectItem key={v.id} value={v.id} className="text-xs">{v.name}</SelectItem>
                          ))
                        ) : (
                          <div className="p-2 text-xs text-center text-muted-foreground">{t("unit_form.vendor_empty")}</div>
                        )}
                      </SelectContent>
                    </Select>
                    {errors.readyStockVendorId && <p className="text-xs text-destructive mt-1">{errors.readyStockVendorId.message as string}</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-4 gap-2 border-t border-input mt-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)} className="rounded-xl border-input text-xs h-9 hover:bg-muted/50">
              {t("action.cancel")}
            </Button>
            <Button type="submit" disabled={isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground active:scale-95 btn-premium h-9 rounded-xl font-bold text-xs px-4 gap-2">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? t("unit_form.saving") : t("unit_form.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
