"use client";
import { useRouter } from "next/navigation";

import { useTransition, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { projectSchema, type ProjectInput } from "@/server/validators/master";
import { createProject, updateProject } from "@/server/actions/master";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormLabel, FieldError, FormFieldGroup } from "@/components/ui/form-primitives";
import { Plus, Building2, Loader2, AlertCircle } from "lucide-react";
import { parseServerError } from "@/lib/error-parser";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

const PROJECT_STATUS_LABELS: Record<string, string> = {
  active: "Aktif",
  inactive: "Nonaktif",
  completed: "Selesai",
};

export function ProjectForm({ 
  initialData, 
  id 
}: { 
  initialData?: ProjectInput; 
  id?: string;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(projectSchema),
    defaultValues: initialData || {
      code: "",
      name: "",
      location: "",
      description: "",
      status: "active",
      publicEnabled: false,
      isFeaturedPublic: false,
    },
  });
  
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = form;

  const onSubmit = (data: ProjectInput) => {
    startTransition(async () => {
      setError(null);
      try {
        if (id) {
          await updateProject(id, data);
          toast.success(t("proj_form.save_success_update"));
        } else {
          await createProject(data);
          toast.success(t("proj_form.save_success_create"));
        }
        setOpen(false);
        if (!id) reset();
        router.refresh();
      } catch (err) {
        setError(parseServerError(err));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger nativeButton={true} render={
        id ? (
          <Button variant="outline" size="sm" className="h-7 text-xs border-border rounded-lg hover:bg-muted/50">{t("proj_form.edit_btn")}</Button>
        ) : (
          <Button className="btn-premium bg-[#4F6F52] hover:bg-[#3D563F] text-white active:scale-95 shadow-[0_4px_14px_rgba(79,111,82,0.25)] transition-all duration-300 h-9 rounded-xl font-bold text-xs px-4">
            <Plus className="mr-2 h-4 w-4" />
            {t("proj_form.add_btn")}
          </Button>
        )
      } />
      <DialogContent className="sm:max-w-lg rounded-3xl bg-white/98 backdrop-blur-md border border-border shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden font-sans">
        <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-border">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/80 border border-border flex items-center justify-center shadow-sm">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-foreground tracking-tight">{id ? t("proj_form.edit_title") : t("proj_form.add_title")}</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  {id ? t("proj_form.edit_desc") : t("proj_form.add_desc")}
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
            <Label htmlFor="code" className="text-xs font-semibold text-foreground">{t("proj_form.code")} <span className="text-destructive">*</span></Label>
            <Input id="code" required {...register("code")} placeholder="PRJ-001" className="font-mono bg-card border-input rounded-xl text-xs h-9 focus-visible:ring-2 focus-visible:ring-ring tabular-nums" />
            <FieldError>{errors.code?.message}</FieldError>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs font-semibold text-foreground">{t("proj_form.name")} <span className="text-destructive">*</span></Label>
            <Input id="name" required {...register("name")} placeholder="Perumahan Indah Asri" className="bg-card border-input rounded-xl text-xs h-9 focus-visible:ring-2 focus-visible:ring-ring" />
            <FieldError>{errors.name?.message}</FieldError>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="location" className="text-xs font-semibold text-foreground">{t("proj_form.location")}</Label>
            <Input id="location" {...register("location")} placeholder={t("proj_form.loc_placeholder")} className="bg-card border-input rounded-xl text-xs h-9 focus-visible:ring-2 focus-visible:ring-ring" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs font-semibold text-foreground">{t("proj_form.description")}</Label>
            <Textarea id="description" {...register("description")} placeholder={t("proj_form.desc_placeholder")} className="bg-card border-input rounded-xl text-xs min-h-[80px] focus-visible:ring-2 focus-visible:ring-ring resize-none" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status" className="text-xs font-semibold text-foreground">{t("proj_form.status")}</Label>
            <Select 
              value={watch("status") ?? ""} 
              onValueChange={(val) => setValue("status", val as "active" | "inactive" | "completed")}
              required
            >
              <SelectTrigger className="w-full text-xs rounded-xl border border-input bg-card hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring h-9 px-3 transition-premium">
                <SelectValue placeholder={t("proj_form.status_placeholder")}>
                  {(() => {
                    const val = watch("status");
                    return val ? (val === "active" ? t("proj.status_active") : val === "inactive" ? t("proj.status_inactive") : t("proj.status_completed")) : undefined;
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="border-input rounded-xl bg-popover backdrop-blur-md">
                <SelectItem value="active" className="text-xs">{t("proj.status_active")}</SelectItem>
                <SelectItem value="inactive" className="text-xs">{t("proj.status_inactive")}</SelectItem>
                <SelectItem value="completed" className="text-xs">{t("proj.status_completed")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-2xl border border-border/60">
              <div className="space-y-0.5">
                <Label htmlFor="publicEnabled" className="text-xs font-bold text-foreground cursor-pointer">
                  Tampilkan Publik
                </Label>
                <p className="text-[10px] text-muted-foreground font-medium leading-tight">
                  Izinkan calon konsumen melihat siteplan proyek ini tanpa login.
                </p>
              </div>
              <input
                id="publicEnabled"
                type="checkbox"
                {...register("publicEnabled", {
                  onChange: (e) => {
                    // If publicEnabled is turned off, isFeaturedPublic must also be false
                    if (!e.target.checked) {
                      setValue("isFeaturedPublic", false);
                    }
                  }
                })}
                className="w-5 h-5 rounded-lg border-border text-primary focus:ring-ring rounded cursor-pointer accent-primary"
              />
            </div>

            <div className={`flex items-center justify-between p-3 bg-muted/30 rounded-2xl border border-border/60 transition-opacity ${!watch("publicEnabled") ? "opacity-40 pointer-events-none" : ""}`}>
              <div className="space-y-0.5">
                <Label htmlFor="isFeaturedPublic" className="text-xs font-bold text-foreground cursor-pointer">
                  Unggulan Publik (Featured)
                </Label>
                <p className="text-[10px] text-muted-foreground font-medium leading-tight">
                  Tampilkan proyek ini sebagai default saat membuka halaman public view. Wajib aktifkan "Tampilkan Publik" terlebih dahulu.
                </p>
              </div>
              <input
                id="isFeaturedPublic"
                type="checkbox"
                disabled={!watch("publicEnabled")}
                {...register("isFeaturedPublic")}
                className="w-5 h-5 rounded-lg border-border text-primary focus:ring-ring rounded cursor-pointer accent-primary"
              />
            </div>
          </div>

          <DialogFooter className="pt-4 gap-2 border-t border-border mt-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)} className="rounded-xl text-xs h-9">
              {t("action.cancel")}
            </Button>
            <Button type="submit" disabled={isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground active:scale-95 btn-premium h-9 rounded-xl font-bold text-xs px-4 gap-2">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? t("proj_form.saving") : t("proj_form.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
