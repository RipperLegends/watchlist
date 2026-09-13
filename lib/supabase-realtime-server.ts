import { prisma } from "@/lib/prisma";

export async function broadcastToTopic(topic: string, eventName: string, payload: Record<string, unknown>) {
  await prisma.$executeRaw`
    select private.watchlist_broadcast(${topic}, ${eventName}, ${JSON.stringify(payload)}::jsonb)
  `;
}

export async function broadcastToUser(userId: number | string, eventName: string, payload: Record<string, unknown>) {
  await broadcastToTopic(`watchlist:user:${userId}`, eventName, payload);
}
