import "dotenv/config";
import { Pool } from "pg";

const TMDB_API_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_URL = "https://image.tmdb.org/t/p/w500";
const OMDB_API_URL = "https://www.omdbapi.com/";
const fallbackAliases = [
  {
    pattern: /^пираты карибского моря проклятие черной жемчужины$/i,
    mediaType: "movie",
    queries: ["Pirates of the Caribbean: The Curse of the Black Pearl"]
  },
  { pattern: /^зеленая миля$/i, mediaType: "movie", queries: ["Зелёная миля", "The Green Mile"] },
  { pattern: /^ч[её]рное зеркало$/i, mediaType: "series", queries: ["Черное зеркало", "Black Mirror"] },
  {
    pattern: /^побег из тюрьмы продолжение$/i,
    mediaType: "series",
    queries: ["Prison Break: Resurrection", "Prison Break"]
  },
  {
    pattern: /^рождение мафии чикаго$/i,
    mediaType: "series",
    queries: ["The Making of the Mob: Chicago", "Making of the Mob Chicago"]
  },
  { pattern: /^рипли$/i, mediaType: "series", queries: ["Ripley"] },
  { pattern: /^омерзительная восьмерка$/i, mediaType: "movie", queries: ["Омерзительная восьмёрка", "The Hateful Eight"] },
  { pattern: /^джанго освобожденный$/i, mediaType: "movie", queries: ["Джанго освобождённый", "Django Unchained"] },
  {
    pattern: /^атака титанов выбор без сожалений ova 2$/i,
    mediaType: "series",
    queries: ["Attack on Titan: No Regrets", "Shingeki no Kyojin: Kuinaki Sentaku"]
  },
  {
    pattern: /^атака титанов потерянные девушки$/i,
    mediaType: "series",
    queries: ["Attack on Titan: Lost Girls", "Shingeki no Kyojin: Lost Girls", "Атака титанов"],
    posterPath: "/9whSxgqSW7dPIIMJyM4WG3BYVo7.jpg"
  },
  { pattern: /^болат$/i, mediaType: "movie", queries: ["Борат", "Borat"] },
  { pattern: /^ж[её]лтые птицы$/i, mediaType: "movie", queries: ["Желтые птицы", "The Yellow Birds"] },
  {
    pattern: /^атака титанов ova 1$/i,
    mediaType: "series",
    queries: ["Attack on Titan OVA", "Shingeki no Kyojin OVA", "Атака титанов"],
    posterPath: "/9whSxgqSW7dPIIMJyM4WG3BYVo7.jpg"
  }
];

const args = new Set(process.argv.slice(2));
const shouldApply = args.has("--apply");
const force = args.has("--force");
const quiet = args.has("--quiet");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.replace("--limit=", "")) : null;

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
const tmdbApiKey = process.env.TMDB_API_KEY;
const tmdbAccessToken = process.env.TMDB_ACCESS_TOKEN;
const omdbApiKey = process.env.OMDB_API_KEY;

if (!connectionString) {
  throw new Error("DATABASE_URL or SUPABASE_DB_URL is required.");
}

if (!tmdbApiKey && !tmdbAccessToken && !omdbApiKey) {
  throw new Error("TMDB_API_KEY, TMDB_ACCESS_TOKEN or OMDB_API_KEY is required.");
}

