import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const dynamic = "force-dynamic";

async function createEntry(formData: FormData) {
  "use server";
  const user = await requireUser();
  if (!user) redirect("/login");

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  await prisma.entry.create({
    data: {
      userId: Number(user.id),
      title,
      type: String(formData.get("type") ?? "movie") as "movie" | "series" | "game",
      status: String(formData.get("status") ?? "planned") as "planned" | "watching" | "completed",
      rating: Number(formData.get("rating") ?? 0),
      year: formData.get("year") ? Number(formData.get("year")) : null,
      genre: String(formData.get("genre") ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      tags: String(formData.get("tags") ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      posterUrl: String(formData.get("posterUrl") ?? ""),
      comment: String(formData.get("comment") ?? "")
    }
  });

  redirect("/catalog");
}

export default async function NewCatalogEntryPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  return (
    <div className="page-shell">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Додати запис</CardTitle>
          <CardDescription>5-бальна оцінка збережена як основний стандарт сайту.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createEntry} className="flex flex-col gap-4">
            <Input name="title" placeholder="Назва" required />
            <div className="grid gap-4 md:grid-cols-3">
              <Select name="type" defaultValue="movie">
                <option value="movie">Фільм</option>
                <option value="series">Серіал</option>
                <option value="game">Гра</option>
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
