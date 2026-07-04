"use client";

import * as React from "react";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface BulkDeleteConfirmDialogProps {
  /** Whether the dialog is currently open */
  open: boolean;
  /** Callback to close the dialog */
  onOpenChange: (open: boolean) => void;
  /** Number of items to be deleted */
  count: number;
  /** Callback when user confirms the deletion */
  onConfirm: () => void;
  /** Whether the operation is currently processing */
  isProcessing: boolean;
}

/**
 * Confirmation dialog for bulk delete operations.
 * Requires the user to type "HAPUS" (exact, case-sensitive) to enable the confirm button.
 */
export function BulkDeleteConfirmDialog({
  open,
  onOpenChange,
  count,
  onConfirm,
  isProcessing,
}: BulkDeleteConfirmDialogProps) {
  const [confirmText, setConfirmText] = useState("");

  const isConfirmEnabled = confirmText === "HAPUS";

  // Reset input when dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      setConfirmText("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={!isProcessing}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-700">
            <AlertTriangle className="h-5 w-5" />
            Konfirmasi Hapus Massal
          </DialogTitle>
          <DialogDescription>
            Anda akan menghapus <strong>{count}</strong> item. Item dengan status
            &quot;completed&quot; atau &quot;akad&quot; akan dilewati secara otomatis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Label htmlFor="confirm-delete-input" className="text-sm font-medium text-[#243028]">
            Ketik <span className="font-mono font-bold text-rose-600">HAPUS</span> untuk
            mengonfirmasi:
          </Label>
          <Input
            id="confirm-delete-input"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Ketik HAPUS di sini"
            disabled={isProcessing}
            className="font-mono"
            autoComplete="off"
          />
        </div>

        <DialogFooter>
          <DialogClose
            render={
              <Button variant="outline" disabled={isProcessing}>
                Batal
              </Button>
            }
          />
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!isConfirmEnabled || isProcessing}
          >
            {isProcessing ? "Menghapus..." : `Hapus ${count} Item`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
