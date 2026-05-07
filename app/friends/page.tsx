import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getFriendsForUser } from "@/lib/data";
import { FriendsClient } from "@/components/friends/friends-client";

export const dynamic = "force-dynamic";

export default async function FriendsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const friends = await getFriendsForUser(session.user.id);
  const serializableFriends = friends.map((relation) => ({
    id: relation.id,
    status: relation.status,
    friend: {
      id: relation.friend.id,
      name: relation.friend.name,
      presenceStatus: relation.friend.presenceStatus
    }
  }));

  return (
    <div className="page-shell flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="section-title">Друзі</h1>
        <p className="section-lead">Список друзів, заявки, блокування і приватність без кімнат та зайвих режимів.</p>
      </header>

      <FriendsClient initialFriends={serializableFriends} />
    </div>
  );
}
