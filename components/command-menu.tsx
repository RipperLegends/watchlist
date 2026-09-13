"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Film, Users, MessageSquare, Settings, Star, Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

type MovieResult = {
  id: number;
  title: string;
  type: "movie" | "series";
  year: number | null;
  rating: number;
  posterUrl: string;
};

export function CommandMenu() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [movies, setMovies] = React.useState<MovieResult[]>([]);
  const [loadingMovies, setLoadingMovies] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Live search for movies
  React.useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setMovies([]);
      setLoadingMovies(false);
      return;
    }

    setLoadingMovies(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      fetch(`/api/entries?q=${encodeURIComponent(trimmed)}&take=6`, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error("Search failed");
          return res.json();
        })
        .then((data: MovieResult[]) => {
          setMovies(Array.isArray(data) ? data : []);
        })
        .catch((err) => {
          if (err.name !== "AbortError") {
            setMovies([]);
          }
        })
        .finally(() => setLoadingMovies(false));
    }, 250);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  const links = [
    { title: "Каталог фільмів", href: "/catalog", icon: Film, keywords: "фільми серіали каталог кіно" },
    { title: "Watchlist Plus", href: "/watchlist-plus", icon: Star, keywords: "плюс преміум статистика" },
    { title: "Мої Друзі", href: "/friends", icon: Users, keywords: "друзі френди соціальне" },
    { title: "Повідомлення", href: "/messages", icon: MessageSquare, keywords: "чати повідомлення меседжи" },
    { title: "Налаштування", href: "/settings", icon: Settings, keywords: "налаштування профіль приватність" },
  ];

  const filteredLinks = query
    ? links.filter((l) =>
        (l.title + " " + l.keywords).toLowerCase().includes(query.toLowerCase())
      )
    : links;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
        title="Швидкий пошук (⌘K)"
      >
        <Search className="size-4" />
        <span>Пошук...</span>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen} title="Глобальний пошук">
        <div className="flex flex-col gap-4">
          <div className="flex items-center rounded-lg border bg-muted/30 px-3 focus-within:ring-2 focus-within:ring-primary/20">
            {loadingMovies ? (
              <Loader2 className="mr-2 size-5 shrink-0 text-primary animate-spin" />
            ) : (
              <Search className="mr-2 size-5 shrink-0 text-muted-foreground" />
            )}
            <input
              placeholder="Шукати фільми, серіали або сторінки..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>

          <div className="max-h-[380px] overflow-y-auto flex flex-col gap-4 pr-1">
            {/* Live Movie Results */}
            {movies.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2">
                  Фільми та серіали ({movies.length})
                </span>
                <div className="flex flex-col gap-1 mt-1">
                  {movies.map((movie) => (
                    <button
                      key={movie.id}
                      onClick={() => runCommand(() => router.push(`/catalog/${movie.id}`))}
                      className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted/80"
                    >
                      <div className="relative size-11 shrink-0 overflow-hidden rounded-md bg-secondary border">
                        {movie.posterUrl && movie.posterUrl.trim() ? (
                          <img
                            src={movie.posterUrl}
                            alt={movie.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <Film className="size-5" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-sm truncate">{movie.title}</span>
                          <span className="text-xs font-bold text-yellow-500 shrink-0">
                            ★ {movie.rating}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                            {movie.type === "movie" ? "Фільм" : "Серіал"}
                          </Badge>
                          {movie.year && <span>{movie.year}</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation Pages */}
            {filteredLinks.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-2">
                  Розділи сайту
                </span>
                <div className="flex flex-col gap-1 mt-1">
                  {filteredLinks.map((link) => (
                    <button
                      key={link.href}
                      onClick={() => runCommand(() => router.push(link.href))}
                      className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/80"
                    >
                      <link.icon className="mr-3 size-4 shrink-0 text-muted-foreground" />
                      <span className="font-medium">{link.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {filteredLinks.length === 0 && movies.length === 0 && !loadingMovies && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                За запитом «{query}» нічого не знайдено.
              </div>
            )}
          </div>
        </div>
      </Dialog>
    </>
  );
}
