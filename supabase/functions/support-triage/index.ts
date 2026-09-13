import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const urgentWords = ["не можу увійти", "зламали", "атака", "оплата", "security", "password", "admin"];

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const payload = await request.json().catch(() => null);
  const subject = String(payload?.subject || "");
  const body = String(payload?.body || "");
  const text = `${subject}\n${body}`.toLowerCase();
  const urgent = urgentWords.some((word) => text.includes(word));

  return jsonResponse({
    priority: urgent ? "high" : "normal",
    category: text.includes("повідом") || text.includes("message") ? "messages" : text.includes("друг") ? "friends" : "general",
    suggestedStatus: urgent ? "reviewing" : "new"
  });
});
