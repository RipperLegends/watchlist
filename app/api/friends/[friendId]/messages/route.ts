import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { messageSchema } from "@/lib/validators";

type RouteContext = {
  params: Promise<{ friendId: string }>;
};

async function getAcceptedRelation(userId: number, friendId: number) {
  return prisma.friend.findFirst({
    where: {
      userId,
      friendId,
      status: "accepted",
      blockedByFriend: false,
      blockedByUser: false
    }
  });
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { friendId } = await context.params;
  const relation = await getAcceptedRelation(Number(user.id), Number(friendId));
  if (!relation) return Response.json({ error: "Not found" }, { status: 404 });

  const messages = await prisma.friendMessage.findMany({
    where: { relationId: relation.id },
    orderBy: { createdAt: "asc" }
  });

  return Response.json(messages);
}

export async function POST(request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { friendId } = await context.params;
  const payload = await request.json().catch(() => null);
  const parsed = messageSchema.safeParse(payload);
  if (!parsed.success) return Response.json({ error: "Invalid payload" }, { status: 400 });

  const relation = await getAcceptedRelation(Number(user.id), Number(friendId));
  if (!relation) return Response.json({ error: "Not found" }, { status: 404 });

  const message = await prisma.friendMessage.create({
    data: {
      relationId: relation.id,
      senderId: Number(user.id),
      receiverId: Number(friendId),
      body: parsed.data.body,
      contentTitle: parsed.data.contentTitle,
      contentUrl: parsed.data.contentUrl
    }
  });

  await prisma.friend.update({
    where: { id: relation.id },
    data: {
      messagesCount: { increment: 1 },
      interactions: { increment: 1 },
      lastInteractionAt: new Date()
    }
  });

  return Response.json({
    id: message.id,
    senderId: message.senderId,
    receiverId: message.receiverId,
    body: message.body,
    contentTitle: message.contentTitle,
    contentUrl: message.contentUrl,
    readAt: message.readAt?.toISOString() ?? null,
    createdAt: message.createdAt.toISOString()
  }, { status: 201 });
}
