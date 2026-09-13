"use client";

import * as React from "react";
import Link from "next/link";
import { Download, Grid2X2, List, Save, Star, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type PlusItemStatus = "planned" | "watching" | "completed";

export type WatchlistPlusItem = {
  id: number;
  status: PlusItemStatus;
  currentSeason: number;
  currentEpisode: number;
  note: string;
  updatedAt: string;
  entry: {
    id: number;
    title: string;
    type: "movie" | "series";
    rating: number;
    year: number | null;
    genre: string[];
    posterUrl: string;
  };
};

const statusLabels: Record<PlusItemStatus, string> = {
  planned: "Планую",
  watching: "Дивлюсь",
  completed: "Завершено"
};

const typeLabels = {
  movie: "Фільм",
  series: "Серіал"
};

const PAGE_SIZE = 24;

function downloadFile(fileName: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function WatchlistPlusClient({
  accessLabel,
  items
}: {
  accessLabel: string;
  items: WatchlistPlusItem[];
}) {
  const [itemState, setItemState] = React.useState(items);
  const [pendingId, setPendingId] = React.useState<number | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sortBy, setSortBy] = React.useState("updated-desc");
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("grid");
  const [activeTab, setActiveTab] = React.useState("all");
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
  const [editingItem, setEditingItem] = React.useState<WatchlistPlusItem | null>(null);

  React.useEffect(() => {
    setItemState(items);
  }, [items]);

  const metrics = React.useMemo(() => {
    const total = itemState.length;
    const planned = itemState.filter((item) => item.status === "planned").length;
    const watching = itemState.filter((item) => item.status === "watching").length;
    const completed = itemState.filter((item) => item.status === "completed").length;
    const avgRating = total ? (itemState.reduce((sum, item) => sum + item.entry.rating, 0) / total).toFixed(1) : "0.0";
    const genres = itemState.flatMap((item) => item.entry.genre || []);
    const genreCounts = genres.reduce<Record<string, number>>((acc, genre) => {
      acc[genre] = (acc[genre] || 0) + 1;
      return acc;
    }, {});
    const topGenres = Object.entries(genreCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([genre]) => genre);

    return { total, planned, watching, completed, avgRating, topGenres };
  }, [itemState]);

  const queue = React.useMemo(
    () =>
      itemState
        .filter((item) => item.status === "planned")
        .sort((a, b) => b.entry.rating - a.entry.rating)
        .slice(0, 5),
    [itemState]
  );

  const staleSeries = React.useMemo(
    () =>
      itemState
        .filter((item) => item.status === "watching" && item.entry.type === "series")
        .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
        .slice(0, 4),
    [itemState]
  );

  function patchItem(id: number, patch: Partial<WatchlistPlusItem>) {
    setItemState((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function saveItem(item: WatchlistPlusItem) {
    setPendingId(item.id);
    try {
      const response = await fetch(`/api/watchlist-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: item.status,
          currentSeason: item.currentSeason,
          currentEpisode: item.currentEpisode,
          note: item.note
        })
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { item?: { updatedAt?: string } };
      if (payload.item?.updatedAt) patchItem(item.id, { updatedAt: payload.item.updatedAt });
    } finally {
      setPendingId(null);
    }
  }

  async function removeItem(id: number) {
    setPendingId(id);
    try {
      const response = await fetch(`/api/watchlist-items/${id}`, { method: "DELETE" });
      if (!response.ok) return;
      setItemState((current) => current.filter((item) => item.id !== id));
    } finally {
      setPendingId(null);
    }
  }

  function exportJson() {
    downloadFile("watchlist-plus.json", JSON.stringify(itemState, null, 2), "application/json;charset=utf-8");
  }

  function exportCsv() {
    const rows = [
      ["Назва", "Тип", "Статус", "Оцінка адміна", "Рік", "Сезон", "Епізод", "Нотатка"],
      ...itemState.map((item) => [
        item.entry.title,
        typeLabels[item.entry.type],
        statusLabels[item.status],
        `${item.entry.rating}/5`,
        item.entry.year ?? "",
        item.currentSeason,
        item.currentEpisode,
        item.note.replace(/\n/g, " ")
      ])
    ];
    downloadFile("watchlist-plus.csv", rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n"), "text/csv;charset=utf-8");
  }

  const filteredItems = React.useMemo(() => {
    if (!searchQuery.trim()) return itemState;
    const query = searchQuery.toLowerCase();
    return itemState.filter((item) => item.entry.title.toLowerCase().includes(query) || item.note.toLowerCase().includes(query));
  }, [itemState, searchQuery]);

  const currentTabItems = React.useMemo(() => {
    const list = activeTab === "all" ? filteredItems : filteredItems.filter((i) => i.status === activeTab);
    switch (sortBy) {
      case "updated-desc":
        return [...list].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      case "rating-desc":
        return [...list].sort((a, b) => b.entry.rating - a.entry.rating);
      case "title-asc":
        return [...list].sort((a, b) => a.entry.title.localeCompare(b.entry.title, "uk-UA"));
      case "year-desc":
        return [...list].sort((a, b) => (b.entry.year ?? 0) - (a.entry.year ?? 0));
      case "progress-desc":
        return [...list].sort((a, b) => (b.currentSeason * 100 + b.currentEpisode) - (a.currentSeason * 100 + a.currentEpisode));
      default:
        return list;
    }
  }, [activeTab, filteredItems, sortBy]);

  const visibleItems = React.useMemo(() => {
    return currentTabItems.slice(0, visibleCount);
  }, [currentTabItems, visibleCount]);

  const hiddenCount = currentTabItems.length - visibleCount;

  const renderGridItem = (item: WatchlistPlusItem) => (
    <div
      key={item.id}
      onClick={() => setEditingItem(item)}
      className="group relative flex flex-col overflow-hidden rounded-xl border bg-card text-left shadow-sm transition hover:-translate-y-1 hover:border-primary hover:shadow-md cursor-pointer"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-secondary">
        {item.entry.posterUrl && item.entry.posterUrl.trim() ? (
          <img
            src={item.entry.posterUrl}
            alt={item.entry.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-black text-3xl text-muted-foreground">
            {item.entry.title.slice(0, 1)}
          </div>
        )}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          <Badge variant="secondary" className="text-[10px] uppercase font-bold backdrop-blur-md bg-background/80">
            {typeLabels[item.entry.type]}
          </Badge>
        </div>
        <div className="absolute top-2 right-2 flex items-center gap-0.5 rounded-md bg-black/70 px-1.5 py-0.5 text-xs font-bold text-yellow-400 backdrop-blur-md">
          <Star className="size-3 fill-yellow-400" />
          {item.entry.rating}
        </div>
        {item.entry.type === "series" && (item.currentSeason > 0 || item.currentEpisode > 0) && (
          <div className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-md">
            С{item.currentSeason} • Е{item.currentEpisode}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5 p-3 flex-1 justify-between">
        <p className="line-clamp-1 text-sm font-bold group-hover:text-primary transition-colors">
          {item.entry.title}
        </p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{item.entry.year ?? "—"}</span>
          <Badge
            variant={
              item.status === "completed"
                ? "default"
                : item.status === "watching"
                ? "secondary"
                : "outline"
            }
            className="text-[10px] px-1.5 py-0"
          >
            {statusLabels[item.status]}
          </Badge>
        </div>
      </div>
    </div>
  );

  const renderListItem = (item: WatchlistPlusItem) => (
    <Card key={item.id}>
      <CardContent className="grid gap-5 p-5 lg:grid-cols-[120px_1fr]">
        <div
          className="flex aspect-[2/3] w-full max-w-[120px] items-center justify-center rounded-md bg-gradient-to-br from-primary/70 to-accent/70 text-3xl font-black text-white"
          style={item.entry.posterUrl && item.entry.posterUrl.trim() ? { backgroundImage: `url(${item.entry.posterUrl})`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}
        >
          {!(item.entry.posterUrl && item.entry.posterUrl.trim()) ? item.entry.title.slice(0, 1) : null}
        </div>
        <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-black">{item.entry.title}</h3>
              <Badge>{item.entry.rating}/5</Badge>
              <Badge variant="secondary">{typeLabels[item.entry.type]}</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-2 text-sm font-semibold">
                Статус
                <Select value={item.status} onChange={(event) => patchItem(item.id, { status: event.target.value as PlusItemStatus })}>
                  <option value="planned">Планую</option>
                  <option value="watching">Дивлюсь</option>
                  <option value="completed">Завершено</option>
                </Select>
              </label>
              {item.entry.type === "series" && (
                <>
                  <label className="flex flex-col gap-2 text-sm font-semibold">
                    Сезон
                    <Input type="number" min="0" value={item.currentSeason} onChange={(event) => patchItem(item.id, { currentSeason: Number(event.target.value) || 0 })} />
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-semibold">
                    Епізод
                    <Input type="number" min="0" value={item.currentEpisode} onChange={(event) => patchItem(item.id, { currentEpisode: Number(event.target.value) || 0 })} />
                  </label>
                </>
              )}
            </div>
            <label className="flex flex-col gap-2 text-sm font-semibold">
              Особиста нотатка
              <Textarea value={item.note} onChange={(event) => patchItem(item.id, { note: event.target.value })} placeholder="Наприклад: дивитися ввечері або зупинився на конкретному моменті" />
            </label>
          </div>
          <div className="flex flex-col justify-end gap-2">
            <Button disabled={pendingId === item.id} onClick={() => void saveItem(item)}>
              <Save className="size-4" />
              Зберегти
            </Button>
            <Button disabled={pendingId === item.id} variant="destructive" onClick={() => void removeItem(item.id)}>
              <Trash2 className="size-4" />
              Прибрати зі списку
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex max-w-3xl flex-col gap-3">
          <Badge className="w-fit" variant="secondary">{accessLabel}</Badge>
          <h1 className="section-title">Watchlist Plus</h1>
          <p className="section-lead">
            Персональний шар поверх загального каталогу: ваш список, прогрес серіалів, нотатки, черга перегляду й експорт.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportCsv} disabled={!itemState.length}>
            <Download className="size-4" />
            CSV
          </Button>
          <Button variant="secondary" onClick={exportJson} disabled={!itemState.length}>
            <Download className="size-4" />
            JSON
          </Button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          ["У моєму списку", metrics.total],
          ["Планую", metrics.planned],
          ["Дивлюсь", metrics.watching],
          ["Завершено", metrics.completed],
          ["Середня оцінка", `${metrics.avgRating}/5`]
        ].map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle className="text-3xl text-primary">{value}</CardTitle>
              <CardDescription>{label}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Черга перегляду</CardTitle>
            <CardDescription>Планові записи з найвищою адмінською оцінкою.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {queue.length ? queue.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div>
                  <p className="font-bold">{item.entry.title}</p>
                  <p className="text-sm text-muted-foreground">{typeLabels[item.entry.type]} · {item.entry.year ?? "рік не вказано"}</p>
                </div>
                <Badge>{item.entry.rating}/5</Badge>
              </div>
            )) : <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Додайте записи в мій список із каталогу.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Аналітика смаку</CardTitle>
            <CardDescription>Жанри й серіали, які варто не загубити.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-sm font-semibold text-muted-foreground">Топ жанри</p>
              <div className="flex flex-wrap gap-2">
                {metrics.topGenres.length ? metrics.topGenres.map((genre) => <Badge key={genre} variant="secondary">{genre}</Badge>) : <Badge variant="outline">жанри ще не зібрані</Badge>}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-muted-foreground">Давно не продовжували</p>
              <div className="flex flex-col gap-2">
                {staleSeries.length ? staleSeries.map((item) => (
                  <div key={item.id} className="rounded-md border p-3 text-sm">
                    <b>{item.entry.title}</b> · сезон {item.currentSeason || 0}, епізод {item.currentEpisode || 0}
                  </div>
                )) : <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Немає серіалів у процесі.</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-black">Мій список</h2>
            <p className="text-muted-foreground">Тут редагується персональний статус, прогрес і нотатки.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input 
              className="w-full sm:w-56" 
              placeholder="Пошук у списку..." 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
            />
            <Select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              className="w-full sm:w-48"
            >
              <option value="updated-desc">Нещодавно оновлені</option>
              <option value="rating-desc">Рейтинг: від високого</option>
              <option value="title-asc">Назва: А — Я</option>
              <option value="year-desc">Рік: новіші</option>
              <option value="progress-desc">За прогресом (сезон/серія)</option>
            </Select>
            <div className="flex gap-1 shrink-0">
              <Button
                type="button"
                variant={viewMode === "grid" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("grid")}
                aria-label="Показати сіткою"
                title="Компактна сітка постерів (як у Netflix)"
              >
                <Grid2X2 className="size-4" />
              </Button>
              <Button
                type="button"
                variant={viewMode === "list" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("list")}
                aria-label="Показати списком"
                title="Розгорнутий список з формами"
              >
                <List className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        {itemState.length ? (
          <Tabs
            value={activeTab}
            onValueChange={(val) => {
              setActiveTab(val);
              setVisibleCount(PAGE_SIZE);
            }}
            className="flex flex-col gap-6"
          >
            <TabsList className="h-auto w-full flex-wrap justify-start bg-transparent p-0">
              <TabsTrigger value="all" className="data-[state=active]:bg-muted data-[state=active]:shadow-none">
                Усі ({filteredItems.length})
              </TabsTrigger>
              <TabsTrigger value="planned" className="data-[state=active]:bg-muted data-[state=active]:shadow-none">
                Планую ({filteredItems.filter((i) => i.status === "planned").length})
              </TabsTrigger>
              <TabsTrigger value="watching" className="data-[state=active]:bg-muted data-[state=active]:shadow-none">
                Дивлюсь ({filteredItems.filter((i) => i.status === "watching").length})
              </TabsTrigger>
              <TabsTrigger value="completed" className="data-[state=active]:bg-muted data-[state=active]:shadow-none">
                Завершено ({filteredItems.filter((i) => i.status === "completed").length})
              </TabsTrigger>
            </TabsList>

            <div className="mt-0">
              {currentTabItems.length ? (
                <>
                  {viewMode === "grid" ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {visibleItems.map(renderGridItem)}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {visibleItems.map(renderListItem)}
                    </div>
                  )}

                  {hiddenCount > 0 && (
                    <div className="flex flex-col items-center gap-2 pt-6">
                      <Button
                        variant="secondary"
                        onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                      >
                        Показати ще {Math.min(PAGE_SIZE, hiddenCount)}
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Показано {visibleItems.length} з {currentTabItems.length} тайтлів
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Тайтлів у цій категорії не знайдено.</p>
              )}
            </div>
          </Tabs>
        ) : (
          <Card>
            <CardContent className="flex flex-col gap-4 p-6">
              <p className="text-muted-foreground">Ваш персональний список поки порожній.</p>
              <Button asChild className="w-fit">
                <Link href="/catalog">Перейти в каталог</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Quick Edit Dialog for Grid Items */}
      <Dialog
        open={!!editingItem}
        onOpenChange={(open) => !open && setEditingItem(null)}
        title={editingItem?.entry.title ?? "Редагування тайтлу"}
      >
        {editingItem ? (
          <div className="flex flex-col gap-4 pt-2">
            <div className="flex gap-4 items-start">
              {editingItem.entry.posterUrl && editingItem.entry.posterUrl.trim() ? (
                <img
                  src={editingItem.entry.posterUrl}
                  alt={editingItem.entry.title}
                  className="w-24 aspect-[2/3] object-cover rounded-lg shadow shrink-0"
                />
              ) : (
                <div className="w-24 aspect-[2/3] flex items-center justify-center rounded-lg bg-secondary text-2xl font-bold shrink-0">
                  {editingItem.entry.title.slice(0, 1)}
                </div>
              )}
              <div className="flex flex-col gap-2 flex-1">
                <div className="flex flex-wrap gap-2 items-center">
                  <Badge variant="default">{typeLabels[editingItem.entry.type]}</Badge>
                  {editingItem.entry.year && <Badge variant="outline">{editingItem.entry.year}</Badge>}
                  <div className="flex items-center gap-1 text-yellow-500 font-bold text-xs bg-yellow-500/10 px-2 py-0.5 rounded">
                    ★ {editingItem.entry.rating}/5
                  </div>
                </div>
                <h3 className="text-lg font-black">{editingItem.entry.title}</h3>
                <Button asChild variant="ghost" className="p-0 h-auto w-fit text-xs text-primary hover:bg-transparent hover:underline">
                  <Link href={`/catalog/${editingItem.entry.id}`}>
                    Відкрити повну сторінку в каталозі →
                  </Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 pt-2 border-t">
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Статус
                <Select
                  value={editingItem.status}
                  onChange={(e) => {
                    const status = e.target.value as PlusItemStatus;
                    patchItem(editingItem.id, { status });
                    setEditingItem((prev) => (prev ? { ...prev, status } : null));
                  }}
                >
                  <option value="planned">Планую</option>
                  <option value="watching">Дивлюсь</option>
                  <option value="completed">Завершено</option>
                </Select>
              </label>

              {editingItem.entry.type === "series" && (
                <>
                  <label className="flex flex-col gap-1 text-xs font-semibold">
                    Сезон
                    <Input
                      type="number"
                      min="0"
                      value={editingItem.currentSeason}
                      onChange={(e) => {
                        const currentSeason = Number(e.target.value) || 0;
                        patchItem(editingItem.id, { currentSeason });
                        setEditingItem((prev) => (prev ? { ...prev, currentSeason } : null));
                      }}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold">
                    Епізод
                    <Input
                      type="number"
                      min="0"
                      value={editingItem.currentEpisode}
                      onChange={(e) => {
                        const currentEpisode = Number(e.target.value) || 0;
                        patchItem(editingItem.id, { currentEpisode });
                        setEditingItem((prev) => (prev ? { ...prev, currentEpisode } : null));
                      }}
                    />
                  </label>
                </>
              )}
            </div>

            <label className="flex flex-col gap-1 text-xs font-semibold">
              Особиста нотатка
              <Textarea
                rows={3}
                value={editingItem.note}
                onChange={(e) => {
                  const note = e.target.value;
                  patchItem(editingItem.id, { note });
                  setEditingItem((prev) => (prev ? { ...prev, note } : null));
                }}
                placeholder="Нотатка для себе..."
              />
            </label>

            <div className="flex items-center justify-between gap-2 pt-3 border-t">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={pendingId === editingItem.id}
                onClick={async () => {
                  const id = editingItem.id;
                  setEditingItem(null);
                  await removeItem(id);
                }}
              >
                <Trash2 className="size-4 mr-1.5" />
                Прибрати
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={pendingId === editingItem.id}
                onClick={async () => {
                  await saveItem(editingItem);
                  setEditingItem(null);
                }}
              >
                <Save className="size-4 mr-1.5" />
                Зберегти
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
