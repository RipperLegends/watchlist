import { cache } from "react";

export type TmdbMediaType = "movie" | "series";

export type TmdbSearchItem = {
  id: number;
  mediaType: TmdbMediaType;
  title: string;
  originalTitle: string;
  year: number | null;
  overview: string;
  posterUrl: string;
  genres: string[];
  voteAverage: number;
};

type TmdbRawItem = {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  poster_path?: string | null;
  genre_ids?: number[];
  vote_average?: number;
};

type TmdbGenre = {
  id: number;
  name: string;
};

const TMDB_API_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_URL = "https://image.tmdb.org/t/p/w500";

const genreCache = new Map<TmdbMediaType, Map<number, string>>();

function tmdbRequestUrl(path: string, params: Record<string, string>) {
  const url = new URL(`${TMDB_API_URL}${path}`);
  const apiKey = process.env.TMDB_API_KEY;

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  if (!process.env.TMDB_ACCESS_TOKEN && apiKey) {
    url.searchParams.set("api_key", apiKey);
  }

  return url;
}

function tmdbHeaders() {
  const accessToken = process.env.TMDB_ACCESS_TOKEN;
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
}

const tmdbFetch = cache(async <T,>(path: string, params: Record<string, string>): Promise<T> => {
  if (!process.env.TMDB_ACCESS_TOKEN && !process.env.TMDB_API_KEY) {
    throw new Error("TMDb credentials are not configured");
  }

  const response = await fetch(tmdbRequestUrl(path, params), {
    headers: tmdbHeaders(),
    next: { revalidate: 60 * 60 }
  });

  if (!response.ok) {
    throw new Error(`TMDb request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
});

const getGenres = cache(async (type: TmdbMediaType) => {
  const cached = genreCache.get(type);
  if (cached) return cached;

  const endpoint = type === "series" ? "/genre/tv/list" : "/genre/movie/list";
  const data = await tmdbFetch<{ genres: TmdbGenre[] }>(endpoint, {
    language: "uk-UA"
  });
  const genres = new Map(data.genres.map((genre) => [genre.id, genre.name]));
  genreCache.set(type, genres);

  return genres;
});

function getYear(date?: string) {
  const value = date?.slice(0, 4);
  if (!value) return null;
  const year = Number(value);
  return Number.isFinite(year) ? year : null;
}

function mapItem(item: TmdbRawItem, type: TmdbMediaType, genres: Map<number, string>): TmdbSearchItem {
  const title = type === "series" ? item.name : item.title;
  const originalTitle = type === "series" ? item.original_name : item.original_title;
  const date = type === "series" ? item.first_air_date : item.release_date;

  return {
    id: item.id,
    mediaType: type,
    title: title || originalTitle || "Без назви",
    originalTitle: originalTitle || title || "",
    year: getYear(date),
    overview: item.overview || "",
    posterUrl: item.poster_path ? `${TMDB_IMAGE_URL}${item.poster_path}` : "",
    genres: (item.genre_ids ?? []).map((id) => genres.get(id)).filter((name): name is string => Boolean(name)),
    voteAverage: Number((item.vote_average ?? 0).toFixed(1))
  };
}

export const searchTmdb = cache(async (query: string, type: TmdbMediaType): Promise<TmdbSearchItem[]> => {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) return [];

  const endpoint = type === "series" ? "/search/tv" : "/search/movie";
  const [genres, data] = await Promise.all([
    getGenres(type),
    tmdbFetch<{ results: TmdbRawItem[] }>(endpoint, {
      query: normalizedQuery,
      language: "uk-UA",
      include_adult: "false",
      page: "1"
    })
  ]);

  return data.results.slice(0, 8).map((item) => mapItem(item, type, genres));
});
