"use client";

import * as React from "react";
import Link from "next/link";
import { Check, CheckCircle2, ChevronDown, Clock, Eye, Plus, Sparkles, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";

type WatchlistStatus = "planned" | "watching" | "completed";

type WatchlistItem = {
  id: number;
  status: WatchlistStatus;
  currentSeason: number;
  currentEpisode: number;
  note: string;
};

const statusConfig: Record<WatchlistStatus, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  planned: { label: "Планую", icon: Clock },
  watching: { label: "Дивлюсь", icon: Eye },
  completed: { label: "Завершено", icon: CheckCircle2 }
};

export function EntryWatchlistAction({
  entryId,
  initialItem,
  hasPlusAccess
}: {
  entryId: number;
  initialItem: WatchlistItem | null;
  hasPlusAccess: boolean;
}) {
  const [item, setItem] = React.useState<WatchlistItem | null>(initialItem);
  const [loading, setLoading] = React.useState(false);

  if (!hasPlusAccess) {
    return (
      <Button asChild variant="outline" size="sm" className="gap-2 border-amber-500/30 text-amber-500 hover:bg-amber-500/10">
        <Link href="/watchlist-plus">
          <Sparkles className="size-4 text-amber-500" />
          Додати в Watchlist Plus
        </Link>
      </Button>
    );
  }

  async function handleAdd() {
    setLoading(true);
    try {
      const res = await fetch("/api/watchlist-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId })
      });
      if (!res.ok) throw new Error("Failed to add");
      const data = await res.json();
      if (data.item) {
        setItem(data.item);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(nextStatus: WatchlistStatus) {
    if (!item) return;
    const prevItem = item;
    setItem({ ...item, status: nextStatus });
    try {
      const res = await fetch(`/api/watchlist-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      if (!res.ok) throw new Error("Failed to update status");
    } catch {
      setItem(prevItem);
    }
  }

  async function handleRemove() {
    if (!item) return;
    const prevItem = item;
    setItem(null);
    try {
      const res = await fetch(`/api/watchlist-items/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    } catch {
      setItem(prevItem);
    }
  }

  if (!item) {
    return (
      <Button
        variant="default"
        size="sm"
        className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md shadow-indigo-500/20"
        onClick={handleAdd}
        disabled={loading}
      >
        <Plus className="size-4" />
        {loading ? "Додаємо..." : "Додати у список"}
      </Button>
    );
  }

  const StatusIcon = statusConfig[item.status]?.icon || Clock;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-lg border bg-background/80 px-2.5 py-1 text-xs font-semibold shadow-sm">
        <StatusIcon className="size-3.5 text-primary" />
        <span className="text-muted-foreground mr-1">Статус:</span>
        <select
          value={item.status}
          onChange={(e) => handleStatusChange(e.target.value as WatchlistStatus)}
          className="bg-transparent font-bold text-foreground outline-none cursor-pointer"
        >
          <option value="planned">Планую</option>
          <option value="watching">Дивлюсь</option>
          <option value="completed">Завершено</option>
        </select>
      </div>

      <Button asChild variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground">
        <Link href="/watchlist-plus">
          Мій список →
        </Link>
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground hover:text-destructive"
        onClick={handleRemove}
        title="Видалити зі списку"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
