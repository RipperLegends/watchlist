import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const TMDB_URL = "https://api.themoviedb.org/3";
const OMDB_URL = "https://www.omdbapi.com/";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const tmdbToken = Deno.env.get("TMDB_ACCESS_TOKEN");
  const tmdbApiKey = Deno.env.get("TMDB_API_KEY");
  const omdbApiKey = Deno.env.get("OMDB_API_KEY");
  const payload = await request.json().catch(() => null);
  const query = String(payload?.query || "").trim();
  const type = String(payload?.type || "movie") === "series" ? "tv" : "movie";

  if (!query || query.length < 2) return jsonResponse({ error: "Query is too short" }, 400);
  if (!tmdbToken && !tmdbApiKey) return jsonResponse({ error: "TMDb credentials are missing" }, 503);

  const searchUrl = new URL(`${TMDB_URL}/search/${type}`);
  searchUrl.searchParams.set("query", query);
  searchUrl.searchParams.set("language", "uk-UA");
  if (tmdbApiKey) searchUrl.searchParams.set("api_key", tmdbApiKey);

  const tmdbResponse = await fetch(searchUrl, {
    headers: tmdbToken ? { Authorization: `Bearer ${tmdbToken}` } : {}
  });
  if (!tmdbResponse.ok) return jsonResponse({ error: "TMDb request failed" }, 502);

  const tmdb = await tmdbResponse.json();
  const first = tmdb?.results?.[0] ?? null;
  if (!first) return jsonResponse({ item: null });

  let omdb = null;
  if (omdbApiKey && (first.title || first.name)) {
    const omdbUrl = new URL(OMDB_URL);
    omdbUrl.searchParams.set("apikey", omdbApiKey);
    omdbUrl.searchParams.set("t", first.title || first.name);
    omdbUrl.searchParams.set("type", type === "tv" ? "series" : "movie");
    omdb = await fetch(omdbUrl).then((response) => response.ok ? response.json() : null).catch(() => null);
  }

  return jsonResponse({
    item: {
      source: "tmdb",
      externalId: first.id,
      title: first.title || first.name,
      year: Number(String(first.release_date || first.first_air_date || "").slice(0, 4)) || null,
      overview: first.overview || "",
      posterUrl: first.poster_path ? `https://image.tmdb.org/t/p/w500${first.poster_path}` : "",
      rating: Math.round(Number(first.vote_average || 0) / 2),
      omdb
    }
  });
});
