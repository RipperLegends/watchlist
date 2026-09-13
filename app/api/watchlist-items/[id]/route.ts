import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWatchlistPlusAccessForUser } from "@/lib/watchlist-plus";

export const dynamic = "force-dynamic";

type RouteProps = {
  params: Promise<{ id: string }>;
};

function normalizeStatus(value: unknown) {
  return value === "watching" || value === "completed" ? value : "planned";
}

function normalizeNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue >= 0 ? Math.min(numberValue, 9999) : 0;
}

export async function PATCH(request: Request, { params }: RouteProps) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const plusAccess = await getWatchlistPlusAccessForUser(user.id);
  if (!plusAccess.active) {
    return Response.json({ error: "Watchlist Plus is required" }, { status: 403 });
  }

  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return Response.json({ error: "Invalid item id" }, { status: 400 });
  }

  const payload = await request.json().catch(() => null);
  const updated = await prisma.userWatchlistItem.updateMany({
    where: { id: itemId, userId: Number(user.id) },
    data: {
      status: normalizeStatus(payload?.status),
      currentSeason: normalizeNumber(payload?.currentSeason),
      currentEpisode: normalizeNumber(payload?.currentEpisode),
      note: String(payload?.note ?? "").trim().slice(0, 1000)
    }
  });
  if (!updated.count) return Response.json({ error: "Item not found" }, { status: 404 });

  const item = await prisma.userWatchlistItem.findFirstOrThrow({
    where: { id: itemId, userId: Number(user.id) },
    select: {
      id: true,
      status: true,
      currentSeason: true,
      currentEpisode: true,
      note: true,
      updatedAt: true
    }
  });

  return Response.json({ ok: true, item: { ...item, updatedAt: item.updatedAt.toISOString() } });
}

export async function DELETE(_request: Request, { params }: RouteProps) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const plusAccess = await getWatchlistPlusAccessForUser(user.id);
  if (!plusAccess.active) {
    return Response.json({ error: "Watchlist Plus is required" }, { status: 403 });
  }

  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return Response.json({ error: "Invalid item id" }, { status: 400 });
  }

  await prisma.userWatchlistItem.deleteMany({ where: { id: itemId, userId: Number(user.id) } });

  return Response.json({ ok: true });
}
