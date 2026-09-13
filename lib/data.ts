import type { EntryStatus, EntryType, Prisma, ReportStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getWatchlistPlusAccessForUser } from "@/lib/watchlist-plus";

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
  likes: number;
  dislikes: number;
  myReaction: -1 | 0 | 1;
  myWatchlistItem: {
    id: number;
    status: EntryStatus;
    currentSeason: number;
    currentEpisode: number;
    note: string;
  } | null;
  createdAt: string;
};

const normalizeStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return [];
};

export async function getEntriesForUser(userId?: string | number | null): Promise<CatalogEntry[]> {
  if (!userId) return [];
  const entries = await prisma.entry.findMany({
    where: { userId: Number(userId), type: { in: ["movie", "series"] } },
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
    likes: 0,
    dislikes: 0,
    myReaction: 0,
    myWatchlistItem: null,
    createdAt: entry.createdAt.toISOString()
  }));
}

export async function getCatalogEntries(userId?: string | number | null, take?: number, skip?: number): Promise<CatalogEntry[]> {
  const entries = await prisma.entry.findMany({
    where: { type: { in: ["movie", "series"] } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    ...(take ? { take } : {}),
    ...(skip ? { skip } : {})
  });

  const entryIds = entries.map((entry) => entry.id);
  const currentUserId = userId == null ? null : Number(userId);
  const plusAccess = await getWatchlistPlusAccessForUser(currentUserId);
  const [reactionGroups, ownReactions, ownWatchlistItems] = entryIds.length
    ? await Promise.all([
        prisma.entryReaction.groupBy({
          by: ["entryId", "value"],
          where: { entryId: { in: entryIds } },
          _count: { _all: true }
        }),
        Number.isInteger(currentUserId)
          ? prisma.entryReaction.findMany({
              where: { entryId: { in: entryIds }, userId: Number(currentUserId) },
              select: { entryId: true, value: true }
            })
          : [],
        Number.isInteger(currentUserId) && plusAccess.active
          ? prisma.userWatchlistItem.findMany({
              where: { entryId: { in: entryIds }, userId: Number(currentUserId) },
              select: { id: true, entryId: true, status: true, currentSeason: true, currentEpisode: true, note: true }
            })
          : []
      ])
    : [[], [], []];

  const reactionCounts = new Map<number, { likes: number; dislikes: number }>();
  for (const group of reactionGroups) {
    const current = reactionCounts.get(group.entryId) ?? { likes: 0, dislikes: 0 };
    if (group.value === 1) current.likes = group._count._all;
    if (group.value === -1) current.dislikes = group._count._all;
    reactionCounts.set(group.entryId, current);
  }

  const ownReactionByEntry = new Map(ownReactions.map((reaction) => [reaction.entryId, reaction.value]));
  const ownWatchlistByEntry = new Map(ownWatchlistItems.map((item) => [item.entryId, item]));

  return entries.map((entry) => {
    const counts = reactionCounts.get(entry.id) ?? { likes: 0, dislikes: 0 };
    const myReaction = ownReactionByEntry.get(entry.id);
    const myWatchlistItem = ownWatchlistByEntry.get(entry.id) ?? null;
    return {
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
      likes: counts.likes,
      dislikes: counts.dislikes,
      myReaction: myReaction === 1 || myReaction === -1 ? myReaction : 0,
      myWatchlistItem: myWatchlistItem
        ? {
            id: myWatchlistItem.id,
            status: myWatchlistItem.status,
            currentSeason: myWatchlistItem.currentSeason,
            currentEpisode: myWatchlistItem.currentEpisode,
            note: myWatchlistItem.note
          }
        : null,
      createdAt: entry.createdAt.toISOString()
    };
  });
}

export async function getDashboardStats(userId?: string | number | null) {
  const [total, completed, watching, avgAgg] = await Promise.all([
    prisma.entry.count({ where: { type: { in: ["movie", "series"] } } }),
    prisma.entry.count({ where: { type: { in: ["movie", "series"] }, status: "completed" } }),
    prisma.entry.count({ where: { type: { in: ["movie", "series"] }, status: "watching" } }),
    prisma.entry.aggregate({
      where: { type: { in: ["movie", "series"] } },
      _avg: { rating: true }
    })
  ]);

  const recent = await getCatalogEntries(userId, 4);

  return {
    total,
    completed,
    watching,
    avgRating: Number((avgAgg._avg.rating ?? 0).toFixed(1)),
    recent
  };
}

export async function getAdminOverview() {
  const [users, entries, reports, blocked, teams, auditLogs] = await Promise.all([
    prisma.user.count(),
    prisma.entry.count({ where: { type: { in: ["movie", "series"] } } }),
    prisma.report.count({ where: { status: { in: ["new", "reviewing"] } } }),
    prisma.user.count({ where: { accountStatus: "blocked" } }),
    prisma.team.count(),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { user: { select: { name: true } } }
    })
  ]);

  return { users, entries, reports, blocked, teams, auditLogs };
}

