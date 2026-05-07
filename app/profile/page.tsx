import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDashboardStats } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const stats = await getDashboardStats(session.user.id);

  return (
    <div className="page-shell flex flex-col gap-8">
      <Card>
        <CardContent className="grid gap-6 p-6 md:grid-cols-[140px_1fr_auto] md:items-center">
          <Avatar className="size-32">
            <AvatarFallback className="text-4xl">{initials(session.user.name ?? "User")}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-black">{session.user.name}</h1>
              <Badge>{session.user.role}</Badge>
            </div>
            <p className="text-muted-foreground">{session.user.email}</p>
            <p className="max-w-2xl leading-7 text-muted-foreground">
              Профіль зосереджений на особистих даних, ролі й каталозі. Дашборд і досягнення тут не дублюються.
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          ["Каталог", stats.total],
          ["Завершено", stats.completed],
          ["У процесі", stats.watching],
          ["Середня оцінка", stats.avgRating]
        ].map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle className="text-3xl text-primary">{value}</CardTitle>
              <CardDescription>{label}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </div>
  );
}
