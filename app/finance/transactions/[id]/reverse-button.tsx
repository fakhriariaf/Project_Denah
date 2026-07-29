"use client";

/**
 * ReverseButton — app/finance/transactions/[id]/reverse-button.tsx (Task 10.5)
 *
 * A small client wrapper that lets an authorized user (Admin Keuangan / Super
 * Admin — gated by the page) trigger the ledger correction/reversal flow for a
 * FINALIZED transaction (approvalStatus ∈ {approved, not_required}).
 *
 * Finalized ledger entries are immutable to direct field mutation (Req 7.5);
 * the ONLY correction path is a traceable reversal (Req 7.6), which inserts an
 * inverse adjustment via `reverseTransaction(transactionId, reason)` and leaves
 * the original row untouched. This dialog captures the required, non-empty
 * reason (≤500 chars), calls the server action, and refreshes on success.
 *
 * On field/validation error the dialog stays open and surfaces the message.
 *
 * _Requirements: 7.5, 7.6_
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Undo2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { reverseTransaction } from "@/server/actions/finance-revision";

const MAX_REASON = 500;

export function ReverseButton({
  transactionId,
  transactionNumber,
}: {
  transactionId: string;
  transactionNumber: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function handleSubmit() {
    setError(null);
    const trimmed = reason.trim();
    if (trimmed.length === 0) {
      setError("Alasan pembalikan wajib diisi.");
      return;
    }
    if (trimmed.length > MAX_REASON) {
      setError(`Alasan pembalikan maksimal ${MAX_REASON} karakter.`);
      return;
    }

    startTransition(async () => {
      try {
        const result = await reverseTransaction(transactionId, trimmed);
        if (result.success) {
          toast.success("Transaksi berhasil dibalik (reversal).");
          setOpen(false);
          setReason("");
          router.refresh();
        } else {
          const fieldMsg = result.fieldErrors?.reason?.[0];
          setError(fieldMsg ?? result.error ?? "Gagal membalik transaksi.");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal membalik transaksi.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setReason("");
          setError(null);
        }
      }}
    >
      <DialogTrigger
        nativeButton={true}
        render={
          <Button type="button" variant="outline" size="sm" className="gap-1">
            <Undo2 className="h-4 w-4" />
            Balik / Reversal
          </Button>
        }
      />
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="h-5 w-5 text-primary" />
            Balik Transaksi
          </DialogTitle>
          <DialogDescription>
            Transaksi{" "}
            <span className="font-mono font-medium text-foreground">
              {transactionNumber}
            </span>{" "}
            sudah final dan tidak dapat diubah langsung. Pembalikan akan membuat
            transaksi penyesuaian yang membalik nilai transaksi ini tanpa mengubah
            data aslinya.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label htmlFor="reversal-reason" className="text-sm font-medium text-foreground">
            Alasan Pembalikan <span className="text-red-600">*</span>
          </label>
          <Textarea
            id="reversal-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Jelaskan alasan pembalikan transaksi ini…"
            maxLength={MAX_REASON}
            rows={4}
            disabled={pending}
            aria-invalid={error ? true : undefined}
          />
          <div className="flex items-center justify-between">
            {error ? (
              <p className="text-xs text-red-600">{error}</p>
            ) : (
              <span />
            )}
            <span className="text-xs text-muted-foreground tabular-nums">
              {reason.trim().length}/{MAX_REASON}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={pending} className="gap-1">
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Balik Transaksi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ReverseButton;
