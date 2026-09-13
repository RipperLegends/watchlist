import Link from "next/link";
import type { ReportStatus } from "@prisma/client";
import { deleteReport, replyToReport, updateReportStatus } from "@/app/admin/actions";
import { getReportsForAdmin } from "@/lib/data";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const dynamic = "force-dynamic";

type ReportsSearchParams = {
  status?: string;
};

type ReportsPageProps = {
  searchParams?: Promise<ReportsSearchParams>;
};

const reportFilters = [
  { value: "all", label: "Усі" },
  { value: "new", label: "Нові" },
  { value: "reviewing", label: "В роботі" },
  { value: "answered", label: "Відповіли" },
  { value: "closed", label: "Закриті" }
] as const;

const reportStatusLabels = {
  new: "Нове",
  reviewing: "В роботі",
  answered: "Відповіли",
  closed: "Закрито"
} as const;

function normalizeReportFilter(value?: string): ReportStatus | "all" {
  return value === "new" || value === "reviewing" || value === "answered" || value === "closed" ? value : "all";
}

function reportsUrl(status: string) {
  return status === "all" ? "/admin/reports" : `/admin/reports?status=${status}`;
}

export default async function AdminReportsPage({ searchParams }: ReportsPageProps) {
  const params = searchParams ? await searchParams : {};
  const status = normalizeReportFilter(params.status);
  const reports = await getReportsForAdmin(status);
  const returnTo = reportsUrl(status);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Badge className="w-fit" variant="secondary">Support CRM</Badge>
        <h1 className="section-title">Звернення</h1>
        <p className="section-lead">Скарги й питання користувачів з історією переписки, статусом і видаленням.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {reportFilters.map((item) => (
          <Button key={item.value} asChild variant={status === item.value ? "default" : "secondary"} size="sm">
            <Link href={reportsUrl(item.value)}>{item.label}</Link>
          </Button>
        ))}
      </div>

      <div className="grid gap-4">
        {reports.map((report) => (
          <Card key={report.id}>
            <CardHeader className="border-b">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <CardTitle>{report.subject}</CardTitle>
                  <CardDescription>
                    {report.user?.name ?? report.email ?? "користувач"} · {formatDate(report.createdAt)}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={report.status === "closed" ? "outline" : report.status === "new" ? "destructive" : "secondary"}>
                    {reportStatusLabels[report.status]}
                  </Badge>
                  {report.attachments.length ? <Badge variant="outline">{report.attachments.length} вкладень</Badge> : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-5 p-5 xl:grid-cols-[1fr_320px]">
              <div className="flex flex-col gap-4">
                <div className="rounded-md border bg-muted/35 p-4">
                  <p className="text-sm font-semibold text-muted-foreground">Початкове звернення</p>
                  <p className="mt-2 whitespace-pre-wrap leading-7">{report.body}</p>
                </div>

                <div className="flex flex-col gap-3">
                  {report.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`rounded-md border p-4 ${message.senderRole === "admin" ? "bg-primary/10" : "bg-card"}`}
                    >
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant={message.senderRole === "admin" ? "default" : "secondary"}>
                          {message.senderRole === "admin" ? "Адмін" : "Користувач"}
                        </Badge>
                        <span>{message.sender?.name ?? "system"}</span>
                        <span>·</span>
                        <span>{formatDate(message.createdAt)}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap leading-7">{message.body}</p>
                      {message.attachments.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.attachments.map((attachment) => (
                            <a
                              key={attachment.id}
                              className="rounded-md border px-3 py-1 text-sm text-primary hover:bg-primary/10"
                              href={attachment.publicUrl}
                              rel="noreferrer"
                              target="_blank"
                            >
                              {attachment.fileName}
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {!report.messages.length ? (
                    <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      Переписка ще не починалась. Відповідь нижче створить перше повідомлення від адміна.
                    </p>
                  ) : null}
                </div>
              </div>

              <aside className="flex h-fit flex-col gap-4 rounded-md border bg-muted/25 p-4">
                <form action={updateReportStatus} className="flex flex-col gap-3">
                  <input type="hidden" name="id" value={report.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <label className="text-sm font-semibold text-muted-foreground" htmlFor={`status-${report.id}`}>Статус</label>
                  <Select id={`status-${report.id}`} name="status" defaultValue={report.status}>
                    <option value="new">Нове</option>
                    <option value="reviewing">В роботі</option>
                    <option value="answered">Відповіли</option>
                    <option value="closed">Закрито</option>
                  </Select>
                  <Button type="submit" variant="secondary">Оновити статус</Button>
                </form>

                <form action={replyToReport} className="flex flex-col gap-3">
                  <input type="hidden" name="id" value={report.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <label className="text-sm font-semibold text-muted-foreground" htmlFor={`reply-${report.id}`}>Відповідь адміна</label>
                  <Textarea id={`reply-${report.id}`} name="body" placeholder="Напишіть відповідь користувачу..." required />
                  <Button type="submit">Надіслати</Button>
                </form>

                <form action={deleteReport}>
                  <input type="hidden" name="id" value={report.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <Button className="w-full" type="submit" variant="destructive">Видалити звернення</Button>
                </form>
              </aside>
            </CardContent>
          </Card>
        ))}
        {!reports.length ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">За цим фільтром звернень немає.</CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
