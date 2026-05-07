import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return Response.json([]);

  const users = await prisma.user.findMany({
    where: {
      id: { not: Number(user.id) },
      accountStatus: "active",
      name: { contains: query, mode: "insensitive" }
    },
    take: 10,
    select: { id: true, name: true, email: true }
  });

  return Response.json(users);
}
