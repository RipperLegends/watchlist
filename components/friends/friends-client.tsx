"use client";

import * as React from "react";
import Link from "next/link";
import { MessageCircle, ShieldOff, UserCheck, UserMinus, UserPlus, X, MoreVertical } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FriendActivityFeed, type Activity } from "@/components/friends/activity-feed";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { subscribeWatchlistRealtime } from "@/lib/supabase-realtime-browser";
import { initials } from "@/lib/utils";

type FriendRelation = {
  id: number;
  status: string;
  requestedById: number;
  muted: boolean;
  blocked: boolean;
  blockedByOther: boolean;
  friend: {
    id: number;
    name: string;
    email: string;
    presenceStatus: string;
    avatarUrl?: string;
  };
};

type SearchUser = {
  id: number;
  name: string;
  email: string;
};

type FriendAction = "accept" | "reject" | "cancel" | "delete" | "block" | "unblock" | "mute" | "unmute";

const statusLabel: Record<string, string> = {
  online: "Онлайн",
  offline: "Офлайн",
  dnd: "Не турбувати",
  hidden: "Прихований"
};

function FriendRow({
  relation,
  onlineUsers,
  children
}: {
  relation: FriendRelation;
  onlineUsers: Set<number>;
  children: React.ReactNode;
}) {
  const status = relation.friend.presenceStatus === "hidden" || relation.friend.presenceStatus === "dnd"
    ? relation.friend.presenceStatus
    : onlineUsers.has(relation.friend.id)
      ? "online"
      : relation.friend.presenceStatus;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4 transition-colors hover:bg-muted/50">
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative">
          <Avatar>
            {relation.friend.avatarUrl ? <AvatarImage src={relation.friend.avatarUrl} alt={relation.friend.name} /> : null}
            <AvatarFallback>{initials(relation.friend.name)}</AvatarFallback>
          </Avatar>
          {status === "online" && (
            <span className="absolute bottom-0 right-0 z-10 size-3 rounded-full bg-green-500 ring-2 ring-background" title="Online" />
          )}
          {status === "dnd" && (
            <span className="absolute bottom-0 right-0 z-10 size-3 rounded-full bg-red-500 ring-2 ring-background" title="Do Not Disturb" />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-bold">{relation.friend.name}</p>
          <p className="truncate text-sm text-muted-foreground">
            {statusLabel[status] ?? status}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function FriendsClient({
  initialFriends,
  currentUserId,
  initialActivities = []
}: {
  initialFriends: FriendRelation[];
  currentUserId: number;
  initialActivities?: Activity[];
}) {
  const [friends, setFriends] = React.useState(initialFriends);
  const [activities, setActivities] = React.useState(initialActivities);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchUser[]>([]);
  const [notice, setNotice] = React.useState("");
  const [onlineUserIds, setOnlineUserIds] = React.useState<Set<number>>(new Set());
  const [isPending, startTransition] = React.useTransition();

  const accepted = friends.filter((relation) => relation.status === "accepted" && !relation.blocked && !relation.blockedByOther);
  const incoming = friends.filter((relation) => relation.status === "pending" && relation.requestedById !== currentUserId);
  const sent = friends.filter((relation) => relation.status === "pending" && relation.requestedById === currentUserId);
  const blocked = friends.filter((relation) => relation.status === "blocked" || relation.blocked || relation.blockedByOther);

  const refreshFriends = React.useCallback(async () => {
    const response = await fetch("/api/friends/requests", { cache: "no-store" });
    if (!response.ok) return;
    setFriends((await response.json()) as FriendRelation[]);
  }, []);

  React.useEffect(() => {
    let cleanup: () => void = () => undefined;
    let mounted = true;

    subscribeWatchlistRealtime(currentUserId, (event) => {
      if (!mounted) return;
      if (event.type === "friend_relation" || event.type === "friend_message") {
        void refreshFriends();
      }
      if (event.type === "presence_sync" && Array.isArray(event.onlineUserIds)) {
        setOnlineUserIds(new Set(event.onlineUserIds.map(Number).filter((id) => Number.isInteger(id) && id > 0)));
      }
      if (event.type === "presence_status") {
        const userId = Number(event.userId);
        const nextStatus = String(event.presenceStatus || "");
        if (Number.isInteger(userId) && userId > 0) {
          setFriends((current) =>
            current.map((relation) =>
              relation.friend.id === userId ? { ...relation, friend: { ...relation.friend, presenceStatus: nextStatus } } : relation
            )
          );
        }
      }
    }).then((unsubscribe) => {
      cleanup = unsubscribe;
    });

    return () => {
      mounted = false;
      cleanup();
    };
  }, [currentUserId, refreshFriends]);

  function upsertRelation(relation: FriendRelation) {
    setFriends((current) => {
      const exists = current.some((item) => item.id === relation.id);
      return exists ? current.map((item) => (item.id === relation.id ? relation : item)) : [relation, ...current];
    });
  }

  function searchUsers() {
    const term = query.trim();
    if (term.length < 2) return;
    setNotice("");
    startTransition(async () => {
      const response = await fetch(`/api/friends/search?q=${encodeURIComponent(term)}`);
      if (!response.ok) return;
      const found = (await response.json()) as SearchUser[];
      const relatedIds = new Set(
        friends
          .filter((relation) => relation.status !== "cancelled" && relation.status !== "rejected")
          .map((relation) => relation.friend.id)
      );
      setResults(found.filter((user) => !relatedIds.has(user.id)));
    });
  }

  function sendRequest(friendId: number) {
    setNotice("");
    startTransition(async () => {
      const response = await fetch("/api/friends/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setNotice(payload?.error ?? "Не вдалося надіслати заявку.");
        return;
      }
      upsertRelation(payload as FriendRelation);
      setResults((current) => current.filter((user) => user.id !== friendId));
      setNotice("Заявку надіслано.");
    });
  }

  function runAction(relationId: number, action: FriendAction) {
    setNotice("");
    startTransition(async () => {
      const response = await fetch("/api/friends/requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relationId, action })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setNotice(payload?.error ?? "Дію не виконано.");
        return;
      }
      if (payload?.deleted) {
        setFriends((current) => current.filter((relation) => relation.id !== payload.id));
        return;
      }
      if (payload?.status === "cancelled" || payload?.status === "rejected") {
        setFriends((current) => current.filter((relation) => relation.id !== payload.id));
        return;
      }
      upsertRelation(payload as FriendRelation);
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
      <div className="flex flex-col gap-5">
        <Tabs defaultValue="activity" className="w-full">
          <TabsList className="mb-4 grid w-full grid-cols-4">
            <TabsTrigger value="activity">Активність</TabsTrigger>
            <TabsTrigger value="friends">Друзі ({accepted.length})</TabsTrigger>
            <TabsTrigger value="requests">
              Заявки {incoming.length > 0 && <Badge variant="destructive" className="ml-2 size-5 items-center justify-center rounded-full p-0 text-[10px]">{incoming.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="blocked">Заблоковані</TabsTrigger>
          </TabsList>

          <TabsContent value="activity">
            <FriendActivityFeed activities={activities} />
          </TabsContent>

          <TabsContent value="friends">
            <Card>
              <CardHeader>
                <CardTitle>Список друзів</CardTitle>
                <CardDescription>Спілкуйтесь, додавайте в команди або керуйте доступом.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {accepted.length ? (
                  accepted.map((relation) => (
                    <FriendRow key={relation.id} relation={relation} onlineUsers={onlineUserIds}>
                      <Button asChild size="sm" variant="default">
                        <Link href="/messages">
                          <MessageCircle data-icon="inline-start" className="size-4 mr-2" />
                          Написати
                        </Link>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="size-8 rounded-full">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => runAction(relation.id, relation.muted ? "unmute" : "mute")} disabled={isPending}>
                            {relation.muted ? "Увімкнути сповіщення" : "Вимкнути сповіщення (Мут)"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => runAction(relation.id, "block")} disabled={isPending} className="text-destructive focus:text-destructive">
                            Заблокувати
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => runAction(relation.id, "delete")} disabled={isPending} className="text-destructive focus:text-destructive">
                            <UserMinus className="size-4 mr-2" />
                            Видалити з друзів
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </FriendRow>
                  ))
                ) : (
                  <EmptyState title="У вас ще немає друзів" description="Знайдіть когось за нікнеймом, щоб додати у свій список." />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requests">
            <Card>
              <CardHeader>
                <CardTitle>Заявки у друзі</CardTitle>
                <CardDescription>Приймайте або відхиляйте запити.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <section className="flex flex-col gap-3">
                  <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Вхідні заявки</h3>
                  {incoming.length ? incoming.map((relation) => (
                    <FriendRow key={relation.id} relation={relation} onlineUsers={onlineUserIds}>
                      <Button size="sm" onClick={() => runAction(relation.id, "accept")} disabled={isPending} className="bg-green-600 hover:bg-green-700 text-white">
                        <UserCheck className="size-4 mr-2" />
                        Прийняти
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => runAction(relation.id, "reject")} disabled={isPending}>
                        Відхилити
                      </Button>
                    </FriendRow>
                  )) : <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground text-center">Нових заявок немає.</p>}
                </section>
                <section className="flex flex-col gap-3">
                  <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider">Надіслані вами</h3>
                  {sent.length ? sent.map((relation) => (
                    <FriendRow key={relation.id} relation={relation} onlineUsers={onlineUserIds}>
                      <Badge variant="secondary">Очікує відповіді</Badge>
                      <Button size="sm" variant="outline" onClick={() => runAction(relation.id, "cancel")} disabled={isPending}>
                        <X className="size-4 mr-2" />
                        Скасувати
                      </Button>
                    </FriendRow>
                  )) : <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground text-center">Ви ще не надсилали заявок.</p>}
                </section>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="blocked">
            <Card>
              <CardHeader>
                <CardTitle>Заблоковані користувачі</CardTitle>
                <CardDescription>Ті, з ким ви припинили взаємодію.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {blocked.length ? blocked.map((relation) => (
                  <FriendRow key={relation.id} relation={relation} onlineUsers={onlineUserIds}>
                    {relation.blockedByOther ? <Badge variant="secondary">Користувач заблокував вас</Badge> : null}
                    {relation.blocked ? (
                      <Button size="sm" variant="outline" onClick={() => runAction(relation.id, "unblock")} disabled={isPending}>
                        <ShieldOff className="size-4 mr-2" />
                        Розблокувати
                      </Button>
                    ) : null}
                  </FriendRow>
                )) : (
                  <EmptyState title="Чорний список порожній" description="У вас немає заблокованих користувачів." />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Card className="h-fit sticky top-24">
        <CardHeader>
          <CardTitle>Знайти друзів</CardTitle>
          <CardDescription>Шукайте людей за їхнім унікальним нікнеймом.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              searchUsers();
            }}
          >
            <Input placeholder="Введіть нікнейм..." value={query} onChange={(event) => setQuery(event.target.value)} />
            <Button disabled={isPending || query.trim().length < 2}>Пошук</Button>
          </form>
          {notice ? <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">{notice}</p> : null}
          <div className="flex flex-col gap-2 mt-4">
            {results.map((user) => (
              <div key={user.id} className="flex items-center justify-between gap-3 rounded-md border p-3 hover:bg-muted/50 transition-colors">
                <div className="min-w-0">
                  <p className="truncate font-bold">{user.name}</p>
                </div>
                <Button size="sm" onClick={() => sendRequest(user.id)} disabled={isPending}>
                  <UserPlus className="size-4 mr-2" />
                  Додати
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
