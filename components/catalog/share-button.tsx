"use client";

import * as React from "react";
import { Check, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    try {
      if (typeof window !== "undefined") {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // ignore
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={handleCopy}
      title="Скопіювати посилання"
    >
      {copied ? <Check className="size-4 text-emerald-500" /> : <Share2 className="size-4" />}
      {copied ? "Скопійовано!" : "Поділитися"}
    </Button>
  );
}
