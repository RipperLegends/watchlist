import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadSupportAttachment } from "@/lib/supabase-storage";
import { reportSchema } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

async function createReport(formData: FormData) {
  "use server";
  const user = await requireUser();
  if (!user || user.role !== "user") redirect("/login");

  const parsed = reportSchema.safeParse({
    subject: formData.get("subject"),
    body: formData.get("body")
  });
  if (!parsed.success) return;

  const report = await prisma.report.create({
    data: {
      userId: Number(user.id),
      email: user.email ?? "",
      subject: parsed.data.subject,
      body: parsed.data.body,
      messages: {
        create: {
          senderId: Number(user.id),
          senderRole: "user",
          body: parsed.data.body
        }
      }
    },
    include: { messages: { orderBy: { createdAt: "asc" } } }
  });
  const firstMessage = report.messages[0];

  const file = formData.get("attachment");
  if (file instanceof File && file.size > 0) {
    const uploaded = await uploadSupportAttachment(Number(user.id), report.id, file);
    if (uploaded) {
      await prisma.reportAttachment.create({
        data: {
          reportId: report.id,
          reportMessageId: firstMessage?.id,
          userId: Number(user.id),
          fileName: uploaded.fileName,
          fileType: uploaded.fileType,
          fileSize: uploaded.fileSize,
          storagePath: uploaded.path,
          publicUrl: uploaded.publicUrl
        }
      });
    }
  }

  await prisma.auditLog.create({
    data: { userId: Number(user.id), action: "report.create", details: `report:${report.id}` }
  });
  revalidatePath("/contact-support");
  redirect("/contact-support");
}

export default async function ContactSupportPage() {
  const user = await requireUser();
  const reports = user
    ? await prisma.report.findMany({
        where: { userId: Number(user.id) },
        orderBy: { createdAt: "desc" },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            include: { attachments: true }
          },
          attachments: true
        }
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
          <CardDescription>Максимально просто: тема, опис проблеми і скріншот за потреби.</CardDescription>
        </CardHeader>
        <CardContent>
          {user?.role === "user" ? (
            <form action={createReport} className="flex flex-col gap-4">
              <Input name="subject" placeholder="Тема" required />
              <Textarea name="body" placeholder="Що сталося, на якій сторінці, що ви очікували побачити?" required />
              <Input name="attachment" type="file" accept="image/png,image/jpeg,image/webp" />
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
                  <div key={message.id} className="rounded-md bg-muted p-3 text-sm">
                    <p><b>{message.senderRole}:</b> {message.body}</p>
                    {message.attachments.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {message.attachments.map((attachment) => (
                          <a key={attachment.id} href={attachment.publicUrl} target="_blank" rel="noreferrer" className="rounded-md border bg-background px-2 py-1 text-xs font-semibold">
                            {attachment.fileName}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
