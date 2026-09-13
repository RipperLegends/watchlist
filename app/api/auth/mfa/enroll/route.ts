import bcrypt from "bcryptjs";
import { requireUser } from "@/lib/auth";
import { consumeMfaResetCode } from "@/lib/mfa";
import { prisma } from "@/lib/prisma";
import { createSupabaseAuthUser, enrollSupabaseTotp, signInWithSupabasePassword } from "@/lib/supabase-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const sessionUser = await requireUser();
  if (!sessionUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const payload = await request.json().catch(() => null);
  const password = String(payload?.password || "");
  const resetExisting = Boolean(payload?.resetExisting);
  const resetCode = String(payload?.resetCode || "").replace(/\s+/g, "");
  if (password.length < 6) return Response.json({ error: "Потрібен поточний пароль акаунта." }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: Number(sessionUser.id) },
    select: { authUserId: true, passwordHash: true, name: true, email: true }
  });
  const existingFactors = user?.authUserId
    ? await prisma.$queryRaw<Array<{ id: string; status: string; friendlyName: string }>>`
        select
          id::text as id,
          status::text as status,
          coalesce(friendly_name, '')::text as "friendlyName"
        from auth.mfa_factors
        where user_id = ${user.authUserId}::uuid
          and factor_type = 'totp'
        order by created_at desc
      `
    : [];
  const verifiedFactor = existingFactors.find((factor) => factor.status === "verified");

  if (verifiedFactor && !resetExisting) {
    return Response.json({
      error: "2FA вже увімкнено для цього акаунта.",
      alreadyEnabled: true,
      factorId: verifiedFactor.id
    }, { status: 409 });
  }

  if (verifiedFactor && resetExisting && !/^\d{6}$/.test(resetCode)) {
    return Response.json({ error: "Введіть 6-значний код з email для скидання 2FA." }, { status: 400 });
  }

  let session = await signInWithSupabasePassword(sessionUser.email, password);
  let authUserId = user?.authUserId ?? null;

  if (!session.ok && user && !user.authUserId && (await bcrypt.compare(password, user.passwordHash))) {
    const createdAuthUser = await createSupabaseAuthUser({
      email: user.email,
      password,
      name: user.name
    });
    if (createdAuthUser.ok) {
      authUserId = createdAuthUser.user.id;
      await prisma.user.update({
        where: { id: Number(sessionUser.id) },
        data: { authUserId }
      });
      session = await signInWithSupabasePassword(sessionUser.email, password);
    }
  }

  if (!session.ok || !session.user.accessToken) {
    return Response.json({ error: "Не вдалося підтвердити пароль акаунта." }, { status: 403 });
  }

  if (!authUserId && session.user.id) {
    authUserId = session.user.id;
    await prisma.user.update({
      where: { id: Number(sessionUser.id) },
      data: { authUserId }
    });
  }

  if (verifiedFactor && resetExisting) {
    const resetAllowed = await consumeMfaResetCode(Number(sessionUser.id), resetCode);
    if (!resetAllowed) {
      return Response.json({ error: "Код з email недійсний або вже минув." }, { status: 403 });
    }
  }

  if (authUserId && existingFactors.length) {
    await prisma.$executeRaw`
      delete from auth.mfa_factors
      where user_id = ${authUserId}::uuid
        and factor_type = 'totp'
        and (${resetExisting}::boolean or status <> 'verified')
    `;
  }

  const enrolled = await enrollSupabaseTotp(session.user.accessToken, "Watchlist 2FA");
  if (!enrolled.ok) {
    return Response.json({ error: enrolled.message || "Не вдалося створити 2FA фактор." }, { status: 502 });
  }

  await prisma.auditLog.create({
    data: { userId: Number(sessionUser.id), action: "user.mfa.enroll.start", details: `factor:${enrolled.factorId}` }
  });

  return Response.json(enrolled);
}
