import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFriendsForUser } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get accepted friends
  const relations = await getFriendsForUser(user.id);
  const acceptedFriendsIds = relations
    .filter((r) => r.status === "accepted" && !r.blocked && !r.blockedByOther)
    .map((r) => r.friend.id);

  if (acceptedFriendsIds.length === 0) {
    return Response.json([]);
  }

  // Fetch recent watchlist updates from friends
  const activities = await prisma.userWatchlistItem.findMany({
    where: {
      userId: { in: acceptedFriendsIds }
    },
    include: {
      user: {
        select: { id: true, name: true, avatarUrl: true }
      },
      entry: {
        select: { id: true, title: true, type: true, posterUrl: true, rating: true, year: true }
      }
    },
    orderBy: { updatedAt: "desc" },
    take: 20
  });

  return Response.json(activities);
}
