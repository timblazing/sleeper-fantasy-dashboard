"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const toggleTheme = () => {
    const root = document.documentElement;
    const useDarkTheme = !root.classList.contains("dark");

    root.classList.toggle("dark", useDarkTheme);
    root.style.colorScheme = useDarkTheme ? "dark" : "light";

    try {
      window.localStorage.setItem("theme", useDarkTheme ? "dark" : "light");
    } catch {}
  };

  return (
    <Button aria-label="Toggle theme" onClick={toggleTheme} size="icon-sm" title="Toggle theme" variant="ghost">
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  );
}
