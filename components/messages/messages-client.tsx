"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
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

export function MessagesClient({ conversations, currentUserId }: { conversations: Conversation[]; currentUserId: string }) {
  const [conversationState, setConversationState] = React.useState(conversations);
  const [activeId, setActiveId] = React.useState(conversations[0]?.id ?? null);
  const [messageBody, setMessageBody] = React.useState("");
  const [isPending, startTransition] = React.useTransition();
  const activeConversation = conversationState.find((conversation) => conversation.id === activeId) ?? null;

  if (!conversations.length) {
    return <EmptyState title="Діалогів поки немає." description="Повідомлення з’являться, коли користувачі додадуть одне одного в друзі." />;
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[330px_1fr]">
      <Card className="flex flex-col gap-2 p-3 shadow-none">
          {conversationState.map((conversation) => (
          <button
            key={conversation.id}
            onClick={() => setActiveId(conversation.id)}
            className={`flex items-center gap-3 rounded-md p-3 text-left transition hover:bg-muted ${
              conversation.id === activeId ? "bg-muted" : ""
            }`}
          >
            <Avatar>
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

      <Card className="flex min-h-[520px] flex-col shadow-none">
        {activeConversation ? (
          <>
            <div className="border-b p-4">
              <p className="font-bold">{activeConversation.friend.name}</p>
              <p className="text-sm text-muted-foreground">{activeConversation.friend.presenceStatus}</p>
            </div>
            <div className="flex flex-1 flex-col gap-3 overflow-auto p-4">
              {activeConversation.messages.length ? (
                activeConversation.messages.map((message) => {
                  const own = String(message.senderId) === currentUserId;
                  return (
                    <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[78%] rounded-lg p-3 ${own ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        <p>{message.body}</p>
                        {message.contentTitle ? (
                          <a href={message.contentUrl || "#"} className="mt-2 block rounded-md border border-current/20 p-2 text-sm font-semibold">
                            {message.contentTitle}
                          </a>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">Почніть діалог першим повідомленням.</p>
              )}
            </div>
            <form
              className="flex gap-2 border-t p-4"
              onSubmit={(event) => {
                event.preventDefault();
                const body = messageBody.trim();
                if (!body || !activeConversation) return;
                startTransition(async () => {
                  const response = await fetch(`/api/friends/${activeConversation.friend.id}/messages`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ body })
                  });
                  if (!response.ok) return;
                  const createdMessage = await response.json();
                  setConversationState((current) =>
                    current.map((conversation) =>
                      conversation.id === activeConversation.id
                        ? { ...conversation, messages: [...conversation.messages, createdMessage] }
                        : conversation
                    )
                  );
                  setMessageBody("");
                });
              }}
            >
              <Input
                placeholder="Написати повідомлення..."
                value={messageBody}
                onChange={(event) => setMessageBody(event.target.value)}
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
