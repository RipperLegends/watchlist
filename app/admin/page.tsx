import Link from "next/link";
import { AlertCircle, ArrowRight, ClipboardList, Database, FileWarning, Shield, Users } from "lucide-react";
import { getAdminEntries, getAdminOverview, getMaintenanceStatus, getReportsForAdmin } from "@/lib/data";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const [overview, maintenance, recentReports, catalog] = await Promise.all([
    getAdminOverview(),
    getMaintenanceStatus(),
    getReportsForAdmin("new"),
    getAdminEntries({ pageSize: 5 })
  ]);

  const metrics = [
    { label: "Користувачі", value: overview.users, href: "/admin/users", icon: Users },
    { label: "Каталог", value: overview.entries, href: "/admin/catalog", icon: ClipboardList },
    { label: "Нові звернення", value: overview.reports, href: "/admin/reports?status=new", icon: FileWarning },
    { label: "Заблоковані", value: overview.blocked, href: "/admin/moderation", icon: Shield },
    { label: "Проблеми БД", value: maintenance.total, href: "/admin/maintenance", icon: Database }
  ];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Badge className="w-fit" variant="secondary">Mini CRM</Badge>
        <h1 className="section-title">Адмін огляд</h1>
        <p className="section-lead">Короткий стан сайту і швидкі переходи до робочих розділів.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Link key={metric.label} href={metric.href} className="group">
              <Card className="h-full transition group-hover:-translate-y-0.5 group-hover:border-primary">
                <CardHeader>
                  <div className="mb-4 flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <CardTitle className="text-3xl text-primary">{metric.value}</CardTitle>
                  <CardDescription>{metric.label}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Потребує уваги</CardTitle>
              <CardDescription>Нові звернення та технічні сигнали.</CardDescription>
            </div>
            <Button asChild size="sm" variant="secondary">
              <Link href="/admin/reports">Звернення</Link>
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {recentReports.slice(0, 4).map((report) => (
              <Link key={report.id} href="/admin/reports?status=new" className="rounded-md border p-3 transition hover:border-primary">
                <p className="font-bold">{report.subject}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {report.user?.name ?? report.email ?? "користувач"} · {formatDate(report.createdAt)}
                </p>
              </Link>
            ))}
            {maintenance.total ? (
              <Link href="/admin/maintenance" className="flex items-center gap-3 rounded-md border border-destructive/35 bg-destructive/10 p-3 text-sm font-semibold text-destructive">
                <AlertCircle className="size-4" />
                Є {maintenance.total} проблемних зв’язків у базі.
              </Link>
            ) : null}
            {!recentReports.length && !maintenance.total ? (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">Критичних задач зараз немає.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Останній каталог</CardTitle>
              <CardDescription>Швидкий зріз перших записів у Content Manager.</CardDescription>
            </div>
            <Button asChild size="sm">
              <Link href="/admin/catalog">
                Відкрити
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {catalog.entries.map((entry) => (
              <div key={entry.id} className="grid grid-cols-[48px_1fr_auto] items-center gap-3 rounded-md border p-2">
                <div
                  className="flex size-12 items-center justify-center rounded-md bg-gradient-to-br from-primary to-accent text-sm font-black text-white"
                  style={entry.posterUrl ? { backgroundImage: `url(${entry.posterUrl})`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}
                >
                  {!entry.posterUrl ? entry.title.slice(0, 1) : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-bold">{entry.title}</p>
                  <p className="text-sm text-muted-foreground">{entry.year ?? "рік не вказано"}</p>
                </div>
                <Badge>{entry.rating}/5</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Останні дії</CardTitle>
          <CardDescription>Короткий аудит змін у системі.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {overview.auditLogs.map((log) => (
            <div key={log.id} className="rounded-md border p-3 text-sm">
              <b>{log.action}</b> · {log.user?.name ?? "system"} · {log.details} · {formatDate(log.createdAt)}
            </div>
          ))}
          {!overview.auditLogs.length ? <p className="text-sm text-muted-foreground">Аудит поки порожній.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
