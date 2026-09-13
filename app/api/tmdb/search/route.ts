import { requireUser } from "@/lib/auth";
import { searchTmdb, type TmdbMediaType } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const type = searchParams.get("type") === "series" ? "series" : "movie";

  if (query.length < 2) return Response.json([]);

  try {
    const results = await searchTmdb(query, type as TmdbMediaType);
    return Response.json(results);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "TMDb search failed" },
      { status: 502 }
    );
  }
}
