import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { messageSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;

  const report = await prisma.report.findFirst({
    where: user.role === "admin" ? { id: Number(id) } : { id: Number(id), userId: Number(user.id) },
    include: { messages: { orderBy: { createdAt: "asc" } } }
  });

  if (!report) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(report.messages);
}

export async function POST(request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const payload = await request.json().catch(() => null);
  const parsed = messageSchema.safeParse(payload);
  if (!parsed.success) return Response.json({ error: "Invalid payload" }, { status: 400 });

  const report = await prisma.report.findFirst({
    where: user.role === "admin" ? { id: Number(id) } : { id: Number(id), userId: Number(user.id) },
    select: { id: true }
  });
  if (!report) return Response.json({ error: "Not found" }, { status: 404 });

  const message = await prisma.reportMessage.create({
    data: {
      reportId: Number(id),
      senderId: Number(user.id),
      senderRole: user.role,
      body: parsed.data.body
    }
  });

  if (user.role === "admin") {
    await prisma.report.update({
      where: { id: Number(id) },
      data: {
        status: "answered",
        adminResponse: parsed.data.body,
        respondedAt: new Date(),
        respondedBy: Number(user.id)
      }
    });
  }

  return Response.json(message, { status: 201 });
}
