import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMfaResetCode } from "@/lib/mfa";

export const dynamic = "force-dynamic";

export async function POST() {
  const sessionUser = await requireUser();
  if (!sessionUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: Number(sessionUser.id) },
    select: { authUserId: true, email: true }
  });
  if (!user?.authUserId) {
    return Response.json({ error: "2FA не підключено до цього акаунта." }, { status: 400 });
  }

  const factors = await prisma.$queryRaw<Array<{ id: string }>>`
    select id::text
    from auth.mfa_factors
    where user_id = ${user.authUserId}::uuid
      and status = 'verified'
      and factor_type = 'totp'
    limit 1
  `.catch(() => []);

  if (!factors.length) {
    return Response.json({ error: "2FA не підключено до цього акаунта." }, { status: 400 });
  }

  const result = await sendMfaResetCode(Number(sessionUser.id), user.email);
  if (!result.ok) {
    return Response.json({ error: result.message || "Не вдалося надіслати код." }, { status: 502 });
  }

  await prisma.auditLog.create({
    data: { userId: Number(sessionUser.id), action: "user.mfa.reset.code", details: "email-code-sent" }
  });

  return Response.json({ ok: true });
}
