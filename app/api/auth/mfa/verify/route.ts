import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { signInWithSupabasePassword, verifySupabaseTotpFactor } from "@/lib/supabase-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const sessionUser = await requireUser();
  if (!sessionUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await request.json().catch(() => null);
  const password = String(payload?.password || "");
  const factorId = String(payload?.factorId || "");
  const code = String(payload?.code || "").replace(/\s+/g, "");

  if (password.length < 6 || !factorId || !/^\d{6}$/.test(code)) {
    return Response.json({ error: "Введіть пароль, фактор і 6-значний код." }, { status: 400 });
  }

  const session = await signInWithSupabasePassword(sessionUser.email, password);
  if (!session.ok || !session.user.accessToken) {
    return Response.json({ error: "Не вдалося підтвердити пароль акаунта." }, { status: 403 });
  }

  const verified = await verifySupabaseTotpFactor(session.user.accessToken, factorId, code);
  if (!verified.ok) {
    return Response.json({ error: verified.message || "Код 2FA не підтверджено." }, { status: 502 });
  }

  await prisma.auditLog.create({
    data: { userId: Number(sessionUser.id), action: "user.mfa.enroll.verify", details: `factor:${factorId}` }
  });

  return Response.json({ ok: true });
}
