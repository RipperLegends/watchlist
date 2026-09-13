import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const payload = await request.json().catch(() => null);
  const email = String(payload?.email || "").toLowerCase();
  const ipAccountCount = Number(payload?.ipAccountCount || 0);
  const recentAttempts = Number(payload?.recentAttempts || 0);
  const disposableDomains = new Set((Deno.env.get("DISPOSABLE_EMAIL_DOMAINS") || "").split(",").map((item) => item.trim()).filter(Boolean));
  const domain = email.split("@")[1] || "";

  const reasons: string[] = [];
  if (ipAccountCount >= 5) reasons.push("ip_account_limit");
  if (recentAttempts >= 8) reasons.push("rate_limit");
  if (domain && disposableDomains.has(domain)) reasons.push("disposable_email");

  return jsonResponse({
    allow: reasons.length === 0,
    reasons
  });
});
