"use client";

import * as React from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { subscribeWatchlistRealtime } from "@/lib/supabase-realtime-browser";
import { initials } from "@/lib/utils";

type Conversation = {
  id: number;
  friend: { id: number; name: string; presenceStatus: string; avatarUrl: string };
  messages: Array<{
    id: number;
    senderId: number;
    receiverId: number;
    body: string;
    contentTitle: string;
    contentUrl: string;
    readAt: string | null;
    createdAt: string;
  }>;
};

const statusLabel: Record<string, string> = {
  online: "Онлайн",
  offline: "Офлайн",
  dnd: "Не турбувати",
  hidden: "Прихований"
};

function effectiveStatus(status: string, onlineUsers: Set<number>, friendId: number) {
  if (status === "hidden" || status === "dnd") return status;
  return onlineUsers.has(friendId) ? "online" : status;
}

export function MessagesClient({
  conversations,
  currentUserId
}: {
  conversations: Conversation[];
  currentUserId: string;
}) {
  const [conversationState, setConversationState] = React.useState(conversations);
  const [activeId, setActiveId] = React.useState(conversations[0]?.id ?? null);
  const [messageBody, setMessageBody] = React.useState("");
  const [typingFriendIds, setTypingFriendIds] = React.useState<Set<number>>(new Set());
  const [onlineUserIds, setOnlineUserIds] = React.useState<Set<number>>(new Set());
  const [isPending, startTransition] = React.useTransition();
  const typingActiveRef = React.useRef(false);
  const typingStopTimerRef = React.useRef<number | null>(null);
  const remoteTypingTimersRef = React.useRef<Map<number, number>>(new Map());
  const activeConversation = conversationState.find((conversation) => conversation.id === activeId) ?? null;
  const activeFriendId = activeConversation?.friend.id ?? null;

  const refreshConversations = React.useCallback(async () => {
    const response = await fetch("/api/messages", { cache: "no-store" });
    if (!response.ok) return;
    const nextConversations = (await response.json()) as Conversation[];
    setConversationState(nextConversations);
    setActiveId((current) => current ?? nextConversations[0]?.id ?? null);
  }, []);

  React.useEffect(() => {
    let cleanup: () => void = () => undefined;
    let mounted = true;
    const remoteTypingTimers = remoteTypingTimersRef.current;

    subscribeWatchlistRealtime(currentUserId, (event) => {
      if (!mounted) return;
      if (event.type === "friend_message" || event.type === "friend_relation") {
        void refreshConversations();
      }
      if (event.type === "presence_sync" && Array.isArray(event.onlineUserIds)) {
        setOnlineUserIds(new Set(event.onlineUserIds.map(Number).filter((id) => Number.isInteger(id) && id > 0)));
      }
      if (event.type === "presence_status") {
        const userId = Number(event.userId);
        const nextStatus = String(event.presenceStatus || "");
        if (Number.isInteger(userId) && userId > 0) {
          setConversationState((current) =>
            current.map((conversation) =>
              conversation.friend.id === userId
                ? { ...conversation, friend: { ...conversation.friend, presenceStatus: nextStatus } }
                : conversation
            )
          );
        }
      }
      if (event.type === "typing") {
        const fromUserId = Number(event.fromUserId);
        const isTyping = Boolean(event.isTyping);
        if (!Number.isInteger(fromUserId) || fromUserId < 1) return;

        window.clearTimeout(remoteTypingTimersRef.current.get(fromUserId));
        setTypingFriendIds((current) => {
          const next = new Set(current);
          if (isTyping) next.add(fromUserId);
          else next.delete(fromUserId);
          return next;
        });

        if (isTyping) {
          const timeout = window.setTimeout(() => {
            setTypingFriendIds((current) => {
              const next = new Set(current);
              next.delete(fromUserId);
              return next;
            });
          }, 2500);
          remoteTypingTimersRef.current.set(fromUserId, timeout);
        }
      }
    }).then((unsubscribe) => {
      cleanup = unsubscribe;
    });

    return () => {
      mounted = false;
      for (const timer of remoteTypingTimers.values()) window.clearTimeout(timer);
      cleanup();
    };
  }, [currentUserId, refreshConversations]);

  React.useEffect(() => {
    typingActiveRef.current = false;
    if (typingStopTimerRef.current) window.clearTimeout(typingStopTimerRef.current);
  }, [activeId]);

  function appendMessage(conversationId: number, message: Conversation["messages"][number]) {
    setConversationState((current) => {
      const updated = current.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              messages: conversation.messages.some((item) => item.id === message.id)
                ? conversation.messages
                : [...conversation.messages, message]
            }
          : conversation
      );
      // Динамічне сортування: діалоги з новими повідомленнями йдуть вгору
      return updated.sort((a, b) => {
        const timeA = a.messages.at(-1)?.createdAt || 0;
        const timeB = b.messages.at(-1)?.createdAt || 0;
        return new Date(timeB).getTime() - new Date(timeA).getTime();
      });
    });
  }

  function sendMessage(body: string) {
    if (!activeConversation) return;
    const conversationId = activeConversation.id;
    const friendId = activeConversation.friend.id;

    startTransition(async () => {
      sendTyping(false, friendId);
      const response = await fetch(`/api/friends/${friendId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body })
      });
      if (!response.ok) return;
      const createdMessage = await response.json();
      appendMessage(conversationId, createdMessage);
      setMessageBody("");
    });
  }

  function sendTyping(isTyping: boolean, friendId = activeFriendId) {
    if (!friendId) return;
    if (typingActiveRef.current === isTyping && isTyping) return;
    typingActiveRef.current = isTyping;

    fetch(`/api/friends/${friendId}/typing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isTyping })
    }).catch(() => undefined);
  }

  function handleMessageChange(value: string) {
    setMessageBody(value);
    if (!activeFriendId) return;

    if (value.trim()) sendTyping(true, activeFriendId);
    if (typingStopTimerRef.current) window.clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = window.setTimeout(() => sendTyping(false, activeFriendId), 1400);
  }

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = (smooth = true) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  };

  React.useEffect(() => {
    scrollToBottom(false);
  }, [activeId]);

  React.useEffect(() => {
    scrollToBottom(true);
  }, [activeConversation?.messages?.length]);

  if (!conversations.length) {
    return <EmptyState title="Діалогів поки немає." description="Повідомлення з’являться, коли користувачі додадуть одне одного в друзі." />;
  }

  return (
    <div className="grid h-[calc(100vh-240px)] min-h-[500px] gap-5 lg:grid-cols-[330px_1fr]">
      <Card className="flex flex-col gap-2 overflow-y-auto p-3 shadow-none">
          {conversationState.map((conversation) => (
          <button
            key={conversation.id}
            onClick={() => setActiveId(conversation.id)}
            className={`flex items-center gap-3 rounded-md p-3 text-left transition hover:bg-muted ${
              conversation.id === activeId ? "bg-muted" : ""
            }`}
          >
            <Avatar>
              {conversation.friend.avatarUrl ? <AvatarImage src={conversation.friend.avatarUrl} alt={conversation.friend.name} /> : null}
              <AvatarFallback>{initials(conversation.friend.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-bold">{conversation.friend.name}</p>
              <p className="truncate text-sm text-muted-foreground">
                {conversation.messages.at(-1)?.body ?? "Ще немає повідомлень."}
              </p>
            </div>
          </button>
        ))}
      </Card>

      <Card className="flex flex-col shadow-none overflow-hidden">
        {activeConversation ? (
          <>
            <div className="border-b p-4">
              <p className="font-bold">{activeConversation.friend.name}</p>
              <div className="text-sm text-muted-foreground flex items-center h-5">
                {typingFriendIds.has(activeConversation.friend.id) ? (
                  <span className="flex items-center gap-1 text-primary font-medium">
                    Друкує
                    <span className="flex gap-0.5 pt-1">
                      <span className="h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]"></span>
                      <span className="h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]"></span>
                      <span className="h-1 w-1 animate-bounce rounded-full bg-primary"></span>
                    </span>
                  </span>
                ) : (
                  <span>{statusLabel[effectiveStatus(activeConversation.friend.presenceStatus, onlineUserIds, activeConversation.friend.id)] ?? activeConversation.friend.presenceStatus}</span>
                )}
              </div>
            </div>
            <div ref={scrollContainerRef} className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
              {activeConversation.messages.length ? (
                <>
                  {activeConversation.messages.map((message, index) => {
                    const own = String(message.senderId) === currentUserId;
                    const previous = activeConversation.messages[index - 1];
                    const isGrouped = previous && previous.senderId === message.senderId;
                    
                    const timeString = new Date(message.createdAt).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" });

                    return (
                      <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"} ${isGrouped ? "mt-0" : "mt-2"}`}>
                        <div className={`relative max-w-[78%] rounded-2xl px-4 py-2 ${own ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                          {message.contentTitle && message.contentUrl ? (
                            <Link
                              href={message.contentUrl}
                              className={`mb-2 flex flex-col gap-0.5 rounded-xl p-2.5 transition border ${
                                own
                                  ? "bg-primary-foreground/10 border-primary-foreground/20 hover:bg-primary-foreground/20 text-primary-foreground"
                                  : "bg-background/80 border-border hover:bg-background text-foreground"
                              }`}
                            >
                              <span className="text-xs font-black flex items-center gap-1.5 underline">
                                🎬 {message.contentTitle}
                              </span>
                            </Link>
                          ) : null}
                          <p className="text-sm leading-relaxed pr-8">{message.body}</p>
                          <span className={`absolute bottom-1 right-2 text-[10px] select-none ${own ? "text-primary-foreground/70" : "text-muted-foreground/70"}`}>
                            {timeString}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Почніть діалог першим повідомленням.</p>
              )}
            </div>
            <form
              className="flex gap-2 border-t p-4 bg-card"
              onSubmit={(event) => {
                event.preventDefault();
                const body = messageBody.trim();
                if (!body || !activeConversation) return;
                sendMessage(body);
              }}
            >
              <Input
                placeholder="Написати повідомлення..."
                value={messageBody}
                onBlur={() => sendTyping(false)}
                onChange={(event) => handleMessageChange(event.target.value)}
                disabled={isPending}
              />
              <Button disabled={isPending || !messageBody.trim()} aria-label="Надіслати повідомлення">
                <Send data-icon="inline-start" />
              </Button>
            </form>
          </>
        ) : null}
      </Card>
    </div>
  );
}
