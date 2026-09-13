import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

async function createEntry(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  if (!admin) redirect("/catalog");

  const data = parseEntryFormData(formData);
  if (!data) return;

  await prisma.entry.create({
    data: {
      userId: Number(admin.id),
      ...data,
      year: data.year ?? null
    }
  });

  revalidatePath("/catalog");
  revalidatePath("/");
  redirect("/catalog");
}

export default async function NewCatalogEntryPage() {
  const user = await requireUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/catalog");

  return (
    <div className="page-shell">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Додати фільм або серіал</CardTitle>
          <CardDescription>Додавати записи й задавати 5-бальну оцінку може тільки адміністратор.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createEntry} className="flex flex-col gap-4">
            <TmdbSearch />
            <Input name="title" placeholder="Назва" required />
            <div className="grid gap-4 md:grid-cols-3">
              <Select name="type" defaultValue="movie">
                <option value="movie">Фільм</option>
                <option value="series">Серіал</option>
              </Select>
              <Select name="status" defaultValue="planned">
                <option value="planned">Планую</option>
                <option value="watching">Дивлюсь</option>
                <option value="completed">Завершено</option>
              </Select>
              <Select name="rating" defaultValue="0">
                <option value="0">Без оцінки</option>
                <option value="1">1/5</option>
                <option value="2">2/5</option>
                <option value="3">3/5</option>
                <option value="4">4/5</option>
                <option value="5">5/5</option>
              </Select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Input name="year" placeholder="Рік" type="number" min="1888" max="2100" />
              <Input name="posterUrl" placeholder="URL постера" />
            </div>
            <Input name="genre" placeholder="Жанри через кому" />
            <Input name="tags" placeholder="Теги через кому" />
            <Textarea name="comment" placeholder="Коментар до фільму або серіалу" />
            <div className="flex gap-3">
              <Button type="submit">Зберегти</Button>
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
