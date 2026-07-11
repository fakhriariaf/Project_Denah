"use client";
import { useRouter } from "next/navigation";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormLabel, FieldError, FormFieldGroup } from "@/components/ui/form-primitives";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createBankPartner, updateBankPartner } from "@/server/actions/marketing";
import { PlusCircle, Edit2, Banknote, Loader2, AlertCircle } from "lucide-react";
import { parseServerError } from "@/lib/error-parser";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

const schema = z.object({
  name: z.string().min(2, "Nama bank wajib diisi"),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  id?: string;
  initialData?: Partial<FormValues>;
}

export function BankPartnerForm({ id, initialData }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const form = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initialData?.name ?? "",
      contactPerson: initialData?.contactPerson ?? "",
      phone: initialData?.phone ?? "",
      status: initialData?.status ?? "active",
    },
  });

  const statusValue = form.watch("status") as string;

  async function onSubmit(values: FormValues) {
    setLoading(true);
    setErrorMsg(null);
    try {
      if (id) {
        await updateBankPartner(id, values);
        toast.success("Mitra bank berhasil diperbarui!");
      } else {
        await createBankPartner(values);
        toast.success("Mitra bank berhasil disimpan!");
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
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setOpen(true)}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-[#4F6F52]"
        >
          <Edit2 className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          onClick={() => setOpen(true)}
          className="btn-premium bg-[#4F6F52] hover:bg-[#3D563F] text-white gap-2"
        >
          <PlusCircle className="h-4 w-4" />
          {t("bank_form.add_btn")}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl bg-white/98 backdrop-blur-md border border-[#D6DED2] shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden font-sans">
          <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-[#D6DED2]">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/80 border border-[#D6DED2] flex items-center justify-center shadow-sm">
                  <Banknote className="h-5 w-5 text-[#4F6F52]" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-black text-[#243028] tracking-tight">
                    {id ? t("bank_form.edit_title") : t("bank_form.add_title")}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-[#66736A] mt-1">
                    {id ? t("bank_form.edit_desc") : t("bank_form.add_desc")}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
            {errorMsg && (
              <div role="alert" className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold rounded-xl">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                {errorMsg}
              </div>
            )}

            <FormFieldGroup>
              <FormLabel htmlFor="name" required>{t("bank_form.name")}</FormLabel>
              <Input
                id="name"
                required
                {...form.register("name")}
                placeholder={t("bank_form.name_placeholder")}
                aria-invalid={!!form.formState.errors.name}
                className="bg-card border-input rounded-xl text-xs h-9 focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive"
              />
              <FieldError>{form.formState.errors.name && t("bank_form.error_name")}</FieldError>
            </FormFieldGroup>

            <div className="grid grid-cols-2 gap-3">
              <FormFieldGroup>
                <FormLabel htmlFor="contactPerson">
                  {t("bank_form.contact")} <span className="font-normal text-muted-foreground">(Opsional)</span>
                </FormLabel>
                <Input
                  id="contactPerson"
                  {...form.register("contactPerson")}
                  placeholder={t("bank_form.contact_placeholder")}
                  className="bg-card border-input rounded-xl text-xs h-9 focus-visible:ring-2 focus-visible:ring-ring"
                />
              </FormFieldGroup>

              <FormFieldGroup>
                <FormLabel htmlFor="phone">
                  {t("bank_form.phone")} <span className="font-normal text-muted-foreground">(Opsional)</span>
                </FormLabel>
                <Input
                  id="phone"
                  {...form.register("phone")}
                  placeholder={t("bank_form.phone_placeholder")}
                  className="bg-card border-input rounded-xl text-xs h-9 focus-visible:ring-2 focus-visible:ring-ring font-mono"
                />
              </FormFieldGroup>
            </div>

            <FormFieldGroup>
              <FormLabel required>{t("bank_form.status")}</FormLabel>
              <Select required value={statusValue} onValueChange={(val: string | null) => form.setValue("status", val ?? "active")}>
                <SelectTrigger className="w-full text-xs rounded-xl border border-input bg-card hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring h-9 px-3 transition-premium">
                  <SelectValue>
                    {statusValue ? t(`bank.status_${statusValue}` as any) : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="border-input rounded-xl bg-popover backdrop-blur-md">
                  <SelectItem value="active" className="text-xs">{t("bank.status_active")}</SelectItem>
                  <SelectItem value="inactive" className="text-xs">{t("bank.status_inactive")}</SelectItem>
                </SelectContent>
              </Select>
            </FormFieldGroup>

            <DialogFooter className="pt-4 gap-2 border-t border-border mt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-xl text-xs h-9">
                {t("action.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-primary hover:bg-primary/90 text-primary-foreground btn-premium h-9 rounded-xl font-bold text-xs px-4 gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {id ? t("bank_form.save_edit") : t("bank_form.save_add")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
