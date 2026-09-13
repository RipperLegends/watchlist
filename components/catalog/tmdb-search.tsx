"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type TmdbSearchItem = {
  id: number;
  mediaType: "movie" | "series";
  title: string;
  originalTitle: string;
  year: number | null;
  overview: string;
  posterUrl: string;
  genres: string[];
  voteAverage: number;
};

function setFormValue(name: string, value: string) {
  const field = document.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[name="${name}"]`);
  if (!field) return;

  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
}

function applyTmdbItem(item: TmdbSearchItem) {
  setFormValue("title", item.title);
  setFormValue("type", item.mediaType);
  setFormValue("year", item.year ? String(item.year) : "");
  setFormValue("posterUrl", item.posterUrl);
  setFormValue("genre", item.genres.join(", "));
  setFormValue("comment", item.overview);
}

export function TmdbSearch() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<"movie" | "series">("movie");
  const [results, setResults] = useState<TmdbSearchItem[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "empty">("idle");

  async function search() {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setResults([]);
      setStatus("empty");
      return;
    }

    setStatus("loading");

    const response = await fetch(`/api/tmdb/search?q=${encodeURIComponent(trimmedQuery)}&type=${type}`);
    if (!response.ok) {
      setResults([]);
      setStatus("error");
      return;
    }

    const data = (await response.json()) as TmdbSearchItem[];
    setResults(data);
    setStatus(data.length ? "idle" : "empty");
  }

  return (
    <div className="rounded-lg border bg-muted/35 p-4">
      <div className="mb-3 flex flex-col gap-2">
        <p className="text-sm font-semibold text-foreground">Пошук у TMDb</p>
        <p className="text-sm text-muted-foreground">Знайдіть фільм або серіал і заповніть поля одним кліком.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_150px_auto]">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              search();
            }
          }}
          placeholder="Наприклад, Breaking Bad"
        />
        <Select value={type} onChange={(event) => setType(event.target.value as "movie" | "series")}>
          <option value="movie">Фільм</option>
          <option value="series">Серіал</option>
        </Select>
        <Button type="button" onClick={search} disabled={status === "loading"}>
          <Search className="size-4" />
          {status === "loading" ? "Шукаю" : "Знайти"}
        </Button>
      </div>

      {status === "error" ? <p className="mt-3 text-sm text-destructive">TMDb зараз не відповідає. Спробуйте ще раз.</p> : null}
      {status === "empty" ? <p className="mt-3 text-sm text-muted-foreground">Нічого не знайдено.</p> : null}

      {results.length ? (
        <div className="mt-4 grid gap-3">
          {results.map((item) => (
            <div key={`${item.mediaType}-${item.id}`} className="grid gap-3 rounded-md border bg-background p-3 sm:grid-cols-[72px_1fr_auto]">
              <div
                className="flex aspect-[2/3] w-[72px] items-center justify-center rounded-md bg-secondary text-lg font-bold text-secondary-foreground"
                style={item.posterUrl ? { backgroundImage: `url(${item.posterUrl})`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}
              >
                {!item.posterUrl ? item.title.slice(0, 1) : null}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-foreground">{item.title}</p>
                  {item.year ? <Badge variant="secondary">{item.year}</Badge> : null}
                  <Badge>{item.mediaType === "series" ? "Серіал" : "Фільм"}</Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.overview || item.originalTitle || "Опису поки немає."}</p>
                {item.genres.length ? <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-primary">{item.genres.join(" / ")}</p> : null}
              </div>
              <Button type="button" variant="secondary" onClick={() => applyTmdbItem(item)}>
                Використати
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
