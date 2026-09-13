import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { broadcastToUser } from "@/lib/supabase-realtime-server";

type RouteContext = {
  params: Promise<{ friendId: string }>;
};

async function getAcceptedRelation(userId: number, friendId: number) {
  return prisma.friend.findFirst({
    where: {
      OR: [
        { userId, friendId },
        { userId: friendId, friendId: userId }
      ],
      status: "accepted",
      blockedByFriend: false,
      blockedByUser: false
    },
    select: { id: true }
  });
}

export async function POST(request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { friendId } = await context.params;
  const targetId = Number(friendId);
  if (!Number.isInteger(targetId) || targetId < 1 || targetId === Number(user.id)) {
    return Response.json({ error: "Invalid friend" }, { status: 400 });
  }

  const relation = await getAcceptedRelation(Number(user.id), targetId);
  if (!relation) return Response.json({ error: "Not found" }, { status: 404 });

  const payload = await request.json().catch(() => null);
  const isTyping = Boolean(payload?.isTyping);

  await broadcastToUser(targetId, "typing", {
    relationId: relation.id,
    fromUserId: Number(user.id),
    name: user.name,
    isTyping,
    at: new Date().toISOString()
  }).catch(() => undefined);

  return Response.json({ ok: true });
}
