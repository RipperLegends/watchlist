import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, PlayCircle, Star } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDashboardStats } from "@/lib/data";
import { productCards } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireUser();
  const visibleProductCards = productCards.filter((card) => !card.adminOnly || user?.role === "admin");

  return (
    <div className="page-shell flex flex-col gap-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent userId={user?.id} />
      </Suspense>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5 mt-4">
        {visibleProductCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.href} className="shadow-none">
              <CardHeader>
                <Icon data-icon="inline-start" />
                <CardTitle>{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" size="sm">
                  <Link href={card.href}>Відкрити</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {user ? (
        <section className="flex justify-center mt-8">
          <Card className="w-full max-w-2xl text-center">
            <CardHeader>
              <CardTitle>Швидкі переходи</CardTitle>
              <CardDescription>Почніть свій кіновечір з одного кліку.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link href="/catalog">Перейти в каталог</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/messages">Мої повідомлення</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/friends">Друзі</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}

async function DashboardContent({ userId }: { userId?: string | number | null }) {
  const stats = await getDashboardStats(userId);

  const metricCards = [
    { label: "У каталозі", value: stats.total, description: "фільми й серіали", icon: BookOpen },
    { label: "Завершено", value: stats.completed, description: "уже переглянуто", icon: CheckCircle2 },
    { label: "У процесі", value: stats.watching, description: "зараз дивитесь", icon: PlayCircle },
    { label: "Середня оцінка", value: stats.avgRating || 0, description: "за 5-бальною системою", icon: Star }
  ];

  return (
    <>
      <section className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col gap-6">
          <Badge className="w-fit" variant="secondary">
            Ваш Watchlist одним поглядом
          </Badge>
          <div className="flex flex-col gap-4">
            <h1 className="section-title">Фільми, серіали й друзі в одному каталозі.</h1>
            <p className="section-lead">
              Головна показує стан каталогу без зайвого шуму: скільки вже додано, що зараз у процесі і куди варто перейти далі.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/catalog">
                Відкрити каталог
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/friends">Друзі</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Швидкий зріз</CardTitle>
            <CardDescription>Статистика повернулась на головну, але без зайвих блоків.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {metricCards.map((metric) => {
              const Icon = metric.icon;
              return (
                <div key={metric.label} className="rounded-lg border bg-background p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm font-semibold text-muted-foreground">{metric.label}</span>
                    <Icon data-icon="inline-start" />
                  </div>
                  <p className="text-4xl font-black text-primary">{metric.value}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{metric.description}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      {/* ШОУКЕЙС (Вітрина для Гостей та Юзерів) */}
      <section className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-bold tracking-tight">Популярне в каталозі</h2>
            <p className="text-sm text-muted-foreground">Фільми та серіали, які зараз обговорюють.</p>
          </div>
          <Button asChild variant="ghost" size="sm" className="hidden sm:flex">
            <Link href="/catalog">Всі релізи <ArrowRight className="ml-2 size-4" /></Link>
          </Button>
        </div>
        
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {stats.recent.length ? (
            stats.recent.map((entry) => (
              <Link key={entry.id} href="/catalog" className="group relative flex aspect-[2/3] flex-col justify-end overflow-hidden rounded-xl border bg-card transition-all hover:scale-105 hover:border-primary hover:shadow-xl">
                {entry.posterUrl ? (
                  <Image
                    src={entry.posterUrl}
                    alt={entry.title}
                    fill
                    className="z-0 object-cover transition-transform duration-500 group-hover:scale-110"
                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 20vw"
                  />
                ) : (
                  <div className="absolute inset-0 z-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
                    <span className="text-4xl font-black text-primary/30">{entry.title.charAt(0)}</span>
                  </div>
                )}
                {/* Градієнт для читабельності тексту */}
                <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-80 transition-opacity group-hover:opacity-100" />
                
                <div className="relative z-20 flex flex-col gap-1 p-3">
                  <div className="flex items-center gap-1">
                    <Star className="size-3 fill-primary text-primary" />
                    <span className="text-xs font-bold text-white">{entry.rating}/5</span>
                  </div>
                  <h3 className="line-clamp-2 text-sm font-bold leading-tight text-white">{entry.title}</h3>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-white/70">{entry.year ?? "Рік невідомий"}</p>
                </div>
              </Link>
            ))
          ) : (
            <div className="col-span-full rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Каталог поки порожній.
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-12">
      <section className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-24 w-full" />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </section>
      <section className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[2/3] w-full rounded-xl" />
          ))}
        </div>
      </section>
    </div>
  );
}
