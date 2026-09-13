import { prisma } from "@/lib/prisma";

type WatchlistPlusUser = {
  role: "user" | "admin";
  watchlistPlusLifetime: boolean;
  watchlistPlusUntil: Date | null;
};

export type WatchlistPlusAccess = {
  active: boolean;
  lifetime: boolean;
  expiresAt: string | null;
  label: string;
};

export function resolveWatchlistPlusAccess(user: WatchlistPlusUser | null | undefined): WatchlistPlusAccess {
  if (!user) {
    return { active: false, lifetime: false, expiresAt: null, label: "Plus не активний" };
  }

  if (user.role === "admin") {
    return { active: true, lifetime: true, expiresAt: null, label: "Plus доступний для адміністратора" };
  }

  if (user.watchlistPlusLifetime) {
    return { active: true, lifetime: true, expiresAt: null, label: "Plus активний назавжди" };
  }

  const expiresAt = user.watchlistPlusUntil;
  if (expiresAt && expiresAt.getTime() > Date.now()) {
    return {
      active: true,
      lifetime: false,
      expiresAt: expiresAt.toISOString(),
      label: `Plus активний до ${expiresAt.toLocaleDateString("uk-UA")}`
    };
  }

  return {
    active: false,
    lifetime: false,
    expiresAt: expiresAt?.toISOString() ?? null,
    label: expiresAt ? `Plus завершився ${expiresAt.toLocaleDateString("uk-UA")}` : "Plus не активний"
  };
}

export async function getWatchlistPlusAccessForUser(userId: string | number | null | undefined) {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) return resolveWatchlistPlusAccess(null);

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      role: true,
      watchlistPlusLifetime: true,
      watchlistPlusUntil: true
    }
  });

  return resolveWatchlistPlusAccess(user);
}
