"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Undo2 } from "lucide-react";

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
import { reversePayment } from "@/server/actions/finance";

const MIN_REASON = 10;
const MAX_REASON = 500;

/**
 * Controlled cancellation for a verified payment. It creates the reversal
 * ledger row through reversePayment; it never deletes the original payment.
 */
export function VoidPaymentButton({
  paymentId,
  paymentNumber,
}: {
  paymentId: string;
  paymentNumber: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const close = () => {
    setOpen(false);
    setReason("");
    setError(null);
  };

  const handleSubmit = () => {
    const trimmedReason = reason.trim();
    if (trimmedReason.length < MIN_REASON) {
      setError(`Alasan pembatalan minimal ${MIN_REASON} karakter.`);
      return;
    }

    startTransition(async () => {
      try {
        await reversePayment(paymentId, trimmedReason);
        toast.success("Pembayaran dibatalkan dan jurnal pembalikan berhasil dibuat.");
        close();
        router.refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Pembatalan pembayaran gagal diproses.");
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setOpen(true);
        else close();
      }}
    >
      <DialogTrigger
        nativeButton={true}
        render={
          <Button type="button" variant="outline" size="sm" className="gap-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive">
            <Undo2 className="h-4 w-4" aria-hidden="true" />
            Batalkan Pembayaran
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
            Batalkan Pembayaran
          </DialogTitle>
          <DialogDescription>
            Pembayaran <span className="font-mono font-medium text-foreground">{paymentNumber}</span> tidak akan dihapus. Sistem membuat jurnal pembalikan dan mengubah statusnya menjadi Dibatalkan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label htmlFor="payment-void-reason" className="text-sm font-medium text-foreground">
            Alasan Pembatalan <span className="text-destructive">*</span>
          </label>
          <Textarea
            id="payment-void-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Contoh: bukti transfer salah unggah atau transaksi dibatalkan oleh konsumen."
            maxLength={MAX_REASON}
            rows={4}
            disabled={pending}
            aria-invalid={error ? true : undefined}
            aria-describedby="payment-void-reason-help"
          />
          <div id="payment-void-reason-help" className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Minimal {MIN_REASON} karakter.</p>
            <span className="text-xs tabular-nums text-muted-foreground">{reason.trim().length}/{MAX_REASON}</span>
          </div>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={close} disabled={pending}>
            Kembali
          </Button>
          <Button type="button" variant="destructive" onClick={handleSubmit} disabled={pending} className="gap-1">
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Konfirmasi Pembatalan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default VoidPaymentButton;
