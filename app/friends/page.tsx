import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getFriendsForUser } from "@/lib/data";
import { prisma } from "@/lib/prisma";
import { FriendsClient } from "@/components/friends/friends-client";

export const dynamic = "force-dynamic";

export default async function FriendsPage() {
  const user = await requireUser();
  if (!user) redirect("/login");
  const friends = await getFriendsForUser(user.id);
  const serializableFriends = friends.map((relation) => ({
    id: relation.id,
    status: relation.status,
    requestedById: relation.requestedById,
    muted: relation.muted,
    blocked: relation.blocked,
    blockedByOther: relation.blockedByOther,
    friend: {
      id: relation.friend.id,
      name: relation.friend.name,
      email: relation.friend.email,
      presenceStatus: relation.friend.presenceStatus,
      avatarUrl: relation.friend.avatarUrl
    }
  }));

  const acceptedFriendsIds = friends
    .filter((r) => r.status === "accepted" && !r.blocked && !r.blockedByOther)
    .map((r) => r.friend.id);

  const activitiesRaw = acceptedFriendsIds.length > 0 ? await prisma.userWatchlistItem.findMany({
    where: { userId: { in: acceptedFriendsIds } },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
      entry: { select: { id: true, title: true, type: true, posterUrl: true, rating: true, year: true } }
    },
    orderBy: { updatedAt: "desc" },
    take: 20
  }) : [];

  // Серіалізація дат
  const activities = activitiesRaw.map(act => ({
    ...act,
    createdAt: act.createdAt.toISOString(),
    updatedAt: act.updatedAt.toISOString(),
  }));

  return (
    <div className="page-shell flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="section-title">Друзі</h1>
        <p className="section-lead">Список друзів, заявки, блокування і приватність без кімнат та зайвих режимів.</p>
      </header>

      <FriendsClient initialFriends={serializableFriends} currentUserId={Number(user.id)} initialActivities={activities} />
    </div>
  );
}
