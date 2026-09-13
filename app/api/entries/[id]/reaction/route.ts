import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getReactionSummary(entryId: number, userId: number) {
  const [likes, dislikes, ownReaction] = await Promise.all([
    prisma.entryReaction.count({ where: { entryId, value: 1 } }),
    prisma.entryReaction.count({ where: { entryId, value: -1 } }),
    prisma.entryReaction.findUnique({
      where: { entryId_userId: { entryId, userId } },
      select: { value: true }
    })
  ]);

  return {
    likes,
    dislikes,
    myReaction: ownReaction?.value === 1 || ownReaction?.value === -1 ? ownReaction.value : 0
  };
}

export async function POST(request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const entryId = Number(id);
  const userId = Number(user.id);
  if (!Number.isInteger(entryId) || entryId <= 0) {
    return Response.json({ error: "Invalid entry" }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const value = Number(payload?.value);
  if (![1, -1, 0].includes(value)) {
    return Response.json({ error: "Invalid reaction" }, { status: 400 });
  }

  const entry = await prisma.entry.findUnique({
    where: { id: entryId },
    select: { id: true }
  });
  if (!entry) return Response.json({ error: "Not found" }, { status: 404 });

  if (value === 0) {
    await prisma.entryReaction.deleteMany({
      where: { entryId, userId }
    });
  } else {
    await prisma.entryReaction.upsert({
      where: { entryId_userId: { entryId, userId } },
      update: { value },
      create: { entryId, userId, value }
    });
  }

  return Response.json(await getReactionSummary(entryId, userId));
}
