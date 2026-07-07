"use client";

import { useEffect, useCallback, useRef } from "react";

export interface ShortcutConfig {
  /** Key to match (e.g. "k", "n", "Escape", "?") */
  key: string;
  /** Require Ctrl/Cmd */
  ctrl?: boolean;
  /** Require Shift */
  shift?: boolean;
  /** Require Alt */
  alt?: boolean;
  /** Callback when triggered */
  action: () => void;
  /** Description (for cheatsheet) */
  description?: string;
  /** Only active when no input/textarea focused */
  ignoreInInput?: boolean;
}

/**
 * useKeyboardShortcuts — Register multiple keyboard shortcuts.
 *
 * Usage:
 * ```ts
 * useKeyboardShortcuts([
 *   { key: "k", ctrl: true, action: () => setSearchOpen(true), description: "Open search" },
 *   { key: "Escape", action: () => closeModal(), description: "Close" },
 * ]);
 * ```
 */
export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLSelectElement ||
        (activeEl as HTMLElement)?.isContentEditable;

      for (const shortcut of shortcutsRef.current) {
        // Skip if in input and shortcut says to ignore
        if (shortcut.ignoreInInput !== false && isInInput && !shortcut.ctrl && !shortcut.alt) {
          continue;
        }

        const ctrlMatch = shortcut.ctrl ? (e.metaKey || e.ctrlKey) : !(e.metaKey || e.ctrlKey);
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          e.preventDefault();
          shortcut.action();
          return;
        }
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
}

/**
 * useKeyboardShortcut — Single shortcut convenience wrapper.
 */
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options: { ctrl?: boolean; shift?: boolean; alt?: boolean; ignoreInInput?: boolean } = {}
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useKeyboardShortcuts([
    {
      key,
      ctrl: options.ctrl,
      shift: options.shift,
      alt: options.alt,
      ignoreInInput: options.ignoreInInput,
      action: () => callbackRef.current(),
    },
  ]);
}
