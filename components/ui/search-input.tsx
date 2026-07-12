"use client";

import { useI18n } from "@/lib/i18n";
import { DictionaryKey } from "@/lib/dictionaries";
import { Search } from "lucide-react";

interface SearchInputProps {
  /** Dot-notation i18n key, e.g. "vendor.search_placeholder" */
  i18nKey: string;
  name?: string;
  defaultValue?: string;
  className?: string;
}

/**
 * Reusable search input that resolves its placeholder via the i18n store.
 * Must be used instead of <Translate render={...}> inside Server Components,
 * because functions cannot be serialised across the Server→Client boundary.
 */
export function SearchInput({
  i18nKey,
  name = "q",
  defaultValue = "",
  className,
}: SearchInputProps) {
  const { t } = useI18n();
  const placeholder = t(i18nKey as DictionaryKey) || i18nKey;

  return (
    <div className="relative w-full" role="search">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-primary pointer-events-none" />
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={
          className ??
          "w-full pl-10 pr-4 h-10 rounded-xl border border-input bg-muted/40 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-all duration-200"
        }
      />
    </div>
  );
}
