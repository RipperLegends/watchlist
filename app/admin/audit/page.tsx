import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";

type AuditSearchParams = {
  page?: string;
};

type AuditPageProps = {
  searchParams?: Promise<AuditSearchParams>;
};

function normalizePage(value?: string) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function auditUrl(page: number) {
  return page > 1 ? `/admin/audit?page=${page}` : "/admin/audit";
}

export default async function AdminAuditPage({ searchParams }: AuditPageProps) {
  const params = searchParams ? await searchParams : {};
  const pageSize = 30;
  const requestedPage = normalizePage(params.page);
  const total = await prisma.auditLog.count();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: {
      user: { select: { name: true, email: true } }
    }
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Badge className="w-fit" variant="secondary">System log</Badge>
        <h1 className="section-title">Аудит</h1>
        <p className="section-lead">Історія важливих адмінських дій, відповідей і технічного обслуговування.</p>
      </header>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Журнал дій</CardTitle>
          <CardDescription>
            Показано {logs.length ? (page - 1) * pageSize + 1 : 0}-{(page - 1) * pageSize + logs.length} з {total} записів.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Дія</TableHead>
                <TableHead>Адмін / система</TableHead>
                <TableHead>Деталі</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{formatDate(log.createdAt)}</TableCell>
                  <TableCell><Badge variant="secondary">{log.action}</Badge></TableCell>
                  <TableCell>{log.user?.name ?? "system"}</TableCell>
                  <TableCell className="max-w-xl truncate text-sm text-muted-foreground">{log.details || "без деталей"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!logs.length ? <p className="p-6 text-sm text-muted-foreground">Аудит поки порожній.</p> : null}
        </CardContent>
        <div className="flex flex-wrap justify-between gap-3 border-t p-4">
          <p className="text-sm text-muted-foreground">Сторінка {page} з {totalPages}</p>
          <div className="flex gap-2">
            <Button
              asChild
              size="sm"
              variant="secondary"
              className={page <= 1 ? "pointer-events-none opacity-50" : ""}
              aria-disabled={page <= 1}
            >
              <Link href={auditUrl(page - 1)}>Назад</Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="secondary"
              className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
              aria-disabled={page >= totalPages}
            >
              <Link href={auditUrl(page + 1)}>Далі</Link>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
