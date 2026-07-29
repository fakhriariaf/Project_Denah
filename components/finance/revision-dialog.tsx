"use client";

/**
 * RevisionDialog — components/finance/revision-dialog.tsx (Task 6.2)
 *
 * A config-driven client dialog that drives the two-step finance revision flow
 * for a rejected finance entity (design.md "Two-step revision model"):
 *
 *   1. On OPEN it calls the `startAction(entityId)` server action, which opens a
 *      revision draft (writes a `revised` history marker, no status change). If
 *      that throws (auth/guard failure, e.g. the item is no longer rejected) the
 *      error is toasted and the dialog closes.
 *   2. On SUBMIT it calls `resubmitAction(entityId, data)`:
 *        - `{ success: true }`  → toast success, close, `router.refresh()`.
 *        - `{ success: false, error, fieldErrors }` → keep the dialog OPEN,
 *          preserve the entered data, and render field-level error messages
 *          (Req 4.15).
 *        - a thrown error (auth/guard) → toast the message (dialog stays open).
 *
 * The dialog is intentionally generic so task 8.4 (expense-approval revision)
 * can reuse it with a different editable-field set: callers pass the entity id,
 * the editable `fields` config, `initialValues`, read-only fields (document
 * number + creation date), the prominent rejection reason, and the two action
 * callbacks. Only the fields in `fields` are editable; `readOnlyFields` are
 * displayed but never mutated (Req 4.2).
 *
 * _Requirements: 4.1, 4.2, 4.15, 6.5_
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, FilePenLine, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Result contract shared by the start/resubmit revision server actions. */
export interface RevisionActionResult {
  success: boolean;
  error?: string;
  /** Field-level validation errors keyed by field name (Req 4.15). */
  fieldErrors?: Record<string, string[]>;
  /** Set by an idempotent start-revision no-op (open draft already exists). */
  noop?: boolean;
}

/** The kinds of editable inputs the dialog can render. */
export type RevisionFieldType =
  | "amount"
  | "date"
  | "text"
  | "textarea"
  | "select"
  | "proof";

/** Config for one editable field rendered inside the dialog. */
export interface RevisionFieldConfig {
  /** Payload key — must match the field name the resubmit validator expects. */
  name: string;
  label: string;
  type: RevisionFieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  /** Options for `select` fields. */
  options?: Array<{ value: string; label: string }>;
}

/** A read-only field shown for context but never edited (Req 4.2). */
export interface RevisionReadOnlyField {
  label: string;
  value: string;
  /** Render value in monospace (document numbers, identifiers). */
  mono?: boolean;
}

export interface RevisionDialogProps {
  /** Stable id of the entity being revised (payment id, transaction id, ...). */
  entityId: string;
  /** Editable field configuration (payment: amount/date/method/proof). */
  fields: RevisionFieldConfig[];
  /** Initial values for the editable fields, keyed by field name. */
  initialValues: Record<string, string>;
  /** Read-only fields (document number, creation date) kept visible (Req 4.2). */
  readOnlyFields?: RevisionReadOnlyField[];
  /** Rejection reason shown as a prominent inline notice (Req 4.1). */
  rejectionReason: string | null;
  /** Step 1: opens the revision draft on dialog open. */
  startAction: (entityId: string) => Promise<RevisionActionResult>;
  /** Step 2: validates + resubmits the revised entity on submit. */
  resubmitAction: (
    entityId: string,
    data: Record<string, unknown>,
  ) => Promise<RevisionActionResult>;
  /** Trigger button label. Defaults to "Revisi". */
  triggerLabel?: string;
  /** Dialog title. */
  title?: string;
  /** Dialog description under the title. */
  description?: string;
  /** Success toast message. */
  successMessage?: string;
}

const FALLBACK_ERROR = "Terjadi kesalahan. Coba lagi.";

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return FALLBACK_ERROR;
}

