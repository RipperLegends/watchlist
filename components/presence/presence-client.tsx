"use client";

import { useEffect } from "react";

type PresenceClientProps = {
  userId: string;
};

function sendPresence(status: "online" | "offline") {
  const body = JSON.stringify({ status });

  if (status === "offline" && typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/presence", blob);
    return;
  }

  fetch("/api/presence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true
  }).catch(() => undefined);
}

export function PresenceClient({ userId }: PresenceClientProps) {
  useEffect(() => {
    if (!userId) return;

    sendPresence("online");
    const interval = window.setInterval(() => sendPresence(document.hidden ? "offline" : "online"), 45_000);

    function handleVisibilityChange() {
      sendPresence(document.hidden ? "offline" : "online");
    }

    function handleBeforeUnload() {
      sendPresence("offline");
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      sendPresence("offline");
    };
  }, [userId]);

  return null;
}
