import { auth } from "@/lib/auth";
import { getDashboardStats } from "@/lib/data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function WatchlistPlusPage() {
  const session = await auth();
  const stats = await getDashboardStats(session?.user?.id);

  return (
    <div className="page-shell flex flex-col gap-8">
      <header>
        <Badge className="mb-4" variant="secondary">Plus</Badge>
        <h1 className="section-title">Watchlist Plus</h1>
        <p className="section-lead">Розширена аналітика, персональні добірки і майбутні AI-рекомендації на базі вашого каталогу.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{stats.total}</CardTitle>
            <CardDescription>усього записів</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{stats.completed}</CardTitle>
            <CardDescription>завершено</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{stats.avgRating}/5</CardTitle>
            <CardDescription>середня оцінка</CardDescription>
          </CardHeader>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Що подивитись сьогодні</CardTitle>
          <CardDescription>Після підключення TMDb/AI тут з’являться персональні рекомендації.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {["Короткий фільм на вечір", "Серіал із вашого плану", "Щось із високою оцінкою"].map((item) => (
            <div key={item} className="rounded-md border bg-background p-4 font-semibold">{item}</div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
