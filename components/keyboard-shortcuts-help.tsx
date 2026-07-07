"use client";

import { useState } from "react";
import { X, Keyboard } from "lucide-react";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcuts";

const SHORTCUTS = [
  { keys: ["Ctrl", "K"], description: "Buka pencarian global" },
  { keys: ["?"], description: "Tampilkan pintasan keyboard ini" },
  { keys: ["Esc"], description: "Tutup modal / dialog / overlay" },
  { keys: ["Ctrl", "D"], description: "Buka Dashboard" },
  { keys: ["Ctrl", "Shift", "T"], description: "Toggle tema gelap/terang" },
];

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  // ? key opens cheatsheet (only when not in input)
  useKeyboardShortcut("?", () => setOpen(true), { shift: true, ignoreInInput: true });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={() => setOpen(false)}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />

      {/* Panel */}
      <div
        className="relative w-full max-w-md bg-white dark:bg-[#151E1A] rounded-2xl shadow-2xl border border-[#D6DED2] dark:border-[#1F2E26] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#D6DED2] dark:border-[#1F2E26]">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-[#4F6F52]" />
            <h3 className="font-bold text-sm text-[#243028] dark:text-[#E3EAE6]">Pintasan Keyboard</h3>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg hover:bg-[#DDE8D8] dark:hover:bg-[#1C2B22] transition-colors"
          >
            <X className="h-4 w-4 text-[#66736A]" />
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="px-5 py-4 space-y-2.5">
          {SHORTCUTS.map((shortcut, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 px-3 rounded-xl bg-[#F7F8F3] dark:bg-[#18221D] border border-[#D6DED2]/40 dark:border-[#1F2E26]"
            >
              <span className="text-xs text-[#243028] dark:text-[#E3EAE6] font-medium">
                {shortcut.description}
              </span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, j) => (
                  <kbd
                    key={j}
                    className="px-2 py-1 bg-white dark:bg-[#0D1310] border border-[#D6DED2] dark:border-[#1F2E26] rounded-md text-[10px] font-mono font-semibold text-[#4F6F52] dark:text-[#8FAF9A] shadow-sm min-w-[24px] text-center"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#D6DED2] dark:border-[#1F2E26] text-center">
          <p className="text-[10px] text-[#A8B0AA]">
            Tekan <kbd className="px-1 py-0.5 bg-[#F7F8F3] dark:bg-[#18221D] border border-[#D6DED2] dark:border-[#1F2E26] rounded text-[9px] font-mono">Esc</kbd> untuk menutup
          </p>
        </div>
      </div>
    </div>
  );
}
