import { requireUser } from "@/lib/auth";
import { getConversationsForUser } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const conversations = await getConversationsForUser(user.id);
  return Response.json(conversations);
}
