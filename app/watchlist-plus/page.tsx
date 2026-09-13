import Link from "next/link";
import { redirect } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveWatchlistPlusAccess } from "@/lib/watchlist-plus";
import { WatchlistPlusClient, type WatchlistPlusItem } from "@/components/watchlist-plus/watchlist-plus-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export default async function WatchlistPlusPage() {
  const sessionUser = await requireUser();
  if (!sessionUser) redirect("/login");

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: Number(sessionUser.id) },
    select: {
      role: true,
      watchlistPlusLifetime: true,
      watchlistPlusUntil: true
    }
  });
  const access = resolveWatchlistPlusAccess(user);

  if (!access.active) {
    return (
      <div className="page-shell flex flex-col gap-8">
        <section className="grid items-center gap-6 lg:grid-cols-[1fr_0.7fr]">
          <div className="flex max-w-3xl flex-col gap-4">
            <Badge className="w-fit" variant="secondary">{access.label}</Badge>
            <h1 className="section-title">Watchlist Plus</h1>
            <p className="section-lead">
              Plus відкриває персональний список поверх загального каталогу: власні статуси, прогрес серіалів, нотатки, чергу перегляду й експорт.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/catalog">Переглянути каталог</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/contact-support">Запитати доступ</Link>
              </Button>
            </div>
          </div>
          <Card>
            <CardHeader>
              <div className="mb-4 flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                <LockKeyhole className="size-6" />
              </div>
              <CardTitle>Доступ видає адміністратор</CardTitle>
              <CardDescription>Адмін може видати Plus на 30 днів або назавжди. У майбутньому це легко прив’язати до оплати.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm text-muted-foreground">
              <p>Глобальний каталог і 5-бальну оцінку все одно редагує тільки адміністратор.</p>
              <p>Користувач із Plus веде лише свій персональний список і прогрес.</p>
            </CardContent>
          </Card>
        </section>
      </div>
    );
  }

  const items = await prisma.userWatchlistItem.findMany({
    where: {
      userId: Number(sessionUser.id),
      entry: { type: { in: ["movie", "series"] } }
    },
    include: {
      entry: {
        select: {
          id: true,
          title: true,
          type: true,
          rating: true,
          year: true,
          genre: true,
          posterUrl: true
        }
      }
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
  });

  const serializedItems: WatchlistPlusItem[] = items.map((item) => ({
    id: item.id,
    status: item.status,
    currentSeason: item.currentSeason,
    currentEpisode: item.currentEpisode,
    note: item.note,
    updatedAt: item.updatedAt.toISOString(),
    entry: {
      id: item.entry.id,
      title: item.entry.title,
      type: item.entry.type === "series" ? "series" : "movie",
      rating: item.entry.rating,
      year: item.entry.year,
      genre: normalizeStringArray(item.entry.genre),
      posterUrl: item.entry.posterUrl
    }
  }));

  return (
    <div className="page-shell">
      <WatchlistPlusClient accessLabel={access.label} items={serializedItems} />
    </div>
  );
}
