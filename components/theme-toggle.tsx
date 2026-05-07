"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [theme, setTheme] = React.useState<"light" | "dark">("light");

  React.useEffect(() => {
    const savedTheme = window.localStorage.getItem("watchlist-theme") === "dark" ? "dark" : "light";
    setTheme(savedTheme);
    document.documentElement.classList.toggle("dark", savedTheme === "dark");
  }, []);

  return (
    <Button
      variant="outline"
      size="icon"
      type="button"
      aria-label="Перемкнути тему"
      onClick={() => {
        const nextTheme = theme === "dark" ? "light" : "dark";
        setTheme(nextTheme);
        document.documentElement.classList.toggle("dark", nextTheme === "dark");
        window.localStorage.setItem("watchlist-theme", nextTheme);
      }}
    >
      {theme === "dark" ? <Moon data-icon="inline-start" /> : <Sun data-icon="inline-start" />}
    </Button>
  );
}
