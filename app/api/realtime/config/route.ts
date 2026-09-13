import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = process.env.SUPABASE_URL || "";
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || "";
  if (!url || !publishableKey) {
    return Response.json({ error: "Realtime is not configured" }, { status: 503 });
  }

  return Response.json({ url, publishableKey });
}
