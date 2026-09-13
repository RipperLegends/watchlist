"use client";

import * as React from "react";
import { Dices, Grid2X2, List, Lock, Search, Sparkles, Star, ThumbsDown, ThumbsUp } from "lucide-react";
import Link from "next/link";
import type { CatalogEntry } from "@/lib/data";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  series: "Серіал"
};

type ReactionValue = -1 | 0 | 1;
const PAGE_SIZE = 24;

function ReactionControls({
  entry,
  canReact,
  isPending,
  onReact
}: {
  entry: CatalogEntry;
  canReact: boolean;
  isPending: boolean;
  onReact: (entryId: number, value: Exclude<ReactionValue, 0>) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant={entry.myReaction === 1 ? "default" : "outline"}
        disabled={!canReact || isPending}
        onClick={(event) => {
          event.stopPropagation();
          onReact(entry.id, 1);
        }}
        title={canReact ? "Лайк" : "Увійдіть, щоб поставити лайк"}
        aria-label={`Лайк: ${entry.title}`}
      >
        <ThumbsUp data-icon="inline-start" />
        {entry.likes}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={entry.myReaction === -1 ? "destructive" : "outline"}
        disabled={!canReact || isPending}
        onClick={(event) => {
          event.stopPropagation();
          onReact(entry.id, -1);
        }}
        title={canReact ? "Дизлайк" : "Увійдіть, щоб поставити дизлайк"}
        aria-label={`Дизлайк: ${entry.title}`}
      >
        <ThumbsDown data-icon="inline-start" />
        {entry.dislikes}
      </Button>
    </div>
  );
}

