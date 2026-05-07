import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, PlayCircle, Star } from "lucide-react";
import { auth } from "@/lib/auth";
import { getDashboardStats } from "@/lib/data";
import { productCards } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();
  const stats = await getDashboardStats(session?.user?.id);

  const metricCards = [
    { label: "У каталозі", value: stats.total, description: "фільми, серіали й ігри", icon: BookOpen },
    { label: "Завершено", value: stats.completed, description: "уже переглянуто", icon: CheckCircle2 },
    { label: "У процесі", value: stats.watching, description: "зараз дивитесь", icon: PlayCircle },
    { label: "Середня оцінка", value: stats.avgRating || 0, description: "за 5-бальною системою", icon: Star }
  ];

  return (
    <div className="page-shell flex flex-col gap-12">
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {productCards.map((card) => {
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

      <section className="grid gap-6 lg:grid-cols-[1fr_0.75fr]">
        <Card>
          <CardHeader>
            <CardTitle>Останні записи</CardTitle>
            <CardDescription>Короткий зріз того, що нещодавно потрапило у ваш каталог.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {stats.recent.length ? (
              stats.recent.map((entry) => (
                <Link key={entry.id} href="/catalog" className="flex items-center justify-between rounded-md border p-4 hover:bg-muted/60">
                  <div>
                    <p className="font-bold">{entry.title}</p>
                    <p className="text-sm text-muted-foreground">{entry.status} · {entry.year ?? "рік не вказано"}</p>
                  </div>
                  <Badge variant="secondary">{entry.rating}/5</Badge>
                </Link>
              ))
            ) : (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Після входу тут з’являться останні додані фільми й серіали.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Швидкі переходи</CardTitle>
            <CardDescription>Основні дії винесені окремо, а повний список живе на сторінці каталогу.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button asChild>
              <Link href="/catalog">До списку</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/messages">Повідомлення</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/settings">Приватність</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
