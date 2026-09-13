import Link from "next/link";
import { Plus, Search } from "lucide-react";
import type { EntryStatus } from "@prisma/client";
import { deleteEntry } from "@/app/admin/actions";
import { getAdminEntries } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

type AdminCatalogSearchParams = {
  q?: string;
  type?: string;
  status?: string;
  rating?: string;
  sort?: string;
  page?: string;
};

type AdminCatalogPageProps = {
  searchParams?: Promise<AdminCatalogSearchParams>;
};

const entryTypeLabels = {
  movie: "Фільм",
  series: "Серіал"
} as const;

const entryStatusLabels = {
  planned: "Планую",
  watching: "Дивлюсь",
  completed: "Завершено"
} as const;

function normalizeType(value?: string): "all" | "movie" | "series" {
  return value === "movie" || value === "series" ? value : "all";
}

function normalizeStatus(value?: string): "all" | EntryStatus {
  return value === "planned" || value === "watching" || value === "completed" ? value : "all";
}

function normalizeRating(value?: string): "all" | number {
  const rating = Number(value);
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : "all";
}

function normalizeSort(value?: string): "catalog" | "newest" | "rating_desc" | "rating_asc" {
  return value === "newest" || value === "rating_desc" || value === "rating_asc" ? value : "catalog";
}

function normalizePage(value?: string) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function catalogUrl(filters: {
  q?: string;
  type?: string;
  status?: string;
  rating?: string | number;
  sort?: string;
  page?: string | number;
}) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.type && filters.type !== "all") params.set("type", filters.type);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.rating && filters.rating !== "all") params.set("rating", String(filters.rating));
  if (filters.sort && filters.sort !== "catalog") params.set("sort", filters.sort);
  if (filters.page && Number(filters.page) > 1) params.set("page", String(filters.page));
  const query = params.toString();
  return `/admin/catalog${query ? `?${query}` : ""}`;
}

export default async function AdminCatalogPage({ searchParams }: AdminCatalogPageProps) {
  const params = searchParams ? await searchParams : {};
  const q = String(params.q ?? "").trim().slice(0, 100);
  const type = normalizeType(params.type);
  const status = normalizeStatus(params.status);
  const rating = normalizeRating(params.rating);
  const sort = normalizeSort(params.sort);
  const page = normalizePage(params.page);

  const entryList = await getAdminEntries({
    query: q,
    type,
    status,
    rating,
    sort,
    page,
    pageSize: 25
  });

  const currentUrl = catalogUrl({ q, type, status, rating, sort, page: entryList.page });
  const hasFilters = Boolean(q || type !== "all" || status !== "all" || rating !== "all" || sort !== "catalog");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-3">
          <Badge className="w-fit" variant="secondary">Content Manager</Badge>
          <h1 className="section-title">Каталог</h1>
          <p className="section-lead">Модеруйте фільми й серіали без нескінченного списку на всю сторінку.</p>
        </div>
        <Button asChild>
          <Link href="/catalog/new">
            <Plus className="size-4" />
            Додати запис
          </Link>
        </Button>
      </header>

      <Card>
        <CardContent className="p-4">
          <form action="/admin/catalog" className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-10" name="q" defaultValue={q} placeholder="Назва або коментар" />
            </label>
            <Select name="type" defaultValue={type}>
              <option value="all">Усі типи</option>
              <option value="movie">Фільми</option>
              <option value="series">Серіали</option>
            </Select>
            <Select name="status" defaultValue={status}>
              <option value="all">Усі статуси</option>
              <option value="planned">Планую</option>
              <option value="watching">Дивлюсь</option>
              <option value="completed">Завершено</option>
            </Select>
            <Select name="rating" defaultValue={String(rating)}>
              <option value="all">Усі оцінки</option>
              <option value="5">5/5</option>
              <option value="4">4/5</option>
              <option value="3">3/5</option>
              <option value="2">2/5</option>
              <option value="1">1/5</option>
            </Select>
            <Select name="sort" defaultValue={sort}>
              <option value="catalog">Порядок каталогу</option>
              <option value="newest">Новіші</option>
              <option value="rating_desc">Оцінка ↓</option>
              <option value="rating_asc">Оцінка ↑</option>
            </Select>
            <div className="grid min-w-0 grid-cols-2 gap-3 md:col-span-2 xl:col-span-5">
              <Button className="min-w-0 whitespace-nowrap" type="submit">Застосувати</Button>
              <Button asChild className="min-w-0 whitespace-nowrap" variant="secondary">
                <Link href="/admin/catalog">Скинути</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Записи каталогу</CardTitle>
              <CardDescription>
                Показано {entryList.showingFrom}-{entryList.showingTo} з {entryList.total} записів · сторінка {entryList.page} з {entryList.totalPages}
              </CardDescription>
            </div>
            {hasFilters ? <Badge variant="outline">Фільтр активний</Badge> : <Badge variant="secondary">Весь каталог</Badge>}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Постер</TableHead>
                <TableHead>Назва</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Оцінка</TableHead>
                <TableHead>Власник</TableHead>
                <TableHead>Дії</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entryList.entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <div
                      className="flex size-12 items-center justify-center rounded-md bg-gradient-to-br from-primary to-accent text-sm font-black text-white"
                      style={entry.posterUrl ? { backgroundImage: `url(${entry.posterUrl})`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}
                    >
                      {!entry.posterUrl ? entry.title.slice(0, 1) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="min-w-64">
                      <p className="font-bold">{entry.title}</p>
                      <p className="text-sm text-muted-foreground">{entry.year ?? "рік не вказано"}</p>
                    </div>
                  </TableCell>
                  <TableCell>{entryTypeLabels[entry.type as keyof typeof entryTypeLabels] ?? entry.type}</TableCell>
                  <TableCell><Badge variant="secondary">{entryStatusLabels[entry.status]}</Badge></TableCell>
                  <TableCell>{entry.rating}/5</TableCell>
                  <TableCell>{entry.user.name}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/catalog/${entry.id}/edit`}>Редагувати</Link>
                      </Button>
                      <form action={deleteEntry}>
                        <input type="hidden" name="id" value={entry.id} />
                        <input type="hidden" name="returnTo" value={currentUrl} />
                        <Button size="sm" variant="destructive" type="submit">Видалити</Button>
                      </form>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!entryList.entries.length ? <p className="p-6 text-sm text-muted-foreground">За цими фільтрами записів немає.</p> : null}
        </CardContent>
        <div className="flex flex-col gap-3 border-t p-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-muted-foreground">
            На сторінці {entryList.entries.length} записів. Усього в результаті: {entryList.total}.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              asChild
              size="sm"
              variant="secondary"
              aria-disabled={entryList.page <= 1}
              className={entryList.page <= 1 ? "pointer-events-none opacity-50" : ""}
            >
              <Link href={catalogUrl({ q, type, status, rating, sort, page: entryList.page - 1 })}>Назад</Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="secondary"
              aria-disabled={entryList.page >= entryList.totalPages}
              className={entryList.page >= entryList.totalPages ? "pointer-events-none opacity-50" : ""}
            >
              <Link href={catalogUrl({ q, type, status, rating, sort, page: entryList.page + 1 })}>Далі</Link>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
