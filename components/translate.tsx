"use client";

import { useI18n } from "@/lib/i18n";
import React from "react";

interface TranslateProps {
  /** Flat dict key, e.g. "booking.title" */
  id?: any;
  /** Namespace prefix, e.g. "booking" */
  namespace?: string;
  /** Key within namespace, e.g. "title" */
  translationKey?: string;
  /** Interpolation values: { count: "3" } */
  values?: Record<string, string>;
  /** Fallback text if key missing */
  fallback?: string;
  /**
   * Render-prop mode — receives translated string, returns ReactNode.
   * Useful for title attributes or custom wrappers.
   */
  render?: (text: string) => React.ReactNode;
  /**
   * JSX component substitutions (e.g. <unit>, <status>).
   * Accepted for API compat; rendering is handled via simple span replacement.
   */
  components?: Record<string, React.ReactElement>;
}

export function Translate({
  id,
  namespace,
  translationKey,
  values,
  fallback,
  render,
  components,
}: TranslateProps) {
  const { t } = useI18n();

  // Resolve dict key
  const key: any = id ?? (namespace && translationKey ? `${namespace}.${translationKey}` : "");
  const text = t(key, values) || fallback || key;

  // If render prop provided, pass the string through
  if (render) {
    return <>{render(text)}</>;
  }

  // Component substitution: replace <tag>content</tag> with wrapped JSX
  if (components && Object.keys(components).length > 0) {
    const parts: React.ReactNode[] = [];
    // Use compatible regex without `s` flag — tags assumed single-line
    const tagPattern = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = tagPattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      const [, tagName, inner] = match;
      const wrapper = components[tagName];
      if (wrapper) {
        parts.push(React.cloneElement(wrapper, { key: match.index }, inner));
      } else {
        parts.push(inner);
      }
      lastIndex = tagPattern.lastIndex;
    }
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    if (parts.length > 0) {
      return <span suppressHydrationWarning>{parts}</span>;
    }
  }

  return <span suppressHydrationWarning>{text}</span>;
}
