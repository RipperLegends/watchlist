import Link from "next/link";
import { ThumbsUp, Film } from "lucide-react";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { coverImageUrl } from "@/lib/image-urls";
import { initials } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();
  if (!user) redirect("/login");
  const profile = await prisma.user.findUniqueOrThrow({
    where: { id: Number(user.id) },
    select: {
      name: true,
      email: true,
      role: true,
      avatarUrl: true,
      coverUrl: true,
      bio: true,
      favoriteGenres: true
    }
  });
  const favoriteGenres = Array.isArray(profile.favoriteGenres)
    ? profile.favoriteGenres.filter((item): item is string => typeof item === "string")
    : [];

  const [addedToCatalogCount, friendsCount, teamsCount, recentItems, likedItems, completedWatchlist] = await Promise.all([
    prisma.entry.count({ where: { userId: Number(user.id) } }),
    prisma.friend.count({ 
      where: { 
        status: "accepted",
        OR: [{ userId: Number(user.id) }, { friendId: Number(user.id) }]
      } 
    }),
    prisma.teamMember.count({ where: { userId: Number(user.id) } }),
    prisma.entry.findMany({
      where: { userId: Number(user.id) },
      orderBy: { createdAt: "desc" },
      take: 4
    }),
    prisma.entryReaction.findMany({
      where: { userId: Number(user.id), value: 1 },
      orderBy: { createdAt: "desc" },
      take: 4,
      include: { entry: true }
    }),
    prisma.userWatchlistItem.findMany({
      where: { userId: Number(user.id), status: "completed" },
      include: { entry: true }
    })
  ]);

  // Calculate Stats
  let totalRuntime = 0;
  let moviesCompleted = 0;
  let seriesCompleted = 0;
  const genreCounts: Record<string, number> = {};

  completedWatchlist.forEach((item) => {
    if (item.entry.type === "movie") {
      moviesCompleted++;
      totalRuntime += item.entry.runtime || 0;
    } else {
      seriesCompleted++;
      // for series, estimate watch time if episodes > 0, otherwise just add runtime once
      const eps = Math.max(1, item.currentEpisode || 1);
      totalRuntime += (item.entry.runtime || 40) * eps; 
    }
    
    // Aggregating genres
    const genres = Array.isArray(item.entry.genre) 
      ? item.entry.genre.filter((g): g is string => typeof g === "string") 
      : [];
    genres.forEach((g) => {
      genreCounts[g] = (genreCounts[g] || 0) + 1;
    });
  });

  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([genre]) => genre);

  const hoursWatched = Math.floor(totalRuntime / 60);
  const daysWatched = (hoursWatched / 24).toFixed(1);

  return (
    <div className="page-shell flex flex-col gap-6">
      <Card className="overflow-hidden">
        <div
          className="h-44 border-b bg-secondary"
          style={profile.coverUrl ? { backgroundImage: `url(${coverImageUrl(profile.coverUrl)})`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}
        />
        <CardContent className="-mt-16 grid gap-6 p-6 md:grid-cols-[140px_1fr_auto] md:items-end">
          <Avatar className="size-32 border-4 border-background bg-muted">
            {profile.avatarUrl ? <AvatarImage src={profile.avatarUrl} alt={profile.name} className="object-cover" /> : null}
            <AvatarFallback className="text-4xl">{initials(profile.name)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-black">{profile.name}</h1>
              <Badge>{profile.role}</Badge>
            </div>
            <p className="text-muted-foreground">{profile.email}</p>
            <p className="max-w-2xl leading-7 text-muted-foreground">
              {profile.bio || "Користувач ще не додав опис про себе."}
            </p>
            {favoriteGenres.length ? (
              <div className="flex flex-wrap gap-2">
                {favoriteGenres.map((genre) => <Badge key={genre} variant="secondary">{genre}</Badge>)}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 md:flex-col md:justify-end">
            <Button asChild>
              <Link href="/catalog">Перейти до Каталогу</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/settings">Налаштування профілю</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Додано в Каталог</p>
              <h2 className="text-3xl font-bold">{addedToCatalogCount}</h2>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex size-12 items-center justify-center rounded-full bg-green-500/10 text-green-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Друзів</p>
              <h2 className="text-3xl font-bold">{friendsCount}</h2>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex size-12 items-center justify-center rounded-full bg-blue-500/10 text-blue-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Команд</p>
              <h2 className="text-3xl font-bold">{teamsCount}</h2>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Stats */}
      <Card>
        <CardContent className="p-6">
          <h3 className="mb-6 text-lg font-bold flex items-center gap-2">
            📊 Моя статистика (Завершено)
          </h3>
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-4">
            <div className="flex flex-col gap-1 rounded-lg border bg-muted/20 p-4">
              <span className="text-sm text-muted-foreground">Час за переглядом</span>
              <span className="text-3xl font-black">{hoursWatched} год</span>
              <span className="text-xs text-muted-foreground">≈ {daysWatched} днів</span>
            </div>
            
            <div className="flex flex-col gap-1 rounded-lg border bg-muted/20 p-4">
              <span className="text-sm text-muted-foreground">Переглянуто фільмів</span>
              <span className="text-3xl font-black">{moviesCompleted}</span>
              <span className="text-xs text-muted-foreground">тайтлів</span>
            </div>

            <div className="flex flex-col gap-1 rounded-lg border bg-muted/20 p-4">
              <span className="text-sm text-muted-foreground">Переглянуто серіалів</span>
              <span className="text-3xl font-black">{seriesCompleted}</span>
              <span className="text-xs text-muted-foreground">тайтлів</span>
            </div>

            <div className="flex flex-col gap-1 rounded-lg border bg-muted/20 p-4">
              <span className="text-sm text-muted-foreground">Улюблені жанри</span>
              <div className="flex flex-col gap-1 mt-1">
                {topGenres.length > 0 ? topGenres.map(g => (
                  <Badge key={g} variant="secondary" className="w-fit">{g}</Badge>
                )) : <span className="text-sm text-muted-foreground">Немає даних</span>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Recent Activity */}
      {recentItems.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="mb-4 text-lg font-bold">Останні додані до списку</h3>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              {recentItems.map((item) => (
                <div key={item.id} className="group relative flex overflow-hidden rounded-md border bg-muted/20 transition-colors hover:bg-muted/50">
                  {item.posterUrl && item.posterUrl.trim() ? (
                    <img src={item.posterUrl} alt={item.title} className="h-24 w-16 object-cover" />
                  ) : (
                    <div className="flex h-24 w-16 items-center justify-center bg-secondary">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-6 text-muted-foreground"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/></svg>
                    </div>
                  )}
                  <div className="flex flex-col justify-center p-3">
                    <p className="line-clamp-2 text-sm font-semibold">{item.title}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {item.type === "movie" ? "Фільм" : "Серіал"}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Liked Activity */}
      {likedItems.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="mb-4 text-lg font-bold flex items-center gap-2">
              <ThumbsUp className="size-5 text-primary" />
              Останні вподобані
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              {likedItems.map((reaction) => (
                <Link href={`/catalog/${reaction.entry.id}`} key={reaction.id} className="group relative flex overflow-hidden rounded-md border bg-muted/20 transition-colors hover:bg-muted/50 hover:border-primary">
                  {reaction.entry.posterUrl && reaction.entry.posterUrl.trim() ? (
                    <img src={reaction.entry.posterUrl} alt={reaction.entry.title} className="h-24 w-16 object-cover" />
                  ) : (
                    <div className="flex h-24 w-16 items-center justify-center bg-secondary">
                      <Film className="size-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex flex-col justify-center p-3">
                    <p className="line-clamp-2 text-sm font-semibold group-hover:text-primary transition-colors">{reaction.entry.title}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {reaction.entry.type === "movie" ? "Фільм" : "Серіал"}
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
