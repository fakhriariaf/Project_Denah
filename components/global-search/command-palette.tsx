"use client";

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import {
  Search,
  Building2,
  Home,
  FileText,
  Users,
  Wrench,
  UserCircle,
  Loader2,
  X,
} from "lucide-react";
import { globalSearch, type SearchResult } from "@/server/actions/search";

const TYPE_ICONS: Record<SearchResult["type"], React.ReactNode> = {
  unit: <Home className="h-4 w-4 text-emerald-600" />,
  project: <Building2 className="h-4 w-4 text-blue-600" />,
  booking: <FileText className="h-4 w-4 text-violet-600" />,
  invoice: <FileText className="h-4 w-4 text-amber-600" />,
  spk: <Wrench className="h-4 w-4 text-orange-600" />,
  lead: <Users className="h-4 w-4 text-teal-600" />,
  user: <UserCircle className="h-4 w-4 text-gray-600" />,
};

const TYPE_LABELS: Record<SearchResult["type"], string> = {
  unit: "Unit",
  project: "Proyek",
  booking: "Booking",
  invoice: "Invoice",
  spk: "SPK",
  lead: "Lead",
  user: "User",
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  // Debounced search
  const handleSearch = useCallback((value: string) => {
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await globalSearch(value);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      setOpen(false);
      setQuery("");
      setResults([]);
      router.push(result.href);
    },
    [router]
  );

  // Group results by type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = [];
    acc[r.type].push(r);
    return acc;
  }, {});

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />

      {/* Command Dialog */}
      <div className="absolute inset-0 flex items-start justify-center pt-[15vh]" onClick={(e) => e.stopPropagation()}>
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#D6DED2] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <Command shouldFilter={false} className="flex flex-col">
            {/* Search Input */}
            <div className="flex items-center px-4 border-b border-[#D6DED2]">
              <Search className="h-4 w-4 text-[#8FAF9A] shrink-0" />
              <Command.Input
                value={query}
                onValueChange={handleSearch}
                placeholder="Cari unit, booking, invoice, SPK, lead..."
                className="flex-1 h-12 px-3 text-sm text-[#243028] placeholder:text-[#A8B0AA] bg-transparent outline-none border-none focus:ring-0"
                autoFocus
              />
              {isSearching && <Loader2 className="h-4 w-4 text-[#8FAF9A] animate-spin shrink-0" />}
              <button
                onClick={() => setOpen(false)}
                className="ml-2 p-1 rounded-md hover:bg-[#DDE8D8] transition-colors"
              >
                <X className="h-3.5 w-3.5 text-[#66736A]" />
              </button>
            </div>

            {/* Results */}
            <Command.List className="max-h-[360px] overflow-y-auto p-2">
              {query.trim().length < 2 && (
                <div className="py-8 text-center">
                  <p className="text-xs text-[#A8B0AA]">Ketik minimal 2 karakter untuk mencari...</p>
                  <p className="text-[10px] text-[#A8B0AA] mt-1 font-mono">Ctrl+K untuk buka/tutup</p>
                </div>
              )}

              {query.trim().length >= 2 && !isSearching && results.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-xs text-[#66736A]">Tidak ditemukan hasil untuk &quot;{query}&quot;</p>
                </div>
              )}

              {Object.entries(grouped).map(([type, items]) => (
                <Command.Group key={type} heading={TYPE_LABELS[type as SearchResult["type"]] || type}>
                  <div className="px-2 py-1">
                    <p className="text-[10px] font-bold text-[#8FAF9A] uppercase tracking-wider mb-1">
                      {TYPE_LABELS[type as SearchResult["type"]] || type}
                    </p>
                  </div>
                  {items.map((result) => (
                    <Command.Item
                      key={result.id}
                      value={result.id}
                      onSelect={() => handleSelect(result)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-[#DDE8D8]/50 data-[selected=true]:bg-[#DDE8D8]/50 transition-colors"
                    >
                      <div className="h-8 w-8 rounded-lg bg-[#F7F8F3] border border-[#D6DED2]/60 flex items-center justify-center shrink-0">
                        {TYPE_ICONS[result.type]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#243028] truncate">{result.title}</p>
                        {result.subtitle && (
                          <p className="text-[11px] text-[#66736A] truncate">{result.subtitle}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-[#A8B0AA] font-mono shrink-0">
                        {TYPE_LABELS[result.type]}
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>

            {/* Footer */}
            <div className="border-t border-[#D6DED2] px-4 py-2 flex items-center justify-between text-[10px] text-[#A8B0AA]">
              <div className="flex items-center gap-3">
                <span><kbd className="px-1.5 py-0.5 bg-[#F7F8F3] border border-[#D6DED2] rounded text-[9px] font-mono">↑↓</kbd> navigasi</span>
                <span><kbd className="px-1.5 py-0.5 bg-[#F7F8F3] border border-[#D6DED2] rounded text-[9px] font-mono">Enter</kbd> buka</span>
                <span><kbd className="px-1.5 py-0.5 bg-[#F7F8F3] border border-[#D6DED2] rounded text-[9px] font-mono">Esc</kbd> tutup</span>
              </div>
            </div>
          </Command>
        </div>
      </div>
    </div>
  );
}
