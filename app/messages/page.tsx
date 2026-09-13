import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getConversationsForUser } from "@/lib/data";
import { MessagesClient } from "@/components/messages/messages-client";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const user = await requireUser();
  if (!user) redirect("/login");
  const conversations = await getConversationsForUser(user.id);

  return (
    <div className="page-shell flex flex-col gap-8">
      <header>
        <h1 className="section-title">Повідомлення</h1>
        <p className="section-lead">Тут можна перемикатись між діалогами друзів. Реакції прибрані, щоб чат лишався простим.</p>
      </header>
      <MessagesClient conversations={conversations} currentUserId={user.id} />
    </div>
  );
}
