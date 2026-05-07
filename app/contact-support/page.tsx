import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reportSchema } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

async function createReport(formData: FormData) {
  "use server";
  const session = await auth();
  if (!session?.user || session.user.role !== "user") redirect("/login");

  const parsed = reportSchema.safeParse({
    subject: formData.get("subject"),
    body: formData.get("body")
  });
  if (!parsed.success) return;

  const report = await prisma.report.create({
    data: {
      userId: Number(session.user.id),
      email: session.user.email ?? "",
      subject: parsed.data.subject,
      body: parsed.data.body,
      messages: {
        create: {
          senderId: Number(session.user.id),
          senderRole: "user",
          body: parsed.data.body
        }
      }
    }
  });

  await prisma.auditLog.create({
    data: { userId: Number(session.user.id), action: "report.create", details: `report:${report.id}` }
  });
}

export default async function ContactSupportPage() {
  const session = await auth();
  const reports = session?.user
    ? await prisma.report.findMany({
        where: { userId: Number(session.user.id) },
        orderBy: { createdAt: "desc" },
        include: { messages: { orderBy: { createdAt: "asc" } } }
      })
    : [];

  return (
    <div className="page-shell grid gap-6 lg:grid-cols-[0.9fr_1fr]">
      <section className="flex flex-col gap-4">
        <h1 className="section-title">Зв’язатися з підтримкою</h1>
        <p className="section-lead">
          Звернення можуть залишати тільки звичайні користувачі. Адміністратор відповідає у тікеті, і вся переписка зберігається історією.
        </p>
      </section>
      <Card>
        <CardHeader>
          <CardTitle>Форма звернення</CardTitle>
          <CardDescription>Максимально просто: тема і опис проблеми.</CardDescription>
        </CardHeader>
        <CardContent>
          {session?.user?.role === "user" ? (
            <form action={createReport} className="flex flex-col gap-4">
              <Input name="subject" placeholder="Тема" required />
              <Textarea name="body" placeholder="Що сталося, на якій сторінці, що ви очікували побачити?" required />
              <Button type="submit">Надіслати звернення</Button>
            </form>
          ) : (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Увійдіть як звичайний користувач, щоб створити звернення.
            </p>
          )}
        </CardContent>
      </Card>

      <section className="lg:col-span-2">
        <h2 className="mb-4 text-2xl font-bold">Ваші звернення</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>{report.subject}</CardTitle>
                  <Badge>{report.status}</Badge>
                </div>
                <CardDescription>{report.messages.length} повідомлень</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {report.messages.map((message) => (
                  <p key={message.id} className="rounded-md bg-muted p-3 text-sm">
                    <b>{message.senderRole}:</b> {message.body}
                  </p>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
