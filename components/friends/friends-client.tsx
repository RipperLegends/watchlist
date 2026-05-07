"use client";

import * as React from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { initials } from "@/lib/utils";

type FriendRelation = {
  id: number;
  status: string;
  friend: {
    id: number;
    name: string;
    presenceStatus: string;
  };
};

type SearchUser = {
  id: number;
  name: string;
  email: string;
};

export function FriendsClient({ initialFriends }: { initialFriends: FriendRelation[] }) {
  const [friends, setFriends] = React.useState(initialFriends);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchUser[]>([]);
  const [isPending, startTransition] = React.useTransition();

  function searchUsers() {
    const term = query.trim();
    if (term.length < 2) return;
    startTransition(async () => {
      const response = await fetch(`/api/friends/search?q=${encodeURIComponent(term)}`);
      if (!response.ok) return;
      setResults(await response.json());
    });
  }

  function sendRequest(friendId: number) {
    startTransition(async () => {
      const response = await fetch("/api/friends/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendId })
      });
      if (!response.ok) return;
      const relation = await response.json();
      setFriends((current) => [relation, ...current]);
      setResults((current) => current.filter((user) => user.id !== friendId));
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
      <Card>
        <CardHeader>
          <CardTitle>Список друзів</CardTitle>
          <CardDescription>Онлайн-статус і швидкий перехід до повідомлень.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {friends.length ? (
            friends.map((relation) => (
              <div key={relation.id} className="flex items-center justify-between rounded-md border p-4">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{initials(relation.friend.name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-bold">{relation.friend.name}</p>
                    <p className="text-sm text-muted-foreground">{relation.friend.presenceStatus}</p>
                  </div>
                </div>
                <Badge variant={relation.status === "accepted" ? "default" : "secondary"}>{relation.status}</Badge>
              </div>
            ))
          ) : (
            <EmptyState title="Друзів поки немає." description="Знайдіть користувача за нікнеймом і надішліть заявку." />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Додати друга</CardTitle>
          <CardDescription>Пошук за нікнеймом, без старих кімнат і зайвого спільного режиму.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              searchUsers();
            }}
          >
            <Input placeholder="Нікнейм користувача" value={query} onChange={(event) => setQuery(event.target.value)} />
            <Button disabled={isPending || query.trim().length < 2}>Пошук</Button>
          </form>
          <div className="flex flex-col gap-2">
            {results.map((user) => (
              <div key={user.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="font-bold">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <Button size="sm" onClick={() => sendRequest(user.id)} disabled={isPending}>
                  Надіслати
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
