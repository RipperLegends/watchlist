import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { entrySchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const payload = await request.json().catch(() => null);
  const parsed = entrySchema.safeParse(payload);
  if (!parsed.success) return Response.json({ error: "Invalid payload" }, { status: 400 });

  const existingEntry = await prisma.entry.findFirst({
    where: { id: Number(id), userId: Number(user.id) },
    select: { id: true }
  });
  if (!existingEntry) return Response.json({ error: "Not found" }, { status: 404 });

  const entry = await prisma.entry.update({
    where: { id: Number(id) },
    data: {
      ...parsed.data,
      year: parsed.data.year ?? null
    }
  });

  return Response.json(entry);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;

  await prisma.entry.deleteMany({
    where: { id: Number(id), userId: Number(user.id) }
  });

  return Response.json({ ok: true });
}
