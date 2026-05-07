"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
};

export function Dialog({ open, onOpenChange, title, children }: DialogProps) {
  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <button className="absolute inset-0 cursor-default" aria-label="Закрити" onClick={() => onOpenChange(false)} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className={cn("relative w-full max-w-2xl rounded-lg border bg-card p-6 text-card-foreground shadow-soft")}
      >
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id="dialog-title" className="text-2xl font-bold">
            {title}
          </h2>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} aria-label="Закрити">
            <X data-icon="inline-start" />
          </Button>
        </div>
        {children}
      </section>
    </div>
  );
}
