"use client";

import { useState } from "react";
import { updateWaitingListStatus, deleteWaitingList } from "@/server/actions/waiting-list";
import { Tag, CheckCircle2, XCircle, Trash2, Loader2 } from "lucide-react";

interface Props {
  id: string;
  currentStatus: string;
  canManage: boolean;
}

export function WaitingListActions({ id, currentStatus, canManage }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  if (!canManage) return null;

  const handle = async (action: string) => {
    setLoading(action);
    try {
      if (action === "delete") {
        if (!confirm("Hapus entri waiting list ini?")) return;
        await deleteWaitingList(id);
      } else {
        await updateWaitingListStatus(id, action as any);
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex items-center gap-1 shrink-0">
      {currentStatus === "waiting" && (
        <button
          onClick={() => handle("offered")}
          disabled={!!loading}
          className="h-7 w-7 rounded-lg bg-sky-50 text-sky-600 hover:bg-sky-100 flex items-center justify-center transition-colors disabled:opacity-50"
          title="Tandai Ditawarkan"
        >
          {loading === "offered" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Tag className="h-3.5 w-3.5" />}
        </button>
      )}
      {(currentStatus === "waiting" || currentStatus === "offered") && (
        <button
          onClick={() => handle("converted")}
          disabled={!!loading}
          className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center transition-colors disabled:opacity-50"
          title="Tandai Terealisasi"
        >
          {loading === "converted" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        </button>
      )}
      {currentStatus !== "cancelled" && currentStatus !== "converted" && (
        <button
          onClick={() => handle("cancelled")}
          disabled={!!loading}
          className="h-7 w-7 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center transition-colors disabled:opacity-50"
          title="Batalkan"
        >
          {loading === "cancelled" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
        </button>
      )}
      <button
        onClick={() => handle("delete")}
        disabled={!!loading}
        className="h-7 w-7 rounded-lg bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 flex items-center justify-center transition-colors disabled:opacity-50"
        title="Hapus"
      >
        {loading === "delete" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
