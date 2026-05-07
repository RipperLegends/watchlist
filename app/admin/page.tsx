import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getAdminOverview, getAdminUsers, getReportsForAdmin } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

export const dynamic = "force-dynamic";

async function updateUserRole(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  if (!admin) redirect("/login");
  const id = Number(formData.get("id"));
  const role = String(formData.get("role")) === "admin" ? "admin" : "user";
  await prisma.user.update({ where: { id }, data: { role } });
  await prisma.auditLog.create({ data: { userId: Number(admin.id), action: "user.role.update", details: `user:${id} role:${role}` } });
}

async function toggleUserBlock(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  if (!admin) redirect("/login");
  const id = Number(formData.get("id"));
  const accountStatus = String(formData.get("accountStatus")) === "blocked" ? "active" : "blocked";
  await prisma.user.update({ where: { id }, data: { accountStatus } });
  await prisma.auditLog.create({ data: { userId: Number(admin.id), action: "user.block.toggle", details: `user:${id} status:${accountStatus}` } });
}

async function updateReportStatus(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  if (!admin) redirect("/login");
  const id = Number(formData.get("id"));
  const status = String(formData.get("status")) as "new" | "reviewing" | "answered" | "closed";
  await prisma.report.update({ where: { id }, data: { status } });
}

async function deleteReport(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  if (!admin) redirect("/login");
  const id = Number(formData.get("id"));
  await prisma.report.delete({ where: { id } });
  await prisma.auditLog.create({ data: { userId: Number(admin.id), action: "report.delete", details: `report:${id}` } });
}

async function replyToReport(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  if (!admin) redirect("/login");
  const id = Number(formData.get("id"));
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  await prisma.reportMessage.create({
    data: {
      reportId: id,
      senderId: Number(admin.id),
      senderRole: "admin",
      body
    }
  });
  await prisma.report.update({
    where: { id },
    data: {
      status: "answered",
      adminResponse: body,
      respondedAt: new Date(),
      respondedBy: Number(admin.id)
    }
  });
  await prisma.auditLog.create({ data: { userId: Number(admin.id), action: "report.reply", details: `report:${id}` } });
}

export default async function AdminPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/");

  const [overview, users, reports] = await Promise.all([getAdminOverview(), getAdminUsers("all"), getReportsForAdmin()]);

  return (
    <div className="page-shell grid gap-6 xl:grid-cols-[260px_1fr]">
      <aside className="h-fit rounded-lg border bg-card p-4 shadow-soft">
        {["Огляд", "Користувачі", "Контент", "Звернення", "Модерація", "Аудит", "Maintenance"].map((item) => (
          <a key={item} href={`#${item.toLowerCase()}`} className="block rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
            {item}
          </a>
        ))}
      </aside>

      <div className="flex flex-col gap-8">
        <section id="огляд" className="flex flex-col gap-4">
          <h1 className="section-title">Адмін панель</h1>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              ["Користувачі", overview.users],
              ["Контент", overview.entries],
              ["Нові звернення", overview.reports],
              ["Заблоковані", overview.blocked]
            ].map(([label, value]) => (
              <Card key={label}>
                <CardHeader>
                  <CardTitle className="text-3xl text-primary">{value}</CardTitle>
                  <CardDescription>{label}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section id="користувачі" className="flex flex-col gap-4">
          <div>
            <h2 className="text-2xl font-bold">Користувачі</h2>
            <p className="text-muted-foreground">Ролі, блокування і кількість даних по акаунтах.</p>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Логін</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Роль</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Дії</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-bold">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell><Badge>{user.role}</Badge></TableCell>
                      <TableCell><Badge variant={user.accountStatus === "blocked" ? "destructive" : "secondary"}>{user.accountStatus}</Badge></TableCell>
                      <TableCell className="flex flex-wrap gap-2">
                        <form action={updateUserRole}>
                          <input type="hidden" name="id" value={user.id} />
                          <input type="hidden" name="role" value={user.role === "admin" ? "user" : "admin"} />
                          <Button size="sm" variant="outline" type="submit">{user.role === "admin" ? "Зняти адміна" : "Дати адміна"}</Button>
                        </form>
                        <form action={toggleUserBlock}>
                          <input type="hidden" name="id" value={user.id} />
                          <input type="hidden" name="accountStatus" value={user.accountStatus} />
                          <Button size="sm" variant={user.accountStatus === "blocked" ? "secondary" : "destructive"} type="submit">
                            {user.accountStatus === "blocked" ? "Розблокувати" : "Заблокувати"}
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        <section id="звернення" className="flex flex-col gap-4">
          <div>
            <h2 className="text-2xl font-bold">Звернення</h2>
            <p className="text-muted-foreground">Статус тікета, історія повідомлень і можливість видалення.</p>
          </div>
          <div className="grid gap-4">
            {reports.map((report) => (
              <Card key={report.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle>{report.subject}</CardTitle>
                      <CardDescription>{report.user?.name ?? report.email} · {report.status}</CardDescription>
                    </div>
                    <Badge>{report.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <p className="text-sm leading-6 text-muted-foreground">{report.body}</p>
                  <div className="rounded-md bg-muted p-3">
                    {report.messages.length ? report.messages.map((message) => (
                      <p key={message.id} className="text-sm"><b>{message.senderRole}:</b> {message.body}</p>
                    )) : <p className="text-sm text-muted-foreground">Історії відповідей поки немає.</p>}
                  </div>
                  <form action={replyToReport} className="flex flex-col gap-2">
                    <input type="hidden" name="id" value={report.id} />
                    <Textarea name="body" placeholder="Відповідь користувачу" />
                    <Button className="w-fit" size="sm" type="submit">Надіслати відповідь</Button>
                  </form>
                  <div className="flex flex-wrap gap-2">
                    {["new", "reviewing", "answered", "closed"].map((status) => (
                      <form key={status} action={updateReportStatus}>
                        <input type="hidden" name="id" value={report.id} />
                        <input type="hidden" name="status" value={status} />
                        <Button size="sm" variant="outline" type="submit">{status}</Button>
                      </form>
                    ))}
                    <form action={deleteReport}>
                      <input type="hidden" name="id" value={report.id} />
                      <Button size="sm" variant="destructive" type="submit">Видалити</Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="аудит" className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold">Аудит</h2>
          <Card>
            <CardContent className="flex flex-col gap-3 p-6">
              {overview.auditLogs.map((log) => (
                <div key={log.id} className="rounded-md border p-3 text-sm">
                  <b>{log.action}</b> · {log.user?.name ?? "system"} · {log.details}
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section id="maintenance" className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold">Maintenance</h2>
          <Card>
            <CardHeader>
              <CardTitle>Стан БД</CardTitle>
              <CardDescription>Prisma relations і каскадні видалення зменшують ризик сиріт БД.</CardDescription>
            </CardHeader>
          </Card>
        </section>
      </div>
    </div>
  );
}
