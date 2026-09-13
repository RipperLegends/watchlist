"use client";

import * as React from "react";
import Link from "next/link";
import { Check, CheckCircle2, MessageSquare, Search, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type FriendItem = {
  relationId: number;
  friendId: number;
  name: string;
  avatarUrl: string;
  presenceStatus: string;
};

type EntryProps = {
  id: number;
  title: string;
  year?: number | null;
  rating: number;
  posterUrl?: string;
};

export function SendToFriendDialog({ entry }: { entry: EntryProps }) {
  const [open, setOpen] = React.useState(false);
  const [friends, setFriends] = React.useState<FriendItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [selectedFriendId, setSelectedFriendId] = React.useState<number | null>(null);
  const [message, setMessage] = React.useState(`Привіт! Поглянь на цей фільм: ${entry.title}`);
  const [sending, setSending] = React.useState(false);
  const [sentSuccess, setSentSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setSentSuccess(false);
      setError(null);
      setMessage(`Привіт! Поглянь на цей фільм: ${entry.title}`);
      if (friends.length === 0) {
        setLoading(true);
        fetch("/api/friends")
          .then((res) => {
            if (!res.ok) throw new Error("Не вдалося завантажити друзів");
            return res.json();
          })
          .then((data: FriendItem[]) => {
            setFriends(data);
            if (data.length > 0) setSelectedFriendId(data[0].friendId);
          })
          .catch((err) => {
            setError(err instanceof Error ? err.message : "Помилка завантаження");
          })
          .finally(() => setLoading(false));
      }
    }
  }, [open, entry.title]);

  const filteredFriends = React.useMemo(() => {
    if (!search.trim()) return friends;
    return friends.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()));
  }, [friends, search]);

  const selectedFriend = friends.find((f) => f.friendId === selectedFriendId);

  async function handleSend() {
    if (!selectedFriendId) return;
    setSending(true);
    setError(null);

    try {
      const meta = [entry.year ? String(entry.year) : null, `★ ${entry.rating}/5`].filter(Boolean).join(" · ");
      const res = await fetch(`/api/friends/${selectedFriendId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: message.trim() || `Поглянь на цей фільм: ${entry.title}`,
          contentTitle: entry.title,
          contentUrl: `/catalog/${entry.id}`,
          contentMeta: meta
        })
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || "Не вдалося надіслати повідомлення");
      }

      setSentSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка при надсиланні");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => setOpen(true)}
      >
        <MessageSquare className="size-4" />
        Надіслати другу
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setSentSuccess(false);
            setError(null);
          }
        }}
        title="Надіслати фільм другу в чат"
        description="Фільм з'явиться у вашому діалозі як інтерактивна картка"
      >
        {sentSuccess ? (
          <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="size-8" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="font-bold text-lg">Надіслано!</h3>
              <p className="text-sm text-muted-foreground">
                Фільм <span className="font-semibold text-foreground">«{entry.title}»</span> додано в діалог з{" "}
                <span className="font-semibold text-foreground">{selectedFriend?.name ?? "другом"}</span>.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <Button asChild variant="default">
                <Link href={`/messages?friendId=${selectedFriendId}`}>
                  Перейти до чату
                </Link>
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Закрити
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive font-medium">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Оберіть друга
              </label>

              {loading ? (
                <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                  Завантаження списку друзів...
                </div>
              ) : friends.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center">
                  <User className="size-8 text-muted-foreground/50" />
                  <p className="text-sm font-medium">У вас поки немає підтверджених друзів</p>
                  <p className="text-xs text-muted-foreground">
                    Додайте друзів у розділі «Друзі», щоб ділитися фільмами
                  </p>
                  <Button asChild size="sm" variant="outline" className="mt-2">
                    <Link href="/friends">Знайти друзів</Link>
                  </Button>
                </div>
              ) : (
                <>
                  {friends.length > 4 && (
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Пошук серед друзів..."
                        className="pl-8 h-9 text-sm"
                      />
                    </div>
                  )}

                  <div className="max-h-48 overflow-y-auto rounded-lg border divide-y divide-border/50">
                    {filteredFriends.length === 0 ? (
                      <div className="p-3 text-center text-xs text-muted-foreground">
                        Друзів за запитом не знайдено
                      </div>
                    ) : (
                      filteredFriends.map((friend) => {
                        const isSelected = friend.friendId === selectedFriendId;
                        const isOnline = friend.presenceStatus === "online";
                        return (
                          <button
                            key={friend.friendId}
                            type="button"
                            onClick={() => setSelectedFriendId(friend.friendId)}
                            className={`flex w-full items-center justify-between p-2.5 text-left transition-colors hover:bg-muted/50 ${
                              isSelected ? "bg-primary/10 hover:bg-primary/15" : ""
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <Avatar className="size-8">
                                  <AvatarImage src={friend.avatarUrl} alt={friend.name} />
                                  <AvatarFallback>{friend.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <span
                                  className={`absolute bottom-0 right-0 size-2.5 rounded-full ring-2 ring-background ${
                                    isOnline ? "bg-emerald-500" : "bg-muted-foreground/40"
                                  }`}
                                />
                              </div>
                              <span className={`text-sm font-medium ${isSelected ? "text-primary font-semibold" : ""}`}>
                                {friend.name}
                              </span>
                            </div>
                            {isSelected && <Check className="size-4 text-primary" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>

            {friends.length > 0 && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Коментар до фільму
                </label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Додайте своє повідомлення..."
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>
            )}

            {friends.length > 0 && (
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={sending}>
                  Скасувати
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={!selectedFriendId || sending}
                  className="gap-2"
                >
                  <Send className="size-4" />
                  {sending ? "Надсилання..." : "Надіслати"}
                </Button>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}
