"use client";

import { useState, useEffect, useCallback } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark" | "system";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  // Read initial value from localStorage
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored === "dark" || stored === "light") {
      setTheme(stored);
    } else {
      // system preference
      setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);

    if (next === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <button
        className="p-2 rounded-xl hover:bg-[#DDE8D8] dark:hover:bg-[#1C2B22] transition-colors"
        aria-label="Toggle theme"
      >
        <Sun className="h-4 w-4 text-[#66736A]" />
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-xl hover:bg-[#DDE8D8] dark:hover:bg-[#1C2B22] transition-colors"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Mode Terang" : "Mode Gelap"}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4 text-amber-400" />
      ) : (
        <Moon className="h-4 w-4 text-[#66736A]" />
      )}
    </button>
  );
}
