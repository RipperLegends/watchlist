import { requireUser } from "@/lib/auth";
import { getFriendsForUser } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const relations = await getFriendsForUser(user.id);
  const acceptedFriends = relations
    .filter((relation) => relation.status === "accepted" && !relation.blocked && !relation.blockedByOther)
    .map((relation) => ({
      relationId: relation.id,
      friendId: relation.friend.id,
      name: relation.friend.name,
      avatarUrl: relation.friend.avatarUrl || "",
      presenceStatus: relation.friend.presenceStatus
    }));

  return Response.json(acceptedFriends);
}