export async function getAdminUsers(filter?: UserRole | "all" | "blocked") {
  return prisma.user.findMany({
    where: filter === "blocked" ? { accountStatus: "blocked" } : filter && filter !== "all" ? { role: filter } : {},
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      accountStatus: true,
      preferredLanguage: true,
      watchlistPlusLifetime: true,
      watchlistPlusUntil: true,
      createdAt: true,
      _count: {
        select: {
          entries: true,
          reports: true
        }
      }
    }
  });
}

export type AdminEntryFilters = {
  query?: string;
  type?: "all" | Extract<EntryType, "movie" | "series">;
  status?: "all" | EntryStatus;
  rating?: "all" | number;
  sort?: "catalog" | "newest" | "rating_desc" | "rating_asc";
  page?: number;
  pageSize?: number;
};

export async function getAdminEntries(filters: AdminEntryFilters = {}) {
  const pageSize = Math.min(Math.max(filters.pageSize ?? 25, 10), 60);
  const query = filters.query?.trim();
  const where: Prisma.EntryWhereInput = {
    type: { in: ["movie", "series"] }
  };

  if (filters.type === "movie" || filters.type === "series") {
    where.type = filters.type;
  }

  if (typeof filters.rating === "number" && filters.rating >= 1 && filters.rating <= 5) {
    where.rating = filters.rating;
  }

  if (filters.status === "planned" || filters.status === "watching" || filters.status === "completed") {
    where.status = filters.status;
  }

  if (query) {
    where.OR = [
      { title: { contains: query, mode: "insensitive" } },
      { comment: { contains: query, mode: "insensitive" } }
    ];
  }

  const total = await prisma.entry.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(filters.page ?? 1, 1), totalPages);
  const skip = (page - 1) * pageSize;
  const orderBy: Prisma.EntryOrderByWithRelationInput[] =
    filters.sort === "newest"
      ? [{ createdAt: "desc" }]
      : filters.sort === "rating_desc"
        ? [{ rating: "desc" }, { sortOrder: "asc" }]
        : filters.sort === "rating_asc"
          ? [{ rating: "asc" }, { sortOrder: "asc" }]
          : [{ sortOrder: "asc" }, { createdAt: "desc" }];
  const entries = await prisma.entry.findMany({
    where,
    orderBy,
    skip,
    take: pageSize,
    include: {
      user: { select: { id: true, name: true, email: true } }
    }
  });

  return {
    entries,
    total,
    page,
    totalPages,
    pageSize,
    showingFrom: total ? skip + 1 : 0,
    showingTo: skip + entries.length
  };
}

export async function getReportsForAdmin(status?: ReportStatus | "all") {
  return prisma.report.findMany({
    where: status && status !== "all" ? { status } : {},
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          sender: { select: { name: true } },
          attachments: true
        }
      },
      attachments: true
    }
  });
}

type OrphanRow = {
  key: string;
  count: bigint;
};

