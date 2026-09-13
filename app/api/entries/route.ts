import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/auth";
import { entrySchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const skip = Math.max(0, Number(searchParams.get("skip")) || 0);
  const take = Math.min(100, Math.max(1, Number(searchParams.get("take")) || 50));
  const q = searchParams.get("q")?.trim();

  const entries = await prisma.entry.findMany({
    where: {
      type: { in: ["movie", "series"] },
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { director: { contains: q, mode: "insensitive" } }
            ]
          }
        : {})
    },
    orderBy: q ? [{ rating: "desc" }, { createdAt: "desc" }] : [{ sortOrder: "asc" }, { createdAt: "desc" }],
    skip,
    take
  });

  return Response.json(entries);
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const payload = await request.json().catch(() => null);
  const parsed = entrySchema.safeParse(payload);
  if (!parsed.success) return Response.json({ error: "Invalid payload" }, { status: 400 });

  const entry = await prisma.entry.create({
    data: {
      ...parsed.data,
      userId: Number(admin.id),
      year: parsed.data.year ?? null
    }
  });

  return Response.json(entry, { status: 201 });
}