export function CatalogClient({
  entries,
  canManage,
  canReact,
  canUsePersonalList
}: {
  entries: CatalogEntry[];
  canManage: boolean;
  canReact: boolean;
  canUsePersonalList: boolean;
}) {
  const [entryState, setEntryState] = React.useState(entries);
  const [query, setQuery] = React.useState("");
  const [type, setType] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [rating, setRating] = React.useState("all");
  const [sortBy, setSortBy] = React.useState("default");
  const [viewMode, setViewMode] = React.useState<ViewMode>("grid");
  const [pendingReactionId, setPendingReactionId] = React.useState<number | null>(null);
  const [pendingWatchlistEntryId, setPendingWatchlistEntryId] = React.useState<number | null>(null);
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
  const [randomEntry, setRandomEntry] = React.useState<CatalogEntry | null>(null);
  const [isSpinning, setIsSpinning] = React.useState(false);

  function pickRandomEntry() {
    const pool = filteredEntries.length ? filteredEntries : entryState;
    if (!pool.length) return;
    setIsSpinning(true);
    let count = 0;
    const interval = setInterval(() => {
      const idx = Math.floor(Math.random() * pool.length);
      setRandomEntry(pool[idx]);
      count++;
      if (count > 5) {
        clearInterval(interval);
        setIsSpinning(false);
      }
    }, 100);
  }

  React.useEffect(() => {
    setEntryState(entries);
  }, [entries]);

  const filteredEntries = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const result = entryState.filter((entry) => {
      if (normalizedQuery && !entry.title.toLowerCase().includes(normalizedQuery)) return false;
      if (type !== "all" && entry.type !== type) return false;
      if (status !== "all" && entry.status !== status) return false;
      if (rating !== "all" && entry.rating !== Number(rating)) return false;
      return true;
    });

    switch (sortBy) {
      case "rating-desc":
        return [...result].sort((a, b) => b.rating - a.rating);
      case "rating-asc":
        return [...result].sort((a, b) => a.rating - b.rating);
      case "year-desc":
        return [...result].sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
      case "year-asc":
        return [...result].sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
      case "title-asc":
        return [...result].sort((a, b) => a.title.localeCompare(b.title, "uk-UA"));
      case "title-desc":
        return [...result].sort((a, b) => b.title.localeCompare(a.title, "uk-UA"));
      case "likes-desc":
        return [...result].sort((a, b) => b.likes - a.likes);
      default:
        return result;
    }
  }, [entryState, query, rating, status, type, sortBy]);

  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, rating, status, type, viewMode, sortBy]);

  const visibleEntries = filteredEntries.slice(0, visibleCount);
  const hiddenEntriesCount = filteredEntries.length - visibleEntries.length;

  function updateEntryReaction(id: number, payload: { likes: number; dislikes: number; myReaction: ReactionValue }) {
    setEntryState((entries) => entries.map((entry) => (entry.id === id ? { ...entry, ...payload } : entry)));
  }

  function updateEntryWatchlistItem(id: number, item: NonNullable<CatalogEntry["myWatchlistItem"]> | null) {
    setEntryState((entries) => entries.map((entry) => (entry.id === id ? { ...entry, myWatchlistItem: item } : entry)));
  }

  async function runReaction(entryId: number, value: Exclude<ReactionValue, 0>) {
    if (!canReact) return;
    const currentEntry = entryState.find((entry) => entry.id === entryId);
    if (!currentEntry) return;

    const nextValue = currentEntry.myReaction === value ? 0 : value;

    // Optimistic Update
    let newLikes = currentEntry.likes;
    let newDislikes = currentEntry.dislikes;
    if (currentEntry.myReaction === 1) newLikes--;
    if (currentEntry.myReaction === -1) newDislikes--;
    if (nextValue === 1) newLikes++;
    if (nextValue === -1) newDislikes++;
    
    updateEntryReaction(entryId, { likes: newLikes, dislikes: newDislikes, myReaction: nextValue });

    try {
      const response = await fetch(`/api/entries/${entryId}/reaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: nextValue })
      });
      if (!response.ok) throw new Error("API failed");
      const payload = (await response.json()) as { likes: number; dislikes: number; myReaction: ReactionValue };
      // Sync with server if there was a drift
      updateEntryReaction(entryId, payload);
    } catch (e) {
      // Revert on error
      updateEntryReaction(entryId, { likes: currentEntry.likes, dislikes: currentEntry.dislikes, myReaction: currentEntry.myReaction });
    }
  }

  async function addToPersonalWatchlist(entryId: number) {
    if (!canUsePersonalList) return;
    const currentEntry = entryState.find(e => e.id === entryId);
    if (!currentEntry) return;

    // Optimistic Update
    updateEntryWatchlistItem(entryId, { id: -1, status: "planned", currentSeason: 0, currentEpisode: 0, note: "" });

    try {
      const response = await fetch("/api/watchlist-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId })
      });
      if (!response.ok) throw new Error("API failed");
      const payload = (await response.json()) as { item?: NonNullable<CatalogEntry["myWatchlistItem"]> };
      if (payload.item) {
        updateEntryWatchlistItem(entryId, payload.item);
      } else {
        updateEntryWatchlistItem(entryId, null); // Revert if item wasn't returned
      }
    } catch (e) {
      // Revert on error
      updateEntryWatchlistItem(entryId, currentEntry.myWatchlistItem ?? null);
    }
  }

  function PersonalWatchlistButton({ entry }: { entry: CatalogEntry }) {
    if (!canReact) return null;

    if (!canUsePersonalList) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/watchlist-plus"
              className="inline-flex items-center justify-center rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 p-2 text-muted-foreground/50 transition-all hover:border-primary/60 hover:bg-primary/5 hover:text-primary"
              onClick={(e) => e.stopPropagation()}
              aria-label="Потрібен Watchlist Plus"
            >
              <Lock className="size-3.5" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="top">
            <div className="flex flex-col gap-0.5 text-center">
              <span className="font-semibold">Watchlist Plus</span>
              <span className="text-muted-foreground">Натисніть, щоб дізнатись більше</span>
            </div>
          </TooltipContent>
        </Tooltip>
      );
    }

    if (entry.myWatchlistItem) {
      return (
        <Button asChild size="sm" variant="secondary">
          <Link href="/watchlist-plus">У моєму списку</Link>
        </Button>
      );
    }

    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pendingWatchlistEntryId === entry.id}
        onClick={(event) => {
          event.stopPropagation();
          void addToPersonalWatchlist(entry.id);
        }}
      >
        До мого списку
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="grid gap-3 p-4 shadow-none sm:grid-cols-2 lg:grid-cols-[1.2fr_130px_130px_130px_180px_auto]">
        <label className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" data-icon="inline-start" />
          <Input className="pl-10" placeholder="Пошук за назвою" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <Select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="all">Усі типи</option>
          <option value="movie">Фільми</option>
          <option value="series">Серіали</option>
        </Select>
        <Select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">Усі статуси</option>
          <option value="planned">Планую</option>
          <option value="watching">Дивлюсь</option>
          <option value="completed">Завершено</option>
        </Select>
        <Select value={rating} onChange={(event) => setRating(event.target.value)}>
          <option value="all">Будь-яка оцінка</option>
          <option value="5">5/5</option>
          <option value="4">4/5</option>
          <option value="3">3/5</option>
          <option value="2">2/5</option>
          <option value="1">1/5</option>
        </Select>
        <Select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
          <option value="default">За замовчуванням</option>
          <option value="rating-desc">Рейтинг: від високого</option>
          <option value="rating-asc">Рейтинг: від низького</option>
          <option value="year-desc">Рік: спочатку нові</option>
          <option value="year-asc">Рік: спочатку старі</option>
          <option value="title-asc">Назва: А — Я</option>
          <option value="title-desc">Назва: Я — А</option>
          <option value="likes-desc">Популярні (лайки)</option>
        </Select>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2 border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary font-semibold"
            onClick={pickRandomEntry}
            title="Вибрати випадковий фільм або серіал"
          >
            <Dices className={cn("size-4", isSpinning && "animate-spin")} />
            <span className="hidden sm:inline">Що подивитись?</span>
          </Button>
          <Button variant={viewMode === "grid" ? "default" : "outline"} size="icon" onClick={() => setViewMode("grid")} aria-label="Показати квадратами">
            <Grid2X2 data-icon="inline-start" />
          </Button>
          <Button variant={viewMode === "list" ? "default" : "outline"} size="icon" onClick={() => setViewMode("list")} aria-label="Показати рядками">
            <List data-icon="inline-start" />
          </Button>
        </div>
      </Card>

      {filteredEntries.length ? (
        <div className={cn(viewMode === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "flex flex-col gap-3")}>
          {visibleEntries.map((entry) => (
            <article
              key={entry.id}
              className={cn(
                "group overflow-hidden rounded-lg border bg-card text-left shadow-soft transition hover:-translate-y-0.5 hover:border-primary",
                viewMode === "list" && "grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
              )}
            >
              <Link
                href={`/catalog/${entry.id}`}
                className={cn("block w-full text-left", viewMode === "list" && "grid gap-4 md:grid-cols-[96px_1fr] md:items-center")}
              >
                <div
                  className={cn(
                    "flex aspect-[4/5] items-center justify-center rounded-t-lg bg-gradient-to-br from-primary/70 to-accent/70 text-4xl font-black text-white",
                    viewMode === "grid" && "aspect-[2/3]",
                    viewMode === "list" && "aspect-square rounded-md text-2xl"
                  )}
                  style={entry.posterUrl ? { backgroundImage: `linear-gradient(135deg, rgba(99, 102, 241, 0.28), rgba(6, 182, 212, 0.18)), url(${entry.posterUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
                >
                  {!entry.posterUrl ? entry.title.slice(0, 1) : null}
                </div>
                <div className={cn("flex flex-col gap-3 p-4", viewMode === "list" && "p-0")}>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{typeLabels[entry.type as keyof typeof typeLabels] ?? "Фільм"}</Badge>
                    <Badge variant="outline">{statusLabels[entry.status]}</Badge>
                    {entry.isFavorite ? <Badge>Улюблене</Badge> : null}
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold">{entry.title}</h3>
                    <p className="text-sm text-muted-foreground">{entry.year ?? "рік не вказано"} · {entry.genre.join(", ") || "жанр не вказано"}</p>
                  </div>
                  <div className="flex items-center gap-1 text-primary" aria-label={`Оцінка адміністратора ${entry.rating} з 5`}>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star key={index} className={index < entry.rating ? "fill-current" : ""} data-icon="inline-start" />
                    ))}
                  </div>
                </div>
              </Link>
              <div className={cn("flex flex-wrap gap-2 px-4 pb-4", viewMode === "list" && "items-center justify-end p-0")}>
                <ReactionControls
                  entry={entry}
                  canReact={canReact}
                  isPending={pendingReactionId === entry.id}
                  onReact={runReaction}
                />
                <PersonalWatchlistButton entry={entry} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="Записів не знайдено." description="Змініть фільтри або дочекайтесь, поки адміністратор додасть контент." />
      )}

      {hiddenEntriesCount > 0 ? (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
            Показати ще {Math.min(PAGE_SIZE, hiddenEntriesCount)}
          </Button>
        </div>
      ) : null}

      <Dialog
        open={!!randomEntry}
        onOpenChange={(open) => !open && setRandomEntry(null)}
        title="🎲 Що подивитися сьогодні?"
      >
        {randomEntry ? (
          <div className="flex flex-col gap-5 pt-2">
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              {randomEntry.posterUrl && randomEntry.posterUrl.trim() ? (
                <img
                  src={randomEntry.posterUrl}
                  alt={randomEntry.title}
                  className="w-28 sm:w-36 aspect-[2/3] object-cover rounded-lg shadow-md shrink-0 mx-auto sm:mx-0"
                />
              ) : (
                <div className="w-28 sm:w-36 aspect-[2/3] flex items-center justify-center rounded-lg bg-secondary text-2xl font-bold shrink-0 mx-auto sm:mx-0">
                  {randomEntry.title.slice(0, 1)}
                </div>
              )}
              <div className="flex flex-col gap-2.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="default">{typeLabels[randomEntry.type as keyof typeof typeLabels] ?? "Фільм"}</Badge>
                  {randomEntry.year && <Badge variant="outline">{randomEntry.year}</Badge>}
                  <div className="flex items-center gap-1 text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded text-xs font-bold">
                    <Star className="size-3.5 fill-yellow-500" />
                    {randomEntry.rating}/5
                  </div>
                </div>
                <h3 className="text-xl font-black leading-tight">{randomEntry.title}</h3>
                {randomEntry.genre && Array.isArray(randomEntry.genre) && (
                  <p className="text-xs text-muted-foreground">
                    {randomEntry.genre.join(", ")}
                  </p>
                )}
                {randomEntry.comment ? (
                  <p className="text-sm text-foreground/80 line-clamp-3">
                    {randomEntry.comment}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Без додаткового опису.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto gap-2"
                onClick={pickRandomEntry}
                disabled={isSpinning}
              >
                <Dices className={cn("size-4", isSpinning && "animate-spin")} />
                Крутити ще раз
              </Button>
              <Button asChild className="w-full sm:w-auto gap-2">
                <Link href={`/catalog/${randomEntry.id}`}>
                  <Sparkles className="size-4" />
                  Відкрити тайтл
                </Link>
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
