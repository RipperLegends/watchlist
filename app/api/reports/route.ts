import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { reportSchema } from "@/lib/validators";

export async function GET() {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const reports = await prisma.report.findMany({
    where: user.role === "admin" ? {} : { userId: Number(user.id) },
    include: { messages: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" }
  });

  return Response.json(reports);
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user || user.role !== "user") return Response.json({ error: "Only regular users can create reports" }, { status: 403 });

  const payload = await request.json().catch(() => null);
  const parsed = reportSchema.safeParse(payload);
  if (!parsed.success) return Response.json({ error: "Invalid payload" }, { status: 400 });

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
    }
  });

  return Response.json(report, { status: 201 });
}
