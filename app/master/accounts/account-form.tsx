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
import { FormLabel, FieldError, FieldHelp, FormFieldGroup } from "@/components/ui/form-primitives";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createFinanceAccount, updateFinanceAccount } from "@/server/actions/master";
import { PlusCircle, Edit2, Landmark, Loader2, AlertCircle } from "lucide-react";
import { parseServerError } from "@/lib/error-parser";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

const schema = z.object({
  code: z.string().min(1, "Kode akun wajib diisi").max(20),
  name: z.string().min(1, "Nama rekening wajib diisi"),
  type: z.enum(["cash", "bank", "receivable", "payable", "income", "expense"]),
  openingBalance: z.coerce.number().min(0, "Saldo awal tidak boleh negatif").default(0),
  status: z.enum(["active", "inactive"]).default("active"),
});
type FormValues = z.infer<typeof schema>;

const TYPE_LABELS: Record<string, string> = {
  cash: "Kas / Tunai",
  bank: "Rekening Bank",
  receivable: "Piutang",
  payable: "Hutang",
  income: "Pendapatan",
  expense: "Pengeluaran",
};

interface Props {
  id?: string;
  initialData?: Partial<FormValues>;
  isEditOnly?: boolean;
}

export function FinanceAccountForm({ id, initialData, isEditOnly = false }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const form = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: initialData?.code ?? "",
      name: initialData?.name ?? "",
      type: initialData?.type ?? "bank",
      openingBalance: initialData?.openingBalance ?? 0,
      status: initialData?.status ?? "active",
    },
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    setErrorMsg(null);
    try {
      if (id) {
        await updateFinanceAccount(id, values);
        toast.success("Rekening kas/bank berhasil diperbarui!");
      } else {
        await createFinanceAccount(values);
        toast.success("Rekening kas/bank berhasil disimpan!");
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

  const typeValue = form.watch("type") as string;
  const statusValue = form.watch("status") as string;

  return (
    <>
      {id ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setOpen(true)}
          className="scale-hover text-muted-foreground hover:text-primary h-8 w-8 p-0"
        >
          <Edit2 className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          onClick={() => setOpen(true)}
          className="btn-premium bg-[#4F6F52] hover:bg-[#3D563F] text-white gap-2"
        >
          <PlusCircle className="h-4 w-4" />
          {t("account_form.add_btn")}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl bg-card backdrop-blur-md border border-border shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden font-sans">
          <div className="bg-gradient-to-r from-secondary/70 via-card/80 to-transparent p-6 border-b border-border">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-background/80 border border-border flex items-center justify-center shadow-sm">
                  <Landmark className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-black text-foreground tracking-tight">
                    {id ? t("account_form.edit_title") : t("account_form.add_title")}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-1">
                    {id ? t("account_form.edit_desc") : t("account_form.add_desc")}
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

            {/* Kode & Tipe */}
            <div className="grid grid-cols-2 gap-4">
              <FormFieldGroup>
                <FormLabel htmlFor="code" required>{t("account_form.code")}</FormLabel>
                <Input
                  id="code"
                  required
                  {...form.register("code")}
                  placeholder={t("account_form.code_placeholder")}
                  disabled={!!id}
                  aria-invalid={!!form.formState.errors.code}
                  className="bg-card border-input rounded-xl text-xs h-9 focus-visible:ring-2 focus-visible:ring-ring font-mono placeholder:text-muted-foreground disabled:opacity-60 disabled:cursor-not-allowed aria-[invalid=true]:border-destructive"
                />
                <FieldError>{form.formState.errors.code && t("account_form.code_error")}</FieldError>
                {id && <FieldHelp>{t("account_form.code_fixed")}</FieldHelp>}
              </FormFieldGroup>

              <FormFieldGroup>
                <FormLabel required>{t("account_form.type")}</FormLabel>
                <Select required value={typeValue} onValueChange={(val) => form.setValue("type", val)}>
                  <SelectTrigger className="w-full text-xs rounded-xl border border-input bg-card hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring h-9 px-3 transition-premium">
                    <SelectValue placeholder={t("account_form.type_placeholder")} />
                  </SelectTrigger>
                  <SelectContent className="border-input rounded-xl bg-popover backdrop-blur-md">
                    {(["cash", "bank", "receivable", "payable", "income", "expense"] as const).map((v) => (
                      <SelectItem key={v} value={v} className="text-xs">{t(`account.type_${v}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormFieldGroup>
            </div>

            {/* Nama */}
            <FormFieldGroup>
              <FormLabel htmlFor="name" required>{t("account_form.name")}</FormLabel>
              <Input
                id="name"
                required
                {...form.register("name")}
                placeholder={t("account_form.name_placeholder")}
                aria-invalid={!!form.formState.errors.name}
                className="bg-card border-input rounded-xl text-xs h-9 focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive"
              />
              <FieldError>{form.formState.errors.name && t("account_form.name_error")}</FieldError>
            </FormFieldGroup>

            {/* Saldo Awal */}
            <FormFieldGroup>
              <FormLabel htmlFor="openingBalance" required>{t("account_form.opening")}</FormLabel>
              <Input
                id="openingBalance"
                type="number"
                step="1000"
                min="0"
                required
                {...form.register("openingBalance")}
                disabled={!!id}
                placeholder="0"
                aria-invalid={!!form.formState.errors.openingBalance}
                className="bg-card border-input rounded-xl text-xs h-9 focus-visible:ring-2 focus-visible:ring-ring font-mono placeholder:text-muted-foreground disabled:opacity-60 disabled:cursor-not-allowed aria-[invalid=true]:border-destructive"
              />
              <FieldError>{form.formState.errors.openingBalance && t("account_form.opening_error")}</FieldError>
              {id && (
                <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  ⚠️ {t("account_form.opening_fixed")}
                </p>
              )}
            </FormFieldGroup>

            {/* Status */}
            <FormFieldGroup>
              <FormLabel required>{t("account_form.status")}</FormLabel>
              <Select required value={statusValue} onValueChange={(val) => form.setValue("status", val)}>
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
                {id ? t("account_form.save_edit") : t("account_form.save_add")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
