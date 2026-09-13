"use client";

import { ChevronDown, CircleDot } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Locale = "UK" | "RU" | "EN";

type LanguageSwitcherProps = {
  locale: Locale;
  labels: Record<Locale, string>;
};

const languages: Locale[] = ["UK", "RU", "EN"];

export function LanguageSwitcher({ locale, labels }: LanguageSwitcherProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLocale, setSelectedLocale] = useState(locale);
  const [isPending, startTransition] = useTransition();

  function changeLanguage(nextLocale: Locale) {
    if (nextLocale === selectedLocale || isPending) {
      setIsOpen(false);
      return;
    }

    setSelectedLocale(nextLocale);
    setIsOpen(false);
    startTransition(async () => {
      const response = await fetch("/api/language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: nextLocale })
      });

      if (!response.ok) {
        setSelectedLocale(locale);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="relative w-fit">
      <button
        aria-expanded={isOpen}
        className="flex items-center gap-2 rounded-md px-1 py-1 text-left transition hover:text-white"
        onClick={() => setIsOpen((value) => !value)}
        type="button"
      >
        <CircleDot data-icon="inline-start" />
        <span>{labels[selectedLocale]}</span>
        <ChevronDown className={`size-4 transition ${isOpen ? "rotate-180" : ""}`} data-icon="inline-end" />
      </button>

      {isOpen ? (
        <div className="absolute bottom-full left-0 z-50 mb-3 w-56 overflow-hidden rounded-lg border border-white/10 bg-[#111] p-2 shadow-xl">
          {languages.map((language) => (
            <button
              key={language}
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left font-semibold text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-default disabled:text-primary"
              disabled={isPending || language === selectedLocale}
              onClick={() => changeLanguage(language)}
              type="button"
            >
              <span>{labels[language]}</span>
              {language === selectedLocale ? <CircleDot className="size-4" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
