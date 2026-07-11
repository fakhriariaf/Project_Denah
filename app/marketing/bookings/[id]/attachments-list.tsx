"use client";

import { useState, useEffect } from "react";
import { FileText, Eye, Trash2 } from "lucide-react";
import { deleteBookingAttachment } from "@/server/actions/marketing";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { Translate } from "@/components/translate";

interface Attachment {
  id: string;
  fileName: string;
  fileUrl: string | null;
  createdAt: Date | null;
}

interface Props {
  bookingId: string;
  initialAttachments: Attachment[];
  canDelete?: boolean;
}

export default function BookingAttachmentsList({ bookingId, initialAttachments, canDelete = false }: Props) {
  const { t } = useI18n();
  const [attachmentsList, setAttachmentsList] = useState<Attachment[]>(initialAttachments);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; fileName: string } | null>(null);

  useEffect(() => {
    setAttachmentsList(initialAttachments);
  }, [initialAttachments]);

  const handleDeleteClick = (attId: string, fileName: string) => {
    setDeleteTarget({ id: attId, fileName });
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    const attId = deleteTarget.id;
    setDeleteTarget(null);

    setLoadingId(attId);
    setError(null);
    try {
      const res = await deleteBookingAttachment(attId);
      if (res.success) {
        setAttachmentsList((prev) => prev.filter((att) => att.id !== attId));
      }
    } catch (err: any) {
      setError(err.message || t("booking_proof.error_delete"));
    } finally {
      setLoadingId(null);
    }
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }) + " " + d.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (attachmentsList.length === 0) {
    return (
      <div className="py-8 text-center">
        <div className="h-12 w-12 rounded-full bg-secondary/40 flex items-center justify-center mx-auto mb-2">
          <FileText className="h-6 w-6 text-primary/70" />
        </div>
        <p className="text-xs text-muted-foreground font-medium">{t("booking_proof.empty")}</p>
        <p className="text-[10px] text-muted-foreground/70 mt-0.5">{t("booking_proof.empty_desc")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="p-2 text-xs font-semibold rounded-lg bg-rose-50 border border-rose-200 text-rose-700">
          {error}
        </div>
      )}
      {attachmentsList.map((att) => (
        <div
          key={att.id}
          className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/50 hover:border-primary/40 transition-colors"
        >
          <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground truncate">{att.fileName}</p>
            <p className="text-[10px] text-primary/70 font-mono">
              {att.createdAt ? formatDate(att.createdAt) : "-"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {att.fileUrl && (
              <a
                href={att.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-7 px-2.5 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 flex items-center justify-center gap-1 text-xs font-semibold transition-colors"
                title={t("booking_proof.view")}
              >
                <Eye className="h-3 w-3" /> {t("booking_proof.view_btn")}
              </a>
            )}

            {canDelete && (
              <button
                type="button"
                disabled={loadingId === att.id}
                onClick={() => handleDeleteClick(att.id, att.fileName)}
                className="h-7 w-7 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center transition-colors disabled:opacity-50"
                title={t("booking_proof.delete")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Confirmation Dialog Pop-up */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md bg-card p-6 rounded-3xl border border-border shadow-sage-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground tracking-tight">{t("booking_proof.delete_title")}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-2 leading-relaxed">
              <Translate namespace="booking_proof" translationKey="delete_desc" values={{ fileName: deleteTarget?.fileName || "" }} components={{ strong: <strong /> }} />
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="rounded-xl border-border text-xs font-semibold"
            >
              {t("action.cancel")}
            </Button>
            <Button
              onClick={executeDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-sm"
            >
              {t("booking_proof.delete_confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