export async function getMaintenanceStatus() {
  const rows = await prisma.$queryRaw<OrphanRow[]>`
    select 'entries_without_user' as key, count(*)::bigint as count
    from entries e
    left join users u on u.id = e.user_id
    where u.id is null
    union all
    select 'friends_without_user' as key, count(*)::bigint as count
    from friends f
    left join users u on u.id = f.user_id
    left join users fr on fr.id = f.friend_id
    left join users rb on rb.id = f.requested_by
    where u.id is null or fr.id is null or rb.id is null
    union all
    select 'messages_without_relation' as key, count(*)::bigint as count
    from friend_messages m
    left join friends f on f.id = m.relation_id
    left join users s on s.id = m.sender_id
    left join users r on r.id = m.receiver_id
    where f.id is null or s.id is null or r.id is null
    union all
    select 'reports_without_user' as key, count(*)::bigint as count
    from reports r
    left join users u on u.id = r.user_id
    where r.user_id is not null and u.id is null
    union all
    select 'report_messages_without_parent' as key, count(*)::bigint as count
    from report_messages rm
    left join reports r on r.id = rm.report_id
    left join users u on u.id = rm.sender_id
    where r.id is null or (rm.sender_id is not null and u.id is null)
    union all
    select 'teams_without_owner' as key, count(*)::bigint as count
    from teams t
    left join users u on u.id = t.owner_id
    where u.id is null
    union all
    select 'team_members_without_parent' as key, count(*)::bigint as count
    from team_members tm
    left join teams t on t.id = tm.team_id
    left join users u on u.id = tm.user_id
    where t.id is null or u.id is null
    union all
    select 'team_items_without_parent' as key, count(*)::bigint as count
    from team_items ti
    left join teams t on t.id = ti.team_id
    left join users u on u.id = ti.created_by
    where t.id is null or u.id is null
    union all
    select 'team_votes_without_parent' as key, count(*)::bigint as count
    from team_votes tv
    left join team_items ti on ti.id = tv.item_id
    left join users u on u.id = tv.user_id
    where ti.id is null or u.id is null
    union all
    select 'watchlist_items_without_parent' as key, count(*)::bigint as count
    from user_watchlist_items wi
    left join users u on u.id = wi.user_id
    left join entries e on e.id = wi.entry_id
    where u.id is null or e.id is null
  `;

  const items = rows.map((row) => ({
    key: row.key,
    count: Number(row.count)
  }));

  return {
    items,
    total: items.reduce((sum, item) => sum + item.count, 0)
  };
}

export async function getFriendsForUser(userId?: string | number | null) {
  if (!userId) return [];
  const currentUserId = Number(userId);
  const relations = await prisma.friend.findMany({
    where: {
      OR: [
        { userId: currentUserId },
        { friendId: currentUserId }
      ]
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          presenceStatus: true,
          lastSeen: true,
          avatarUrl: true
        }
      },
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

  return relations.map((relation) => {
    const currentIsOwner = relation.userId === currentUserId;
    const friend = currentIsOwner ? relation.friend : relation.user;

    return {
      id: relation.id,
      status: relation.status,
      requestedById: relation.requestedById,
      muted: currentIsOwner ? relation.mutedByUser : relation.mutedByFriend,
      blocked: currentIsOwner ? relation.blockedByUser : relation.blockedByFriend,
      blockedByOther: currentIsOwner ? relation.blockedByFriend : relation.blockedByUser,
      friend
    };
  });
}

export async function getConversationsForUser(userId?: string | number | null) {
  if (!userId) return [];
  const currentUserId = Number(userId);
  const relations = await prisma.friend.findMany({
    where: {
      OR: [
        { userId: currentUserId },
        { friendId: currentUserId }
      ],
      status: "accepted",
      blockedByFriend: false,
      blockedByUser: false
    },
    include: {
      user: { select: { id: true, name: true, presenceStatus: true, avatarUrl: true } },
      friend: { select: { id: true, name: true, presenceStatus: true, avatarUrl: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 50
      }
    },
    orderBy: { updatedAt: "desc" }
  });

  return relations.map((relation) => ({
    id: relation.id,
    friend: relation.userId === currentUserId ? relation.friend : relation.user,
    messages: relation.messages.reverse().map((message) => ({
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
}
