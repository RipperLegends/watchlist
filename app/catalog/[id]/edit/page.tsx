import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { requireAdmin, requireUser } from "@/lib/auth";
import { parseEntryFormData } from "@/lib/entry-form";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TmdbSearch } from "@/components/catalog/tmdb-search";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

const normalizeStringArray = (value: unknown) => {
  if (!Array.isArray(value)) return "";
  return value.filter((item): item is string => typeof item === "string").join(", ");
};

async function updateEntry(entryId: number, formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  if (!admin) redirect("/catalog");

  const data = parseEntryFormData(formData);
  if (!data) return;

  const existingEntry = await prisma.entry.findFirst({
    where: { id: entryId },
    select: { id: true }
  });
  if (!existingEntry) notFound();

  await prisma.entry.update({
    where: { id: entryId },
    data: {
      ...data,
      year: data.year ?? null
    }
  });

  revalidatePath("/catalog");
  revalidatePath(`/catalog/${entryId}`);
  revalidatePath("/");
  redirect("/catalog");
}

export default async function EditCatalogEntryPage({ params }: PageProps) {
  const user = await requireUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/catalog");

  const { id } = await params;
  const entryId = Number(id);
  if (!Number.isInteger(entryId) || entryId <= 0) notFound();

  const entry = await prisma.entry.findFirst({
    where: { id: entryId }
  });
  if (!entry) notFound();

  const updateCurrentEntry = updateEntry.bind(null, entry.id);

  return (
    <div className="page-shell">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Редагувати запис</CardTitle>
          <CardDescription>Оновіть дані, постер, статус, прогрес і коментар до контенту.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateCurrentEntry} className="flex flex-col gap-4">
            <TmdbSearch />
            <Input name="title" placeholder="Назва" defaultValue={entry.title} required />
            <div className="grid gap-4 md:grid-cols-3">
              <Select name="type" defaultValue={entry.type}>
                <option value="movie">Фільм</option>
                <option value="series">Серіал</option>
              </Select>
              <Select name="status" defaultValue={entry.status}>
                <option value="planned">Планую</option>
                <option value="watching">Дивлюсь</option>
                <option value="completed">Завершено</option>
              </Select>
              <Select name="rating" defaultValue={String(entry.rating)}>
                <option value="0">Без оцінки</option>
                <option value="1">1/5</option>
                <option value="2">2/5</option>
                <option value="3">3/5</option>
                <option value="4">4/5</option>
                <option value="5">5/5</option>
              </Select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Input name="year" placeholder="Рік" type="number" min="1888" max="2100" defaultValue={entry.year ?? ""} />
              <Input name="posterUrl" placeholder="URL постера" defaultValue={entry.posterUrl} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Input name="currentSeason" placeholder="Сезон" type="number" min="0" defaultValue={entry.currentSeason} />
              <Input name="currentEpisode" placeholder="Епізод" type="number" min="0" defaultValue={entry.currentEpisode} />
            </div>
            <Input name="genre" placeholder="Жанри через кому" defaultValue={normalizeStringArray(entry.genre)} />
            <Input name="tags" placeholder="Теги через кому" defaultValue={normalizeStringArray(entry.tags)} />
            <Input name="mood" placeholder="Настрій або коротка мітка" defaultValue={entry.mood} />
            <label className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2 text-sm font-semibold">
              <input name="isFavorite" type="checkbox" defaultChecked={entry.isFavorite} className="size-4 accent-primary" />
              Додати в улюблене
            </label>
            <Textarea name="comment" placeholder="Коментар до фільму або серіалу" defaultValue={entry.comment} />
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="submit">Зберегти зміни</Button>
              <Button asChild variant="secondary">
                <Link href="/catalog">Скасувати</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
