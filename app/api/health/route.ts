import { prisma } from "@/lib/prisma";
import { isSupabaseAuthConfigured } from "@/lib/supabase-auth";
import { getSupabaseStorageStatus } from "@/lib/supabase-storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`select 1`;
    const storage = getSupabaseStorageStatus();

    return Response.json({
      status: "ok",
      database: {
        connected: true
      },
      services: {
        authSecret: Boolean(process.env.AUTH_SECRET),
        tmdb: Boolean(process.env.TMDB_ACCESS_TOKEN || process.env.TMDB_API_KEY),
        omdb: Boolean(process.env.OMDB_API_KEY),
        supabaseAuth: isSupabaseAuthConfigured(),
        supabaseStorage: storage.configured
      },
      storage: {
        bucket: storage.bucket,
        mode: storage.mode,
        ready: storage.configured
      },
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt
    });
  } catch (error) {
    return Response.json(
      {
        status: "error",
        database: {
          connected: false
        },
        message: error instanceof Error ? error.message : "Health check failed",
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt
      },
      { status: 503 }
    );
  }
}
