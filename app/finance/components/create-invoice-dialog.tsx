"use client";

import * as React from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createInvoice } from "@/server/actions/finance";
import { parseServerError } from "@/lib/error-parser";
import { toast } from "sonner";
import { AlertCircle, Loader2, FileText } from "lucide-react";
import type {
  ProjectOption,
  UnitOption,
  CustomerOption,
} from "@/lib/finance-ui-types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: ProjectOption[];
  units: UnitOption[];
  customers: CustomerOption[];
  onSuccess: () => void;
}

// ---------------------------------------------------------------------------
// Local form schema (mirrors invoiceSchema from server/validators/finance.ts)
// ---------------------------------------------------------------------------

const formSchema = z.object({
  projectId: z.string().min(1, "Proyek wajib dipilih"),
  unitId: z.string().nullable().optional(),
  customerId: z.string().nullable().optional(),
  type: z.enum(["booking_fee", "dp", "installment", "other"]),
  amount: z.coerce.number().min(0.01, "Nominal harus lebih dari 0"),
  dueDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

// ---------------------------------------------------------------------------
// Invoice type options
// ---------------------------------------------------------------------------

const INVOICE_TYPE_OPTIONS = [
  { value: "booking_fee", label: "Booking Fee" },
  { value: "dp", label: "Uang Muka/DP" },
  { value: "installment", label: "Cicilan" },
  { value: "other", label: "Lainnya" },
] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreateInvoiceDialog({
  open,
  onOpenChange,
  projects,
  units,
  customers,
  onSuccess,
}: CreateInvoiceDialogProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const form = useForm<any>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      projectId: "",
      unitId: null,
      customerId: null,
      type: undefined,
      amount: undefined as unknown as number,
      dueDate: null,
      notes: null,
    },
  });

  const selectedProjectId = form.watch("projectId") as string;

  // Filter units by selected project
  const filteredUnits = React.useMemo(
    () => units.filter((u) => u.projectId === selectedProjectId),
    [units, selectedProjectId]
  );

  // Reset unitId when project changes
  React.useEffect(() => {
    form.setValue("unitId", null);
  }, [selectedProjectId, form]);

  // Format number as Rp currency preview
  const amountValue = form.watch("amount") as number | undefined;
  const amountPreview = React.useMemo(() => {
    if (!amountValue || isNaN(Number(amountValue))) return null;
    return `Rp ${Number(amountValue).toLocaleString("id-ID")}`;
  }, [amountValue]);

  async function onSubmit(values: Record<string, unknown>) {
    setLoading(true);
    setErrorMsg(null);
    try {
      const payload = {
        projectId: values.projectId as string,
        unitId: (values.unitId as string) || null,
        customerId: (values.customerId as string) || null,
        bookingId: null,
        type: values.type as string,
        amount: Number(values.amount),
        dueDate: values.dueDate ? new Date(values.dueDate as string) : null,
        notes: (values.notes as string) || null,
      };

      const result = await createInvoice(payload);
      if (result?.success) {
        toast.success("Invoice berhasil dibuat");
        form.reset();
        onOpenChange(false);
        onSuccess();
      }
    } catch (err: unknown) {
      const msg = parseServerError(err);
      setErrorMsg(msg);
      toast.error("Gagal membuat invoice");
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    form.reset();
    setErrorMsg(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100vw-2rem)] max-w-2xl sm:max-w-2xl max-h-[90vh] rounded-2xl bg-white border border-border shadow-lg p-0 overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-secondary/70 via-white to-transparent border-b border-border px-5 py-5 sm:px-6">
          <DialogHeader className="gap-1.5 pr-8">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center shadow-inner">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <DialogTitle className="text-lg font-bold text-foreground tracking-tight">
                Buat Invoice
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs leading-5">
              Buat tagihan customer atau tagihan internal yang tidak terkait booking.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Form */}
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="max-h-[calc(90vh-140px)] overflow-y-auto p-5 sm:p-6"
        >
          {/* Error message */}
          {errorMsg && (
            <div
              role="alert"
              className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {errorMsg}
            </div>
          )}

          <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
          {/* 1. Proyek (required) */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">
              Proyek <span className="text-destructive">*</span>
            </Label>
            <Select
              value={selectedProjectId}
              onValueChange={(v) => form.setValue("projectId", v ?? "")}
            >
              <SelectTrigger className="w-full border-border focus:ring-ring/50">
                <SelectValue placeholder="Pilih proyek">
                  {selectedProjectId
                    ? projects.find((p) => p.id === selectedProjectId)?.name
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border bg-popover max-h-52">
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.projectId && (
              <p role="alert" className="text-xs text-rose-500">
                {String(form.formState.errors.projectId?.message)}
              </p>
            )}
          </div>

          {/* 2. Unit/Kavling (optional, filtered by project) */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">
              Unit/Kavling{" "}
              <span className="text-primary/70 font-normal">(opsional)</span>
            </Label>
            <Select
              value={form.watch("unitId") ?? ""}
              onValueChange={(v) =>
                form.setValue("unitId", v === "" ? null : v)
              }
              disabled={!selectedProjectId}
            >
              <SelectTrigger className="w-full border-border focus:ring-ring/50">
                <SelectValue placeholder="Pilih unit">
                  {form.watch("unitId")
                    ? filteredUnits.find((u) => u.id === form.watch("unitId"))
                        ?.code
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border bg-popover max-h-52">
                {filteredUnits.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 3. Customer (optional) */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">
              Customer{" "}
              <span className="text-primary/70 font-normal">(opsional)</span>
            </Label>
            <Select
              value={form.watch("customerId") ?? ""}
              onValueChange={(v) =>
                form.setValue("customerId", v === "" ? null : v)
              }
            >
              <SelectTrigger className="w-full border-border focus:ring-ring/50">
                <SelectValue placeholder="Pilih customer">
                  {form.watch("customerId")
                    ? customers.find((c) => c.id === form.watch("customerId"))
                        ?.name
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border bg-popover max-h-52">
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 4. Jenis Invoice (required) */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">
              Jenis Invoice <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.watch("type") ?? ""}
              onValueChange={(v) =>
                form.setValue(
                  "type",
                  v as "booking_fee" | "dp" | "installment" | "other"
                )
              }
            >
              <SelectTrigger className="w-full border-border focus:ring-ring/50">
                <SelectValue placeholder="Pilih jenis invoice">
                  {form.watch("type")
                    ? INVOICE_TYPE_OPTIONS.find(
                        (opt) => opt.value === form.watch("type")
                      )?.label
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border bg-popover">
                {INVOICE_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.type && (
              <p role="alert" className="text-xs text-rose-500">
                {String(form.formState.errors.type?.message)}
              </p>
            )}
          </div>

          {/* 5. Nominal (required) */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">
              Nominal <span className="text-destructive">*</span>
            </Label>
            <Input
              {...form.register("amount")}
              type="text"
              inputMode="numeric"
              placeholder="0"
              className="border-border font-mono tabular-nums"
            />
            {amountPreview && (
              <p className="text-xs text-muted-foreground">{amountPreview}</p>
            )}
            {form.formState.errors.amount && (
              <p role="alert" className="text-xs text-rose-500">
                {String(form.formState.errors.amount?.message)}
              </p>
            )}
          </div>

          {/* 6. Jatuh Tempo (optional) */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-foreground">
              Jatuh Tempo{" "}
              <span className="text-primary/70 font-normal">(opsional)</span>
            </Label>
            <Input
              {...form.register("dueDate")}
              type="date"
              className="border-border"
            />
          </div>

          {/* 7. Keterangan (optional) — maps to `notes` field */}
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-sm font-medium text-foreground">
              Keterangan{" "}
              <span className="text-primary/70 font-normal">(opsional)</span>
            </Label>
            <Textarea
              {...form.register("notes")}
              placeholder="Catatan tambahan untuk invoice..."
              rows={3}
              className="border-border resize-none"
            />
          </div>
          </div>

          {/* Footer buttons */}
          <DialogFooter className="mt-5 gap-2 flex-row justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
              className="border-border"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#4F6F52] hover:bg-[#3D563F] text-white gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan Invoice
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
