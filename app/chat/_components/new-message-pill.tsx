"use client"

import { ArrowDown } from "lucide-react"

interface NewMessagePillProps {
  count: number;
  visible: boolean;
  onClick: () => void;
}

export function NewMessagePill({ count, visible, onClick }: NewMessagePillProps) {
  if (!visible || count <= 0) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-md hover:bg-primary/90 transition-all animate-in slide-in-from-bottom-2 fade-in duration-200"
      aria-label={`${count} pesan baru, klik untuk scroll ke bawah`}
    >
      <span className="tabular-nums">{count} pesan baru</span>
      <ArrowDown className="size-3.5" />
    </button>
  );
}
