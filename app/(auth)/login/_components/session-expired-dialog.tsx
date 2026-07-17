"use client";

import { useCallback } from "react";
import { Info, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SessionExpiredDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Informational dialog shown when a user is redirected to the login page
 * due to an expired session (reason=session-expired query param).
 *
 * Uses Sage Green styling to convey informational tone (not error/destructive).
 * Dismissible without blocking the login form.
 */
export function SessionExpiredDialog({ open, onClose }: SessionExpiredDialogProps) {
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) onClose();
    },
    [onClose]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="border-primary/30 bg-secondary/80 backdrop-blur-sm sm:max-w-sm"
        showCloseButton={false}
      >
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Info className="size-5" />
            </div>
            <div className="flex-1 space-y-1.5">
              <DialogTitle className="text-secondary-foreground">
                Sesi Berakhir
              </DialogTitle>
              <DialogDescription className="text-secondary-foreground/80">
                Sesi Anda telah berakhir. Silakan masuk kembali.
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              className="shrink-0 text-secondary-foreground/60 hover:bg-primary/10 hover:text-secondary-foreground"
              aria-label="Tutup"
            >
              <X className="size-4" />
            </Button>
          </div>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
