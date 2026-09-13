import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getFriendsForUser } from "@/lib/data";

export const dynamic = "force-dynamic";

const userSelect = {
  id: true,
  name: true,
  email: true,
  presenceStatus: true,
  avatarUrl: true,
  lastSeen: true
} as const;

const relationInclude = {
  user: { select: userSelect },
  friend: { select: userSelect }
} as const;

function normalizeRelation<T extends {
  id: number;
  userId: number;
  friendId: number;
  requestedById: number;
  status: string;
  mutedByUser: boolean;
  mutedByFriend: boolean;
  blockedByUser: boolean;
  blockedByFriend: boolean;
  user: unknown;
  friend: unknown;
}>(relation: T, currentUserId: number) {
  const currentIsOwner = relation.userId === currentUserId;

  return {
    id: relation.id,
    status: relation.status,
    requestedById: relation.requestedById,
    muted: currentIsOwner ? relation.mutedByUser : relation.mutedByFriend,
    blocked: currentIsOwner ? relation.blockedByUser : relation.blockedByFriend,
    blockedByOther: currentIsOwner ? relation.blockedByFriend : relation.blockedByUser,
    friend: currentIsOwner ? relation.friend : relation.user
  };
}

async function findRelationBetween(userId: number, friendId: number) {
  return prisma.friend.findFirst({
    where: {
      OR: [
        { userId, friendId },
        { userId: friendId, friendId: userId }
      ]
    },
    include: relationInclude
  });
}

export async function GET() {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const relations = await getFriendsForUser(user.id);
  return Response.json(relations);
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const currentUserId = Number(user.id);
  const payload = await request.json().catch(() => null);
  const friendId = Number(payload?.friendId);
  if (!friendId || friendId === currentUserId) return Response.json({ error: "Invalid friend" }, { status: 400 });

  const friend = await prisma.user.findUnique({
    where: { id: friendId },
    select: { id: true, friendRequestPolicy: true, accountStatus: true }
  });
  if (!friend || friend.accountStatus === "blocked" || friend.friendRequestPolicy === "nobody") {
    return Response.json({ error: "Friend request is not allowed" }, { status: 403 });
  }

  const existing = await findRelationBetween(currentUserId, friendId);
  if (existing) {
    if (existing.blockedByFriend || existing.blockedByUser || existing.status === "blocked") {
      return Response.json({ error: "Friend request is blocked" }, { status: 403 });
    }

    if (existing.status === "pending" || existing.status === "accepted") {
      return Response.json(normalizeRelation(existing, currentUserId));
    }

    const relation = await prisma.friend.update({
      where: { id: existing.id },
      data: {
        status: "pending",
        requestedById: currentUserId,
        mutedByUser: false,
        mutedByFriend: false
      },
      include: relationInclude
    });
    revalidatePath("/friends");
    return Response.json(normalizeRelation(relation, currentUserId), { status: 201 });
  }

  const relation = await prisma.friend.create({
    data: {
      userId: currentUserId,
      friendId,
      requestedById: currentUserId,
      status: "pending"
    },
    include: relationInclude
  });

  revalidatePath("/friends");
  return Response.json(normalizeRelation(relation, currentUserId), { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const currentUserId = Number(user.id);
  const payload = await request.json().catch(() => null);
  const relationId = Number(payload?.relationId);
  const action = String(payload?.action ?? "");
  if (!relationId || !action) return Response.json({ error: "Invalid payload" }, { status: 400 });

  const relation = await prisma.friend.findFirst({
    where: {
      id: relationId,
      OR: [{ userId: currentUserId }, { friendId: currentUserId }]
    },
    include: relationInclude
  });
  if (!relation) return Response.json({ error: "Not found" }, { status: 404 });

  const currentIsOwner = relation.userId === currentUserId;
  const canAnswerRequest = relation.status === "pending" && relation.requestedById !== currentUserId;
  const canCancelRequest = relation.status === "pending" && relation.requestedById === currentUserId;

  if (action === "delete") {
    await prisma.friend.delete({ where: { id: relation.id } });
    revalidatePath("/friends");
    revalidatePath("/messages");
    return Response.json({ deleted: true, id: relation.id });
  }

  if (action === "accept" && !canAnswerRequest) return Response.json({ error: "Cannot accept this request" }, { status: 400 });
  if (action === "reject" && !canAnswerRequest) return Response.json({ error: "Cannot reject this request" }, { status: 400 });
  if (action === "cancel" && !canCancelRequest) return Response.json({ error: "Cannot cancel this request" }, { status: 400 });

  let data:
    | {
        status?: "pending" | "accepted" | "rejected" | "cancelled" | "blocked";
        mutedByUser?: boolean;
        mutedByFriend?: boolean;
        blockedByUser?: boolean;
        blockedByFriend?: boolean;
        interactions?: { increment: number };
        lastInteractionAt?: Date;
      }
    | null = null;

  if (action === "accept") {
    data = {
      status: "accepted",
      interactions: { increment: 1 },
      lastInteractionAt: new Date()
    };
  }

  if (action === "reject") data = { status: "rejected" };
  if (action === "cancel") data = { status: "cancelled" };
  if (action === "mute") data = currentIsOwner ? { mutedByUser: true } : { mutedByFriend: true };
  if (action === "unmute") data = currentIsOwner ? { mutedByUser: false } : { mutedByFriend: false };
  if (action === "block") {
    data = currentIsOwner
      ? { status: "blocked", blockedByUser: true }
      : { status: "blocked", blockedByFriend: true };
  }
  if (action === "unblock") {
    const blockedByUser = currentIsOwner ? false : relation.blockedByUser;
    const blockedByFriend = currentIsOwner ? relation.blockedByFriend : false;
    data = {
      status: blockedByUser || blockedByFriend ? "blocked" : "accepted",
      blockedByUser,
      blockedByFriend
    };
  }

  if (!data) return Response.json({ error: "Unknown action" }, { status: 400 });

  const updated = await prisma.friend.update({
    where: { id: relation.id },
    data,
    include: relationInclude
  });

  revalidatePath("/friends");
  revalidatePath("/messages");
  revalidatePath("/settings");
  return Response.json(normalizeRelation(updated, currentUserId));
}
