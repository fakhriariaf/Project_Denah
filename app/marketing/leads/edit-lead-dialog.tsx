"use client";
import { useRouter } from "next/navigation";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { leadSchema } from "@/server/validators/marketing";
import { updateLead } from "@/server/actions/marketing";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, AlertCircle, Loader2 } from "lucide-react";
import { parseServerError } from "@/lib/error-parser";
import { useI18n } from "@/lib/i18n";

interface Props {
  lead: any;
  projects: any[];
  marketings: any[];
  currentUser: any;
  currentUserRole: {
    role: string;
    isSuperAdmin: boolean;
    isAdminKantor: boolean;
    isMarketingManager: boolean;
    isMarketing: boolean;
    isKeuangan: boolean;
    isDireksi: boolean;
    isPengawas: boolean;
    isViewer: boolean;
    isEditor: boolean;
  };
}

export default function EditLeadDialog({
  lead,
  projects,
  marketings,
  currentUser,
  currentUserRole,
}: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Determine who can be assigned as PIC based on role
  const isSuperOrAdmin =
    currentUserRole.isSuperAdmin ||
    currentUserRole.isAdminKantor ||
    currentUserRole.isDireksi;
  const isManager =
    currentUserRole.isMarketingManager && !isSuperOrAdmin;
  const isBiasa =
    currentUserRole.isMarketing &&
    !currentUserRole.isMarketingManager &&
    !isSuperOrAdmin;

  let selectableMarketings = marketings;
  if (isBiasa) {
    selectableMarketings = marketings.filter((m) => m.id === currentUser.id);
  } else if (isManager) {
    // Marketing Manager: themselves + standard marketing who report to them (or all standard marketing as fallback if no supervisor mapping exists in DB yet)
    const hasSubordinates = marketings.some(m => m.roleId === "role_marketing" && m.supervisorId === currentUser.id);
    selectableMarketings = marketings.filter(
      (m) =>
        m.id === currentUser.id ||
        (m.roleId === "role_marketing" && (!hasSubordinates || m.supervisorId === currentUser.id))
    );
  } else {
    selectableMarketings = marketings.filter(
      (m) =>
        m.roleId === "role_marketing" || m.roleId === "role_marketing_manager"
    );
  }

  const { register, handleSubmit, formState: { errors }, reset } = useForm<any>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: lead.name || "",
      phone: lead.phone || "",
      source: lead.source || "walk_in",
      status: lead.status || "new",
      interestedProjectId: lead.interestedProjectId || "",
      interestedUnitId: null,
      assignedMarketingId: lead.assignedMarketingId || currentUser.id,
      notes: lead.notes || "",
    },
  });

  const onSubmit = async (data: any) => {
    setLoading(true);
    setError(null);
    try {
      const res = await updateLead(lead.id, data);
      if (res.success) {
        alert("Data lead/prospek berhasil diperbarui!");
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        nativeButton={true}
        render={
          <Button
            variant="outline"
            size="sm"
            className="border-[#D6DED2] text-[#4F6F52] hover:bg-[#DDE8D8]/40 hover:border-[#8FAF9A] flex items-center gap-1 font-semibold"
          >
            <Pencil className="h-3.5 w-3.5" /> {t("lead_form.edit_btn")}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg rounded-3xl bg-white/98 backdrop-blur-md border border-[#D6DED2] shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden font-sans">
        <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-[#D6DED2]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/80 border border-[#D6DED2] flex items-center justify-center shadow-sm">
                <Pencil className="h-5 w-5 text-[#4F6F52]" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-[#243028] tracking-tight">
                  {t("lead_form.edit_title")}
                </DialogTitle>
                <DialogDescription className="text-xs text-[#66736A] mt-1">
                  {t("lead_form.edit_desc")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4 pt-2 overflow-y-auto max-h-[75vh]">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />{error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
            {/* Row 1, Col 1: Nama Lengkap */}
            <div className="space-y-1">
              <Label
                htmlFor="edit-name"
                className="text-xs font-semibold text-[#243028] font-inter"
              >
                {t("lead_form.name")} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-name"
                required
                {...register("name")}
                placeholder={t("lead_form.name_edit_placeholder")}
                className="bg-[#F7F8F3]/60 border-[#D6DED2] focus:border-[#8FAF9A] focus:ring-[#8FAF9A]/30"
              />
              {errors.name && (
                <p className="text-xs text-rose-500 font-semibold">
                  {((errors.name as any).message as string).startsWith("val.") ? t((errors.name as any).message as any) : (errors.name as any).message}
                </p>
              )}
            </div>

            {/* Row 1, Col 2: Status Prospek */}
            <div className="space-y-1">
              <Label
                htmlFor="edit-status"
                className="text-xs font-semibold text-[#243028] font-inter"
              >
                {t("lead_form.status_edit")}
              </Label>
              <select
                id="edit-status"
                {...register("status")}
                className="flex h-10 w-full rounded-lg border border-[#D6DED2] bg-[#F7F8F3]/60 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8FAF9A]/40"
              >
                <option value="new">{t("lead.status_new")}</option>
                <option value="contacted">{t("lead.status_contacted")}</option>
                <option value="follow_up">{t("lead.status_follow_up")}</option>
                <option value="converted">{t("lead.status_converted")}</option>
                <option value="lost">{t("lead.status_lost")}</option>
              </select>
            </div>

            {/* Row 2, Col 1: Nomor HP */}
            <div className="space-y-1">
              <Label
                htmlFor="edit-phone"
                className="text-xs font-semibold text-[#243028] font-inter"
              >
                {t("lead_form.phone_edit")} <span className="text-red-500">*</span>
              </Label>
              <Input
                id="edit-phone"
                required
                {...register("phone")}
                placeholder={t("lead_form.phone_edit_placeholder")}
                className="bg-[#F7F8F3]/60 border-[#D6DED2] focus:border-[#8FAF9A] font-mono"
              />
              {errors.phone && (
                <p className="text-xs text-rose-500 font-semibold">
                  {((errors.phone as any).message as string).startsWith("val.") ? t((errors.phone as any).message as any) : (errors.phone as any).message}
                </p>
              )}
            </div>

            {/* Row 2, Col 2: Perumahan Diminati */}
            <div className="space-y-1">
              <Label
                htmlFor="edit-project"
                className="text-xs font-semibold text-[#243028] font-inter"
              >
                {t("lead_form.project_edit")}
              </Label>
              <select
                id="edit-project"
                {...register("interestedProjectId")}
                className="flex h-10 w-full rounded-lg border border-[#D6DED2] bg-[#F7F8F3]/60 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8FAF9A]/40"
              >
                <option value="">{t("lead_form.project_placeholder")}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Row 3, Col 1: Sumber Lead */}
            <div className="space-y-1">
              <Label
                htmlFor="edit-source"
                className="text-xs font-semibold text-[#243028] font-inter"
              >
                {t("lead_form.source")}
              </Label>
              <select
                id="edit-source"
                {...register("source")}
                className="flex h-10 w-full rounded-lg border border-[#D6DED2] bg-[#F7F8F3]/60 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8FAF9A]/40"
              >
                <option value="walk_in">{t("lead.source_walk_in")}</option>
                <option value="ads">{t("lead.source_ads")}</option>
                <option value="referral">{t("lead.source_referral")}</option>
                <option value="social_media">{t("lead.source_social_media")}</option>
                <option value="website">{t("lead.source_website")}</option>
                <option value="other">{t("lead.source_other")}</option>
              </select>
            </div>

            {/* Row 3, Col 2: Assign ke Marketing PIC */}
            <div className="space-y-1">
              {!isBiasa ? (
                <>
                  <Label
                    htmlFor="edit-pic"
                    className="text-xs font-semibold text-[#243028] font-inter"
                  >
                    {t("lead_form.pic")}
                  </Label>
                  <select
                    id="edit-pic"
                    {...register("assignedMarketingId")}
                    className="flex h-10 w-full rounded-lg border border-[#D6DED2] bg-[#F7F8F3]/60 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8FAF9A]/40"
                  >
                    {isManager && (
                      <>
                        <option value={currentUser.id}>
                          {t("lead_form.pic_self_edit", { name: currentUser.name })}
                        </option>
                        <optgroup label={t("lead_form.pic_subordinates_edit")}>
                          {selectableMarketings
                            .filter((m) => m.id !== currentUser.id)
                            .map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                        </optgroup>
                      </>
                    )}
                    {isSuperOrAdmin &&
                      selectableMarketings.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.roleName})
                        </option>
                      ))}
                  </select>
                </>
              ) : (
                <div className="h-10 hidden md:block"></div>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label
              htmlFor="edit-notes"
              className="text-xs font-semibold text-[#243028] font-inter"
            >
              {t("lead_form.notes_edit")}
            </Label>
            <textarea
              id="edit-notes"
              {...register("notes")}
              placeholder={t("lead_form.notes_placeholder")}
              className="flex min-h-[60px] w-full rounded-lg border border-[#D6DED2] bg-[#F7F8F3]/60 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8FAF9A]/40"
            />
          </div>

          <DialogFooter className="pt-4 gap-2 border-t border-[#D6DED2] mt-2">
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
              disabled={loading}
              className="bg-[#4F6F52] hover:bg-[#3D563F] text-white active:scale-95 shadow-[0_4px_14px_rgba(79,111,82,0.25)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 h-9 rounded-xl font-bold text-xs px-4 gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? t("lead_form.saving") : t("lead_form.save_edit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
