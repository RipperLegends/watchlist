import { cache } from "react";
import type { EntryStatus, EntryType, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CatalogEntry = {
  id: number;
  title: string;
  type: EntryType;
  status: EntryStatus;
  rating: number;
  year: number | null;
  genre: string[];
  tags: string[];
  mood: string;
  posterUrl: string;
  comment: string;
  currentSeason: number;
  currentEpisode: number;
  isFavorite: boolean;
  createdAt: string;
};

const normalizeStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return [];
};

export const getEntriesForUser = cache(async (userId?: string | number | null): Promise<CatalogEntry[]> => {
  if (!userId) return [];
  const entries = await prisma.entry.findMany({
    where: { userId: Number(userId) },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }]
  });

  return entries.map((entry) => ({
    id: entry.id,
    title: entry.title,
    type: entry.type,
    status: entry.status,
    rating: entry.rating,
    year: entry.year,
    genre: normalizeStringArray(entry.genre),
    tags: normalizeStringArray(entry.tags),
    mood: entry.mood,
    posterUrl: entry.posterUrl,
    comment: entry.comment,
    currentSeason: entry.currentSeason,
    currentEpisode: entry.currentEpisode,
    isFavorite: entry.isFavorite,
    createdAt: entry.createdAt.toISOString()
  }));
});

export const getDashboardStats = cache(async (userId?: string | number | null) => {
  const entries = await getEntriesForUser(userId);
  const total = entries.length;
  const completed = entries.filter((entry) => entry.status === "completed").length;
  const watching = entries.filter((entry) => entry.status === "watching").length;
  const avgRating = total ? entries.reduce((sum, entry) => sum + entry.rating, 0) / total : 0;

  return {
    total,
    completed,
    watching,
    avgRating: Number(avgRating.toFixed(1)),
    recent: entries.slice(0, 4)
  };
});

export const getAdminOverview = cache(async () => {
  const [users, entries, reports, blocked, auditLogs] = await Promise.all([
    prisma.user.count(),
    prisma.entry.count(),
    prisma.report.count({ where: { status: { in: ["new", "reviewing"] } } }),
    prisma.user.count({ where: { accountStatus: "blocked" } }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { user: { select: { name: true } } }
    })
  ]);

  return { users, entries, reports, blocked, auditLogs };
});

export const getAdminUsers = cache(async (role?: UserRole | "all") => {
  return prisma.user.findMany({
    where: role && role !== "all" ? { role } : {},
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      accountStatus: true,
      preferredLanguage: true,
      createdAt: true,
      _count: {
        select: {
          entries: true,
          reports: true
        }
      }
    }
  });
});

export const getReportsForAdmin = cache(async () => {
  return prisma.report.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { sender: { select: { name: true } } }
      }
    }
  });
});

export const getFriendsForUser = cache(async (userId?: string | number | null) => {
  if (!userId) return [];
  return prisma.friend.findMany({
    where: { userId: Number(userId) },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: {
      friend: {
        select: {
          id: true,
          name: true,
          email: true,
          presenceStatus: true,
          lastSeen: true,
          avatarUrl: true
        }
      }
    }
  });
});

export const getConversationsForUser = cache(async (userId?: string | number | null) => {
  if (!userId) return [];
  const relations = await prisma.friend.findMany({
    where: {
      userId: Number(userId),
      status: "accepted",
      blockedByFriend: false,
      blockedByUser: false
    },
    include: {
      friend: { select: { id: true, name: true, presenceStatus: true, avatarUrl: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 50
      }
    },
    orderBy: { updatedAt: "desc" }
  });

  return relations.map((relation) => ({
    id: relation.id,
    friend: relation.friend,
    messages: relation.messages.map((message) => ({
      id: message.id,
      senderId: message.senderId,
      receiverId: message.receiverId,
      body: message.body,
      contentTitle: message.contentTitle,
      contentUrl: message.contentUrl,
      readAt: message.readAt?.toISOString() ?? null,
      createdAt: message.createdAt.toISOString()
    }))
  }));
});
