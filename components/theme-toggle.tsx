"use client"

import React, { useEffect, useState } from "react"
import { Sun, Moon } from "lucide-react"

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light")

  useEffect(() => {
    // Check initialized theme on mount
    const isDark = document.documentElement.classList.contains("dark")
    setTheme(isDark ? "dark" : "light")
  }, [])

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.contains("dark")
    if (isDark) {
      document.documentElement.classList.remove("dark")
      localStorage.theme = "light"
      setTheme("light")
    } else {
      document.documentElement.classList.add("dark")
      localStorage.theme = "dark"
      setTheme("dark")
    }
  }

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border border-[#D6DED2] dark:border-[#66736A] bg-white dark:bg-[#4F6F52] hover:bg-[#DDE8D8]/45 dark:hover:bg-[#66736A]/50 text-[#66736A] dark:text-[#DDE8D8] transition-all duration-200 w-full font-sans text-xs font-semibold hover:translate-x-0.5"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? (
        <>
          <Sun className="h-4 w-4 text-amber-400 shrink-0" />
          <span>Mode Terang</span>
        </>
      ) : (
        <>
          <Moon className="h-4 w-4 text-[#8FAF9A] shrink-0" />
          <span>Mode Gelap</span>
        </>
      )}
    </button>
  )
}
