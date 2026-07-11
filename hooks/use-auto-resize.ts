"use client";

import { useCallback, type RefObject } from "react";

export const MIN_HEIGHT = 40; // 1 line
export const MAX_HEIGHT = 120; // ~5 lines

export function useAutoResize(textareaRef: RefObject<HTMLTextAreaElement | null>) {
  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "auto"; // Reset to measure scrollHeight
    const newHeight = Math.min(Math.max(el.scrollHeight, MIN_HEIGHT), MAX_HEIGHT);
    el.style.height = `${newHeight}px`;
    el.style.overflowY = newHeight >= MAX_HEIGHT ? "auto" : "hidden";
  }, [textareaRef]);

  return { resize };
}
