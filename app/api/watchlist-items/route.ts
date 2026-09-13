import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWatchlistPlusAccessForUser } from "@/lib/watchlist-plus";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const plusAccess = await getWatchlistPlusAccessForUser(user.id);
  if (!plusAccess.active) {
    return Response.json({ error: "Watchlist Plus is required" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  const entryId = Number(payload?.entryId);
  if (!Number.isInteger(entryId) || entryId <= 0) {
    return Response.json({ error: "Entry id is required" }, { status: 400 });
  }

  const entry = await prisma.entry.findFirst({
    where: { id: entryId, type: { in: ["movie", "series"] } },
    select: { id: true }
  });
  if (!entry) return Response.json({ error: "Entry not found" }, { status: 404 });

  const item = await prisma.userWatchlistItem.upsert({
    where: { userId_entryId: { userId: Number(user.id), entryId } },
    update: {},
    create: {
      userId: Number(user.id),
      entryId,
      status: "planned"
    },
    select: {
      id: true,
      status: true,
      currentSeason: true,
      currentEpisode: true,
      note: true
    }
  });

  return Response.json({ ok: true, item });
}