const pool = new Pool({
  connectionString,
  max: Number(process.env.DB_POOL_MAX ?? 1),
  idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT_MS ?? 1000),
  connectionTimeoutMillis: Number(process.env.DB_POOL_CONNECTION_TIMEOUT_MS ?? 10000)
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeTitle(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function titleAliases(title) {
  const normalized = String(title ?? "").trim();
  const withoutMarkers = normalized
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const parts = normalized
    .split(/\s+\/\s+| \/|\/ |\s+\|\s+|\s+—\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const cleanedParts = parts
    .map((part) => part.replace(/\[[^\]]+\]/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return [...new Set([normalized, withoutMarkers, ...parts, ...cleanedParts])].slice(0, 6);
}

function fallbackAliasFor(title) {
  const normalized = normalizeTitle(title);
  return fallbackAliases.find((item) => item.pattern.test(normalized));
}

function getYear(rawDate) {
  const value = String(rawDate ?? "").slice(0, 4);
  const year = Number(value);
  return Number.isFinite(year) ? year : null;
}

function tmdbHeaders() {
  return tmdbAccessToken ? { Authorization: `Bearer ${tmdbAccessToken}` } : undefined;
}

async function tmdbSearch(query, type, language) {
  if (!tmdbApiKey && !tmdbAccessToken) return [];

  const endpoint = type === "series" ? "/search/tv" : "/search/movie";
  const url = new URL(`${TMDB_API_URL}${endpoint}`);
  url.searchParams.set("query", query);
  url.searchParams.set("language", language);
  url.searchParams.set("include_adult", "false");
  url.searchParams.set("page", "1");
  if (!tmdbAccessToken && tmdbApiKey) {
    url.searchParams.set("api_key", tmdbApiKey);
  }

  const response = await fetch(url, { headers: tmdbHeaders() });
  if (!response.ok) {
    throw new Error(`TMDb ${type} search failed: ${response.status}`);
  }

  const payload = await response.json();
  return Array.isArray(payload.results) ? payload.results : [];
}

function tmdbCandidateTitles(candidate, mediaType) {
  if (mediaType === "series") {
    return [candidate.name, candidate.original_name].filter(Boolean);
  }
  return [candidate.title, candidate.original_title].filter(Boolean);
}

function scoreTmdbCandidate(entry, candidate, query, mediaType) {
  if (!candidate.poster_path) return -100;

  const aliases = titleAliases(entry.title).map(normalizeTitle).filter(Boolean);
  const queryNorm = normalizeTitle(query);
  const fallback = fallbackAliasFor(entry.title);
  const fallbackTitles = (fallback?.queries ?? []).map(normalizeTitle).filter(Boolean);
  const candidateTitles = tmdbCandidateTitles(candidate, mediaType).map(normalizeTitle).filter(Boolean);
  const candidateYear = mediaType === "series" ? getYear(candidate.first_air_date) : getYear(candidate.release_date);

  let score = 0;
  if (entry.year && candidateYear) {
    const delta = Math.abs(Number(entry.year) - candidateYear);
    if (delta === 0) score += 40;
    else if (delta === 1) score += 18;
    else if (delta <= 3) score += 6;
    else score -= 20;
  }

  for (const alias of aliases) {
    for (const candidateTitle of candidateTitles) {
      if (!alias || !candidateTitle) continue;
      if (candidateTitle === alias) score += 50;
      else if (candidateTitle.includes(alias) || alias.includes(candidateTitle)) score += 25;
    }
  }

  for (const alias of fallbackTitles) {
    for (const candidateTitle of candidateTitles) {
      if (!alias || !candidateTitle) continue;
      if (candidateTitle === alias) score += 50;
      else if (candidateTitle.includes(alias) || alias.includes(candidateTitle)) score += 25;
    }
  }

  if (fallback?.mediaType === mediaType) score += 14;
  if (queryNorm && candidateTitles.some((title) => title === queryNorm)) score += 18;
  score += Math.min(Number(candidate.vote_count ?? 0) / 250, 12);
  score += Math.min(Number(candidate.popularity ?? 0) / 15, 10);

  return score;
}

async function findTmdbPoster(entry) {
  const languages = ["ru-RU", "uk-UA", "en-US"];
  const fallback = fallbackAliasFor(entry.title);
  const aliases = [...new Set([...titleAliases(entry.title), ...(fallback?.queries ?? [])])];
  const mediaTypes = [
    fallback?.mediaType,
    entry.type,
    entry.type === "series" ? "movie" : "series"
  ].filter((value, index, array) => value && array.indexOf(value) === index);
  const bestById = new Map();

  for (const mediaType of mediaTypes) {
    for (const query of aliases) {
      if (query.length < 2) continue;
      for (const language of languages) {
        const results = await tmdbSearch(query, mediaType, language);
        for (const candidate of results.slice(0, 8)) {
          const score = scoreTmdbCandidate(entry, candidate, query, mediaType);
          const previous = bestById.get(`${mediaType}:${candidate.id}`);
          if (!previous || score > previous.score) {
            bestById.set(`${mediaType}:${candidate.id}`, { candidate, score, query, language, mediaType });
          }
        }
        if ([...bestById.values()].some((item) => item.score >= 80)) break;
      }
      if ([...bestById.values()].some((item) => item.score >= 80)) break;
    }
    if ([...bestById.values()].some((item) => item.score >= 80)) break;
  }

  const best = [...bestById.values()].sort((a, b) => b.score - a.score)[0];
  if ((!best || best.score < 35) && fallback?.posterPath) {
    return {
      posterUrl: `${TMDB_IMAGE_URL}${fallback.posterPath}`,
      provider: "tmdb",
      mediaType: fallback.mediaType,
      score: 70,
      matchedTitle: fallback.queries.at(-1) ?? "",
      matchedYear: entry.year ?? null
    };
  }
  if (!best || best.score < 35) return null;

  return {
    posterUrl: `${TMDB_IMAGE_URL}${best.candidate.poster_path}`,
    provider: "tmdb",
    mediaType: best.mediaType,
    score: Math.round(best.score),
    matchedTitle: tmdbCandidateTitles(best.candidate, best.mediaType)[0] ?? "",
    matchedYear: best.mediaType === "series" ? getYear(best.candidate.first_air_date) : getYear(best.candidate.release_date)
  };
}

async function findOmdbPoster(entry) {
  if (!omdbApiKey) return null;

  for (const query of titleAliases(entry.title)) {
    const url = new URL(OMDB_API_URL);
    url.searchParams.set("apikey", omdbApiKey);
    url.searchParams.set("t", query);
    if (entry.year) url.searchParams.set("y", String(entry.year));
    url.searchParams.set("type", entry.type === "series" ? "series" : "movie");
    url.searchParams.set("plot", "short");

    const response = await fetch(url);
    if (!response.ok) continue;
    const payload = await response.json();
    if (payload.Response === "True" && payload.Poster && payload.Poster !== "N/A") {
      return {
        posterUrl: payload.Poster,
        provider: "omdb",
        mediaType: entry.type,
        score: 40,
        matchedTitle: payload.Title ?? query,
        matchedYear: payload.Year ? Number(String(payload.Year).slice(0, 4)) : null
      };
    }
  }

  return null;
}

async function findPoster(entry) {
  try {
    const tmdb = await findTmdbPoster(entry);
    if (tmdb) return tmdb;
  } catch (error) {
    console.warn(`[tmdb] ${entry.title}: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    return await findOmdbPoster(entry);
  } catch (error) {
    console.warn(`[omdb] ${entry.title}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

async function main() {
  const wherePoster = force ? "true" : "coalesce(poster_url, '') = ''";
  const limitSql = Number.isInteger(limit) && limit > 0 ? `limit ${limit}` : "";
  const entriesResult = await pool.query(`
    select id, title, type, year, poster_url
    from entries
    where type in ('movie', 'series') and ${wherePoster}
    order by sort_order asc, id asc
    ${limitSql}
  `);

  const entries = entriesResult.rows;
  let found = 0;
  let updated = 0;
  let missed = 0;
  const missedTitles = [];

  console.log(
    JSON.stringify({
      mode: shouldApply ? "apply" : "dry-run",
      force,
      selected: entries.length
    })
  );

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const match = await findPoster(entry);
    if (!match) {
      missed += 1;
      missedTitles.push(`${entry.title}${entry.year ? ` (${entry.year})` : ""}`);
      if (!quiet) console.log(`[${index + 1}/${entries.length}] MISS ${entry.title}`);
      await sleep(80);
      continue;
    }

    found += 1;
    if (shouldApply) {
      const shouldCorrectType = match.provider === "tmdb" && match.mediaType && match.mediaType !== entry.type && match.score >= 80;
      if (shouldCorrectType) {
        await pool.query(
          `update entries set poster_url = $1, type = $2::"EntryType", updated_at = now() where id = $3`,
          [match.posterUrl, match.mediaType, entry.id]
        );
      } else {
        await pool.query(
          `update entries set poster_url = $1, updated_at = now() where id = $2`,
          [match.posterUrl, entry.id]
        );
      }
      updated += 1;
    }

    if (!quiet || (index + 1) % 25 === 0 || index + 1 === entries.length) {
      console.log(
        `[${index + 1}/${entries.length}] ${shouldApply ? "UPDATE" : "FOUND"} ${entry.title} -> ${match.provider}:${match.matchedTitle || "poster"} (${match.score})`
      );
    }
    await sleep(80);
  }

  console.log(
    JSON.stringify(
      {
        selected: entries.length,
        found,
        updated,
        missed,
        missedTitles: missedTitles.slice(0, 40)
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
