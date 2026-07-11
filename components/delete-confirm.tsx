"use client";

import { useState, useTransition, useRef } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";

type DeleteConfirmProps = {
  label?: string;
  description?: React.ReactNode;
  onConfirm: () => Promise<{ success: boolean }>;
  /**
   * Optional: called when user confirms deletion, before the actual onConfirm.
   * Use with `useAnimatedDelete` hook to trigger row fade-out animation.
   * Should return a promise that resolves after animation completes.
   */
  onAnimateStart?: () => Promise<void>;
  /**
   * When true, automatically animates the closest <tr> parent with a fade-out
   * before executing the delete action. Defaults to true.
   */
  animateRow?: boolean;
};

export function DeleteConfirm({
  label = "",
  description,
  onConfirm,
  onAnimateStart,
  animateRow = true,
}: DeleteConfirmProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  /**
   * Finds the closest <tr> ancestor and applies the fade-out animation.
   * Returns a promise that resolves after the animation completes (300ms).
   */
  const animateRowFadeOut = (): Promise<void> => {
    return new Promise((resolve) => {
      const row = triggerRef.current?.closest("tr");
      if (row) {
        row.classList.add("animate-row-delete");
        setTimeout(resolve, 300);
      } else {
        resolve();
      }
    });
  };

  const handleConfirm = () => {
    startTransition(async () => {
      setError(null);
      try {
        // Close dialog first so user sees the row animation
        setOpen(false);

        // Trigger custom animation callback if provided
        if (onAnimateStart) {
          await onAnimateStart();
        } else if (animateRow) {
          // Auto-animate the closest table row
          await animateRowFadeOut();
        }

        await onConfirm();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("delete_confirm.error"));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger nativeButton={true} render={
        <Button
          ref={triggerRef}
          variant="outline"
          size="sm"
          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 hover:border-rose-300 transition-all duration-200"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      } />
      <DialogContent className="sm:max-w-[380px] rounded-3xl bg-white/95 backdrop-blur-md border-[#D6DED2] shadow-[0_8px_30px_rgb(143,175,154,0.12)] p-0 overflow-hidden">
        {/* Destructive Icon Header */}
        <div className="flex flex-col items-center pt-8 pb-4 px-6 bg-gradient-to-b from-rose-50/60 to-transparent">
          <div className="h-14 w-14 rounded-full bg-rose-100 flex items-center justify-center mb-3 shadow-[0_0_0_6px_rgb(254,202,202,0.3)]">
            <AlertTriangle className="h-7 w-7 text-rose-600" />
          </div>
          <DialogHeader className="text-center">
            <DialogTitle className="text-[#243028] font-bold text-lg text-center">
              {t("delete_confirm.title", { label: label || t("delete_confirm.default_label") })}
            </DialogTitle>
            <DialogDescription className="text-[#66736A] text-sm text-center mt-1 leading-relaxed">
              {description ?? t("delete_confirm.default_desc", { label: label || t("delete_confirm.default_label") })}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-6 mb-2 p-3 bg-rose-50 border border-rose-200 rounded-xl">
            <p className="text-sm text-rose-600 font-medium">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 px-6 pb-6 pt-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="flex-1 border-[#D6DED2] text-[#66736A] hover:bg-[#F7F8F3] hover:text-[#243028] rounded-xl h-11 font-semibold transition-all duration-200"
          >
            {t("action.cancel")}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isPending}
            className="flex-1 bg-rose-600 hover:bg-rose-700 text-white rounded-xl h-11 font-semibold shadow-[0_4px_14px_rgba(215,122,122,0.35)] btn-premium disabled:opacity-60 disabled:scale-100"
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {t("delete_confirm.deleting")}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                {t("delete_confirm.confirm_btn")}
              </span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
