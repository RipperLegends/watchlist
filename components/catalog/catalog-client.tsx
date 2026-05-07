"use client";

import * as React from "react";
import { Grid2X2, List, Search, Star } from "lucide-react";
import type { CatalogEntry } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

type ViewMode = "grid" | "list";

const statusLabels = {
  planned: "Планую",
  watching: "Дивлюсь",
  completed: "Завершено"
};

const typeLabels = {
  movie: "Фільм",
  series: "Серіал",
  game: "Гра"
};

export function CatalogClient({ entries }: { entries: CatalogEntry[] }) {
  const [query, setQuery] = React.useState("");
  const [type, setType] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [rating, setRating] = React.useState("all");
  const [viewMode, setViewMode] = React.useState<ViewMode>("grid");
  const [selectedEntry, setSelectedEntry] = React.useState<CatalogEntry | null>(null);

  const filteredEntries = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (normalizedQuery && !entry.title.toLowerCase().includes(normalizedQuery)) return false;
      if (type !== "all" && entry.type !== type) return false;
      if (status !== "all" && entry.status !== status) return false;
      if (rating !== "all" && entry.rating < Number(rating)) return false;
      return true;
    });
  }, [entries, query, rating, status, type]);

  return (
    <div className="flex flex-col gap-6">
      <Card className="grid gap-3 p-4 shadow-none lg:grid-cols-[1fr_160px_160px_150px_auto]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" data-icon="inline-start" />
          <Input className="pl-10" placeholder="Пошук за назвою" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <Select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="all">Усі типи</option>
          <option value="movie">Фільми</option>
          <option value="series">Серіали</option>
          <option value="game">Ігри</option>
        </Select>
        <Select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">Усі статуси</option>
          <option value="planned">Планую</option>
          <option value="watching">Дивлюсь</option>
          <option value="completed">Завершено</option>
        </Select>
        <Select value={rating} onChange={(event) => setRating(event.target.value)}>
          <option value="all">Будь-яка оцінка</option>
          <option value="5">5+</option>
          <option value="4">4+</option>
          <option value="3">3+</option>
        </Select>
        <div className="flex gap-2">
          <Button variant={viewMode === "grid" ? "default" : "outline"} size="icon" onClick={() => setViewMode("grid")} aria-label="Показати квадратами">
            <Grid2X2 data-icon="inline-start" />
          </Button>
          <Button variant={viewMode === "list" ? "default" : "outline"} size="icon" onClick={() => setViewMode("list")} aria-label="Показати рядками">
            <List data-icon="inline-start" />
          </Button>
        </div>
      </Card>

      {filteredEntries.length ? (
        <div className={cn(viewMode === "grid" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "flex flex-col gap-3")}>
          {filteredEntries.map((entry) => (
            <button
              key={entry.id}
              onClick={() => setSelectedEntry(entry)}
              className={cn(
                "group rounded-lg border bg-card text-left shadow-soft transition hover:-translate-y-0.5 hover:border-primary",
                viewMode === "list" && "grid gap-4 p-4 md:grid-cols-[96px_1fr_auto]"
              )}
            >
              <div
                className={cn(
                  "flex aspect-[4/5] items-center justify-center rounded-t-lg bg-gradient-to-br from-primary/70 to-accent/70 text-4xl font-black text-white",
                  viewMode === "list" && "aspect-square rounded-md text-2xl"
                )}
                style={entry.posterUrl ? { backgroundImage: `url(${entry.posterUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
              >
                {!entry.posterUrl ? entry.title.slice(0, 1) : null}
              </div>
              <div className={cn("flex flex-col gap-3 p-4", viewMode === "list" && "p-0")}>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{typeLabels[entry.type]}</Badge>
                  <Badge variant="outline">{statusLabels[entry.status]}</Badge>
                  {entry.isFavorite ? <Badge>Улюблене</Badge> : null}
                </div>
                <div>
                  <h3 className="text-lg font-extrabold">{entry.title}</h3>
                  <p className="text-sm text-muted-foreground">{entry.year ?? "рік не вказано"} · {entry.genre.join(", ") || "жанр не вказано"}</p>
                </div>
                <div className="flex items-center gap-1 text-primary">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={index} className={index < entry.rating ? "fill-current" : ""} data-icon="inline-start" />
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState title="Записів не знайдено." description="Змініть фільтри або додайте перший фільм чи серіал." />
      )}

      <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)} title={selectedEntry?.title ?? "Деталі запису"}>
        {selectedEntry ? (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap gap-2">
              <Badge>{selectedEntry.rating}/5</Badge>
              <Badge variant="secondary">{statusLabels[selectedEntry.status]}</Badge>
              <Badge variant="outline">{selectedEntry.year ?? "рік не вказано"}</Badge>
            </div>
            <p className="leading-7 text-muted-foreground">{selectedEntry.comment || "Коментар ще не додано."}</p>
            {selectedEntry.currentEpisode || selectedEntry.currentSeason ? (
              <p className="rounded-md bg-muted p-3 text-sm">
                Прогрес: сезон {selectedEntry.currentSeason || 0}, епізод {selectedEntry.currentEpisode || 0}
              </p>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
