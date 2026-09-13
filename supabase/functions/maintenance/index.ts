import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ error: "Supabase credentials are missing" }, 503);

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/watchlist_run_maintenance`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json"
    },
    body: "{}"
  });

  if (!response.ok) {
    return jsonResponse({ error: await response.text() }, 502);
  }

  return jsonResponse({
    cleaned: await response.json().catch(() => 0)
  });
});
