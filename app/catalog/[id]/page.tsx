import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Clock, Edit, Film, Star, User as UserIcon } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShareButton } from "@/components/catalog/share-button";
import { SendToFriendDialog } from "@/components/catalog/send-to-friend-dialog";

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export default async function EntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entryId = parseInt(id, 10);
  if (isNaN(entryId)) notFound();

  const sessionUser = await requireUser();
  const isAdmin = sessionUser?.role === "admin";
  
  const [entry, similarEntries] = await Promise.all([
    prisma.entry.findUnique({
      where: { id: entryId },
      include: {
        user: {
          select: { name: true }
        }
      }
    }),
    prisma.entry.findMany({
      where: {
        id: { not: entryId }
      },
      take: 4,
      orderBy: { rating: "desc" }
    })
  ]);

  if (!entry) notFound();

  const genres = normalizeStringArray(entry.genre);
  const typeLabel = entry.type === "movie" ? "Фільм" : "Серіал";

  return (
    <div className="page-shell flex flex-col gap-8 max-w-6xl mx-auto">
      <div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <Button variant="ghost" asChild className="-ml-4 text-muted-foreground w-fit">
            <Link href="/catalog">
              <ArrowLeft className="mr-2 size-4" />
              Назад до каталогу
            </Link>
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            {sessionUser && (
              <SendToFriendDialog
                entry={{
                  id: entry.id,
                  title: entry.title,
                  year: entry.year,
                  rating: entry.rating,
                  posterUrl: entry.posterUrl
                }}
              />
            )}
            <ShareButton title={entry.title} />
            {isAdmin && (
              <Button asChild variant="outline" size="sm" className="gap-2">
                <Link href={`/catalog/${entry.id}/edit`}>
                  <Edit className="size-4" />
                  Редагувати
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-8 md:flex-row">
          {/* Постер */}
          <div className="shrink-0">
            {entry.posterUrl && entry.posterUrl.trim() ? (
              <div className="relative w-full max-w-[280px] md:w-[280px] aspect-[2/3] overflow-hidden rounded-xl shadow-lg">
                <Image 
                  src={entry.posterUrl} 
                  alt={entry.title} 
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 280px, 280px"
                  priority
                />
              </div>
            ) : (
              <div className="flex aspect-[2/3] w-full max-w-[280px] items-center justify-center rounded-xl bg-secondary md:w-[280px]">
                <Film className="size-16 text-muted-foreground/50" />
              </div>
            )}
          </div>

          {/* Деталі */}
          <div className="flex flex-col gap-6 flex-1">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="default" className="text-sm px-3 py-1 bg-primary text-primary-foreground">
                  {typeLabel}
                </Badge>
                {entry.year && (
                  <Badge variant="outline" className="text-sm px-3 py-1">
                    {entry.year}
                  </Badge>
                )}
                <div className="flex items-center gap-1 text-yellow-500 bg-yellow-500/10 px-2.5 py-1 rounded-md font-bold text-sm">
                  <Star className="size-4 fill-yellow-500" />
                  {entry.rating}/5
                </div>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black mt-2 leading-tight tracking-tight">{entry.title}</h1>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {entry.runtime > 0 && (
                <div className="flex items-center gap-1.5">
                  <Clock className="size-4" />
                  {entry.runtime} хв
                </div>
              )}
              {entry.director && (
                <div className="flex items-center gap-1.5">
                  <UserIcon className="size-4" />
                  Режисер: {entry.director}
                </div>
              )}
              {entry.user?.name && (
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary">Додано: {entry.user.name}</Badge>
                </div>
              )}
            </div>

            {genres.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {genres.map((g) => (
                  <Badge key={g} variant="secondary" className="bg-secondary/60 hover:bg-secondary">
                    {g}
                  </Badge>
                ))}
              </div>
            )}

            {entry.comment && (
              <div className="mt-2 text-base leading-relaxed text-foreground/90 bg-muted/30 p-4 rounded-lg border border-border/50">
                {entry.comment}
              </div>
            )}
            
            {!entry.comment && (
              <div className="mt-2 text-base leading-relaxed text-muted-foreground italic">
                Опис або коментар відсутній.
              </div>
            )}
          </div>
        </div>

        {/* Схожі тайтли */}
        {similarEntries.length > 0 && (
          <div className="flex flex-col gap-4 mt-12 pt-8 border-t">
            <h2 className="text-2xl font-black tracking-tight">Рекомендації для перегляду</h2>
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
              {similarEntries.map((item) => (
                <Link
                  key={item.id}
                  href={`/catalog/${item.id}`}
                  className="group flex flex-col gap-2 overflow-hidden rounded-lg border bg-card p-2 transition hover:-translate-y-1 hover:border-primary hover:shadow-md"
                >
                  <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md bg-secondary">
                    {item.posterUrl && item.posterUrl.trim() ? (
                      <img
                        src={item.posterUrl}
                        alt={item.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-bold text-2xl text-muted-foreground">
                        {item.title.slice(0, 1)}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 p-1">
                    <p className="line-clamp-1 font-bold text-sm group-hover:text-primary transition-colors">
                      {item.title}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{item.year ?? "—"}</span>
                      <span className="flex items-center gap-0.5 text-yellow-500 font-semibold">
                        ★ {item.rating}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
