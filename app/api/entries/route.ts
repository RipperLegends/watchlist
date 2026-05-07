import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { entrySchema } from "@/lib/validators";

export async function GET() {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const entries = await prisma.entry.findMany({
    where: { userId: Number(user.id) },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }]
  });

  return Response.json(entries);
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await request.json().catch(() => null);
  const parsed = entrySchema.safeParse(payload);
  if (!parsed.success) return Response.json({ error: "Invalid payload" }, { status: 400 });

  const entry = await prisma.entry.create({
    data: {
      ...parsed.data,
      userId: Number(user.id),
      year: parsed.data.year ?? null
    }
  });

  return Response.json(entry, { status: 201 });
}
