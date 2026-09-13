import { normalizeLocale, saveLocalePreference } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  await saveLocalePreference(normalizeLocale(payload?.locale));
  return Response.json({ ok: true });
}
