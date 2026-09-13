import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { broadcastToTopic } from "@/lib/supabase-realtime-server";

const presenceStatuses = new Set(["online", "offline", "dnd", "hidden"]);

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await request.json().catch(() => null);
  const requestedStatus = String(payload?.status || "online");
  const presenceStatus = presenceStatuses.has(requestedStatus) ? requestedStatus : "online";
  const currentUser = await prisma.user.findUnique({
    where: { id: Number(user.id) },
    select: { presenceStatus: true }
  });
  const manualStatus = currentUser?.presenceStatus === "dnd" || currentUser?.presenceStatus === "hidden"
    ? currentUser.presenceStatus
    : null;
  const storedPresenceStatus = manualStatus ?? presenceStatus;

  await prisma.user.update({
    where: { id: Number(user.id) },
    data: {
      presenceStatus: storedPresenceStatus as "online" | "offline" | "dnd" | "hidden",
      lastSeen: new Date()
    }
  });

  await broadcastToTopic("watchlist:presence", "presence_status", {
    userId: Number(user.id),
    presenceStatus: storedPresenceStatus,
    at: new Date().toISOString()
  }).catch(() => undefined);

  return Response.json({ ok: true, presenceStatus: storedPresenceStatus });
}
