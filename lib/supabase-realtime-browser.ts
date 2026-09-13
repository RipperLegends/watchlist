"use client";

type RealtimeConfig = {
  url: string;
  publishableKey: string;
};

export type WatchlistRealtimeEvent = {
  type: string;
  [key: string]: unknown;
};

type PresenceMeta = {
  userId?: number | string;
  user_id?: number | string;
  online_at?: string;
  phx_ref?: string;
};

function websocketUrl(supabaseUrl: string, publishableKey: string) {
  const url = supabaseUrl.replace(/\/$/, "").replace(/^http/, "ws");
  return `${url}/realtime/v1/websocket?apikey=${encodeURIComponent(publishableKey)}&vsn=1.0.0`;
}

function normalizePresenceId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function extractPresenceUserIds(rawPresence: unknown) {
  const ids = new Set<number>();
  if (!rawPresence || typeof rawPresence !== "object") return ids;

  for (const [key, value] of Object.entries(rawPresence as Record<string, unknown>)) {
    const keyId = normalizePresenceId(key);
    if (keyId) ids.add(keyId);

    const metas = Array.isArray(value) ? value : [];
    for (const meta of metas as PresenceMeta[]) {
      const metaId = normalizePresenceId(meta?.userId ?? meta?.user_id);
      if (metaId) ids.add(metaId);
    }
  }

  return ids;
}

export async function subscribeWatchlistRealtime(
  userId: string | number,
  onEvent: (event: WatchlistRealtimeEvent) => void
) {
  const response = await fetch("/api/realtime/config", { cache: "no-store" });
  if (!response.ok) return () => undefined;

  const config = (await response.json().catch(() => null)) as RealtimeConfig | null;
  if (!config?.url || !config.publishableKey) return () => undefined;

  const topic = `realtime:watchlist:user:${userId}`;
  const presenceTopic = "realtime:watchlist:presence";
  const socket = new WebSocket(websocketUrl(config.url, config.publishableKey));
  let ref = 1;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  const onlineUserIds = new Set<number>();

  function send(event: string, payload: Record<string, unknown>, targetTopic = topic) {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ topic: targetTopic, event, payload, ref: String(ref++) }));
  }

  function emitPresenceSync() {
    onEvent({ type: "presence_sync", onlineUserIds: Array.from(onlineUserIds) });
  }

  socket.addEventListener("open", () => {
    const userTopicConfig = {
      config: {
        broadcast: { ack: false, self: false },
        presence: { key: String(userId) },
        postgres_changes: []
      },
      access_token: config.publishableKey
    };

    send("phx_join", userTopicConfig);
    send("phx_join", userTopicConfig, presenceTopic);

    window.setTimeout(() => {
      send("presence", {
        type: "presence",
        event: "track",
        payload: {
          userId: Number(userId),
          online_at: new Date().toISOString()
        }
      }, presenceTopic);
    }, 800);

    heartbeat = setInterval(() => {
      send("heartbeat", {}, "phoenix");
    }, 25_000);
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data)) as {
      event?: string;
      topic?: string;
      payload?: {
        event?: string;
        payload?: Record<string, unknown>;
        joins?: Record<string, PresenceMeta[]>;
        leaves?: Record<string, PresenceMeta[]>;
      } & Record<string, unknown>;
    };

    if (message.topic === presenceTopic && message.event === "presence_state") {
      onlineUserIds.clear();
      for (const id of extractPresenceUserIds(message.payload)) onlineUserIds.add(id);
      emitPresenceSync();
      return;
    }

    if (message.topic === presenceTopic && message.event === "presence_diff") {
      const joins = extractPresenceUserIds(message.payload?.joins);
      const leaves = extractPresenceUserIds(message.payload?.leaves);
      for (const id of joins) onlineUserIds.add(id);
      for (const id of leaves) onlineUserIds.delete(id);
      if (joins.size) onEvent({ type: "presence_join", onlineUserIds: Array.from(joins) });
      if (leaves.size) onEvent({ type: "presence_leave", onlineUserIds: Array.from(leaves) });
      emitPresenceSync();
      return;
    }

    const broadcastMessage = message as {
      event?: string;
      payload?: { event?: string; payload?: Record<string, unknown> } & Record<string, unknown>;
    };

    if (broadcastMessage.event !== "broadcast") return;
    const eventName = String(broadcastMessage.payload?.event || broadcastMessage.payload?.type || "broadcast");
    const payload = (broadcastMessage.payload?.payload || broadcastMessage.payload || {}) as Record<string, unknown>;
    onEvent({ type: eventName, ...payload });
  });

  return () => {
    if (heartbeat) clearInterval(heartbeat);
    send("presence", { type: "presence", event: "untrack", payload: {} }, presenceTopic);
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close();
    }
  };
}
