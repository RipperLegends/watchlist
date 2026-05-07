import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await request.json().catch(() => null);
  const friendId = Number(payload?.friendId);
  if (!friendId || friendId === Number(user.id)) return Response.json({ error: "Invalid friend" }, { status: 400 });

  const friend = await prisma.user.findUnique({
    where: { id: friendId },
    select: { id: true, name: true, presenceStatus: true, friendRequestPolicy: true, accountStatus: true }
  });
  if (!friend || friend.accountStatus === "blocked" || friend.friendRequestPolicy === "nobody") {
    return Response.json({ error: "Friend request is not allowed" }, { status: 403 });
  }

  const relation = await prisma.friend.upsert({
    where: { userId_friendId: { userId: Number(user.id), friendId } },
    update: {
      status: "pending",
      requestedById: Number(user.id),
      blockedByUser: false,
      blockedByFriend: false
    },
    create: {
      userId: Number(user.id),
      friendId,
      requestedById: Number(user.id),
      status: "pending"
    },
    include: {
      friend: {
        select: {
          id: true,
          name: true,
          presenceStatus: true,
          avatarUrl: true,
          lastSeen: true,
          email: true
        }
      }
    }
  });

  return Response.json(relation, { status: 201 });
}
