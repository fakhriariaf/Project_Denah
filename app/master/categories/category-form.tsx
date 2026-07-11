"use client";
import { useRouter } from "next/navigation";

import { useTransition, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { financeCategorySchema, type FinanceCategoryInput } from "@/server/validators/master";
import { createFinanceCategory, updateFinanceCategory } from "@/server/actions/master";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormLabel, FieldError, FormFieldGroup } from "@/components/ui/form-primitives";
import { Plus, Tag, Loader2, AlertCircle } from "lucide-react";
import { parseServerError } from "@/lib/error-parser";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

export function CategoryForm({ 
  initialData, 
  id,
  categories = []
}: { 
  initialData?: FinanceCategoryInput; 
  id?: string;
  categories?: Array<{ id: string; name: string; type: string }>;
}) {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    resolver: zodResolver(financeCategorySchema),
    defaultValues: initialData || {
      name: "",
      type: "expense",
      parentId: "",
    },
  });
  
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = form;

  const onSubmit = (data: FinanceCategoryInput) => {
    startTransition(async () => {
      setError(null);
      try {
        if (id) {
          await updateFinanceCategory(id, data);
          toast.success("Kategori keuangan berhasil diperbarui!");
        } else {
          await createFinanceCategory(data);
          toast.success("Kategori keuangan berhasil disimpan!");
        }
        setOpen(false);
        if (!id) reset();
        router.refresh();
      } catch (err) {
        setError(parseServerError(err));
      }
    });
  };

  const selectedType = watch("type");
  // Filter potential parent categories to only match same category type and avoid self-selection
  const availableParents = categories.filter(c => c.type === selectedType && c.id !== id);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger nativeButton={true} render={
        id ? (
          <Button variant="outline" size="sm" className="h-7 text-xs border-border rounded-lg hover:bg-muted/50">{t("category_form.edit_btn")}</Button>
        ) : (
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground active:scale-95 shadow-[0_4px_14px_rgba(79,111,82,0.25)] transition-all duration-300 h-9 rounded-xl font-bold text-xs px-4">
            <Plus className="mr-2 h-4 w-4" />
            {t("category_form.add_btn")}
          </Button>
        )
      } />
      <DialogContent className="sm:max-w-lg rounded-3xl bg-white/98 backdrop-blur-md border border-border shadow-[0_8px_30px_rgb(143,175,154,0.15)] p-0 overflow-hidden font-sans">
        <div className="bg-gradient-to-r from-[#DDE8D8]/70 via-white/80 to-transparent p-6 border-b border-border">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/80 border border-border flex items-center justify-center shadow-sm">
                <Tag className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-foreground tracking-tight">{id ? t("category_form.edit_title") : t("category_form.add_title")}</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  {id ? t("category_form.edit_desc") : t("category_form.add_desc")}
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
          
          <FormFieldGroup>
            <FormLabel htmlFor="name" required>{t("category_form.name")}</FormLabel>
            <Input id="name" required {...register("name")} placeholder={t("category_form.name_placeholder")} aria-invalid={!!errors.name} className="bg-card border-input rounded-xl text-xs h-9 focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive" />
            <FieldError>{errors.name && t("category_form.error_name")}</FieldError>
          </FormFieldGroup>

          <FormFieldGroup>
            <FormLabel required>{t("category_form.type")}</FormLabel>
            <Select 
              value={watch("type") ?? ""} 
              onValueChange={(val) => {
                setValue("type", val as FinanceCategoryInput["type"]);
                setValue("parentId", ""); // Reset parent when changing type
              }}
              required
            >
              <SelectTrigger className="w-full text-xs rounded-xl border border-input bg-card hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring h-9 px-3 transition-premium">
                <SelectValue placeholder={t("category_form.type_placeholder")}>
                  {watch("type") === "income" && t("category_form.type_income")}
                  {watch("type") === "expense" && t("category_form.type_expense")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="border-input rounded-xl bg-popover backdrop-blur-md">
                <SelectItem value="income" className="text-xs">{t("category_form.type_income")}</SelectItem>
                <SelectItem value="expense" className="text-xs">{t("category_form.type_expense")}</SelectItem>
              </SelectContent>
            </Select>
            <FieldError>{errors.type && t("category_form.error_type")}</FieldError>
          </FormFieldGroup>

          <FormFieldGroup>
            <FormLabel>{t("category_form.parent")}</FormLabel>
            <Select 
              value={watch("parentId") ?? ""} 
              onValueChange={(val) => setValue("parentId", val || null)}
            >
              <SelectTrigger className="w-full text-xs rounded-xl border border-input bg-card hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring h-9 px-3 transition-premium">
                <SelectValue placeholder={t("category_form.parent_placeholder")}>
                  {watch("parentId") ? availableParents.find(p => p.id === watch("parentId"))?.name : t("category_form.parent_placeholder")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="border-input rounded-xl bg-popover backdrop-blur-md">
                <SelectItem value="" className="text-xs">{t("category_form.parent_placeholder")}</SelectItem>
                {availableParents.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormFieldGroup>

          <DialogFooter className="pt-4 gap-2 border-t border-border mt-2">
            <Button variant="outline" type="button" onClick={() => setOpen(false)} className="rounded-xl border-border text-xs h-9 hover:bg-muted/50">
              {t("action.cancel")}
            </Button>
            <Button type="submit" disabled={isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground active:scale-95 btn-premium h-9 rounded-xl font-bold text-xs px-4 gap-2">
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPending ? t("category_form.saving") : t("category_form.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