export function RevisionDialog({
  entityId,
  fields,
  initialValues,
  readOnlyFields = [],
  rejectionReason,
  startAction,
  resubmitAction,
  triggerLabel = "Revisi",
  title = "Revisi & Ajukan Ulang",
  description = "Perbaiki data yang ditolak lalu ajukan ulang untuk verifikasi.",
  successMessage = "Revisi berhasil diajukan ulang.",
}: RevisionDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [values, setValues] = React.useState<Record<string, string>>(initialValues);
  /** proofAttachmentId fields: true = clear the current attachment on resubmit. */
  const [clearedProof, setClearedProof] = React.useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isStarting, setIsStarting] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const startedRef = React.useRef(false);

  const setValue = React.useCallback((name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Reset entered data + errors to the initial state.
  const resetForm = React.useCallback(() => {
    setValues(initialValues);
    setClearedProof({});
    setFieldErrors({});
    setFormError(null);
  }, [initialValues]);

  // Step 1 — open the revision draft when the dialog opens (Req 4.1 / design 4.1).
  async function handleOpenChange(next: boolean) {
    if (next) {
      // Opening: reset the form to a clean state, then start the draft.
      resetForm();
      setOpen(true);
      if (startedRef.current || isStarting) return;
      setIsStarting(true);
      try {
        const result = await startAction(entityId);
        if (!result.success) {
          toast.error(result.error ?? FALLBACK_ERROR);
          setOpen(false);
          return;
        }
        startedRef.current = true;
      } catch (err) {
        toast.error(errorMessage(err));
        setOpen(false);
      } finally {
        setIsStarting(false);
      }
      return;
    }
    // Closing: allow the draft marker to remain (it is closed only on resubmit).
    setOpen(false);
    startedRef.current = false;
  }

  // Build the resubmit payload from the editable field values.
  function buildPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    for (const field of fields) {
      if (field.type === "proof") {
        // Keep the current attachment id unless the user chose to clear it.
        const cleared = clearedProof[field.name] === true;
        const current = initialValues[field.name] ?? "";
        payload[field.name] = cleared || current === "" ? null : current;
        continue;
      }
      const raw = values[field.name] ?? "";
      // Empty optional fields become null; otherwise pass the raw string and let
      // the server-side Zod schema coerce (amount → number, date → Date).
      payload[field.name] = raw === "" && !field.required ? null : raw;
    }
    return payload;
  }

  // Step 2 — validate + resubmit (Req 4.4, 4.15).
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    setFieldErrors({});
    setFormError(null);
    setIsSubmitting(true);
    try {
      const result = await resubmitAction(entityId, buildPayload());
      if (result.success) {
        toast.success(successMessage);
        startedRef.current = false;
        setOpen(false);
        router.refresh();
        return;
      }
      // Validation failure: keep the dialog open, preserve entered data, show
      // field-level errors (Req 4.15).
      setFieldErrors(result.fieldErrors ?? {});
      setFormError(result.error ?? "Validasi gagal. Periksa kembali data yang dimasukkan.");
    } catch (err) {
      // Auth/guard failure thrown by the server action.
      setFormError(errorMessage(err));
      toast.error(errorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  const hasReason = Boolean(rejectionReason && rejectionReason.trim() !== "");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        nativeButton={true}
        render={
          <Button
            type="button"
            size="sm"
            className="gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <FilePenLine className="h-4 w-4" />
            {triggerLabel}
          </Button>
        }
      />
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* Prominent rejection-reason notice (Req 4.1). */}
        <div className="rounded-lg border border-red-300 bg-red-50 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-red-800">
            <AlertTriangle className="h-4 w-4" />
            Alasan Penolakan
          </p>
          <p className="mt-1 text-sm text-red-700">
            {hasReason ? rejectionReason : "Alasan penolakan tidak tercatat pada timeline finance."}
          </p>
        </div>

        {/* Read-only context fields — never editable (Req 4.2). */}
        {readOnlyFields.length > 0 && (
          <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-[#F7F8F3] p-3 sm:grid-cols-2">
            {readOnlyFields.map((f) => (
              <div key={f.label} className="space-y-0.5">
                <p className="text-xs font-medium text-muted-foreground">{f.label}</p>
                <p className={f.mono ? "font-mono text-sm text-foreground" : "text-sm text-foreground"}>
                  {f.value || "\u2014"}
                </p>
              </div>
            ))}
          </div>
        )}

        {isStarting ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Menyiapkan revisi…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm font-medium text-destructive">
                {formError}
              </div>
            )}

            {fields.map((field) => {
              const errs = fieldErrors[field.name];
              const invalid = Boolean(errs && errs.length > 0);
              const fieldId = `revision-${field.name}`;
              const errorId = invalid ? `${fieldId}-error` : undefined;
              const helpId = field.helpText ? `${fieldId}-help` : undefined;
              const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;

              return (
                <div key={field.name} className="space-y-1.5">
                  <label htmlFor={fieldId} className="block text-sm font-medium text-foreground">
                    {field.label}
                    {field.required && <span className="ml-0.5 text-destructive">*</span>}
                  </label>

                  {field.helpText && (
                    <p id={helpId} className="text-xs text-muted-foreground">
                      {field.helpText}
                    </p>
                  )}

                  {field.type === "select" ? (
                    <Select
                      value={values[field.name] ?? ""}
                      onValueChange={(val) => setValue(field.name, (val as string) ?? "")}
                      items={(field.options ?? []).map((o) => ({ label: o.label, value: o.value }))}
                    >
                      <SelectTrigger
                        id={fieldId}
                        aria-invalid={invalid}
                        aria-describedby={describedBy}
                        className="w-full"
                      >
                        <SelectValue placeholder={field.placeholder ?? "Pilih…"}>
                          {(() => {
                            const opt = field.options?.find((o) => o.value === values[field.name]);
                            return opt ? opt.label : undefined;
                          })()}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(field.options ?? []).map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : field.type === "textarea" ? (
                    <Textarea
                      id={fieldId}
                      value={values[field.name] ?? ""}
                      placeholder={field.placeholder}
                      aria-invalid={invalid}
                      aria-describedby={describedBy}
                      onChange={(e) => setValue(field.name, e.target.value)}
                    />
                  ) : field.type === "proof" ? (
                    <div className="rounded-lg border border-border bg-[#F7F8F3] p-3">
                      {(initialValues[field.name] ?? "") !== "" ? (
                        <label className="flex items-center gap-2 text-sm text-foreground">
                          <Checkbox
                            checked={clearedProof[field.name] === true}
                            onChange={(e) =>
                              setClearedProof((prev) => ({
                                ...prev,
                                [field.name]: e.target.checked,
                              }))
                            }
                          />
                          Hapus lampiran bukti saat ini
                        </label>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Belum ada lampiran bukti. Lampiran dapat diunggah dari halaman pembayaran.
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {clearedProof[field.name]
                          ? "Lampiran bukti akan dikosongkan saat diajukan ulang."
                          : "Lampiran bukti saat ini dipertahankan."}
                      </p>
                    </div>
                  ) : (
                    <Input
                      id={fieldId}
                      type={field.type === "amount" ? "number" : field.type === "date" ? "date" : "text"}
                      value={values[field.name] ?? ""}
                      placeholder={field.placeholder}
                      aria-invalid={invalid}
                      aria-describedby={describedBy}
                      className={field.type === "amount" ? "font-mono tabular-nums" : undefined}
                      onChange={(e) => setValue(field.name, e.target.value)}
                    />
                  )}

                  {invalid && (
                    <p id={errorId} className="text-xs font-medium text-destructive">
                      {errs!.join(" ")}
                    </p>
                  )}
                </div>
              );
            })}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                Batal
              </Button>
              <Button
                type="submit"
                className="gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? "Mengajukan…" : "Ajukan Ulang"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default RevisionDialog;
