import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signInWithSupabasePassword } from "@/lib/supabase-auth";

export const dynamic = "force-dynamic";

async function getVerifiedTotpFactor(authUserId: string | null | undefined) {
  if (!authUserId) return null;
  const factors = await prisma.$queryRaw<Array<{ id: string }>>`
    select id::text
    from auth.mfa_factors
    where user_id = ${authUserId}::uuid
      and status = 'verified'
      and factor_type = 'totp'
    order by created_at desc
    limit 1
  `.catch(() => []);

  return factors[0] ?? null;
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const identifier = String(payload?.identifier || "").trim();
  const password = String(payload?.password || "");

  if (!identifier || !password) {
    return Response.json({ error: "Введіть логін/email і пароль." }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: identifier.toLowerCase(), mode: "insensitive" } },
        { name: { equals: identifier, mode: "insensitive" } }
      ]
    }
  });

  if (!user || user.accountStatus === "blocked") {
    return Response.json({ error: "Невірний логін, email або пароль." }, { status: 401 });
  }

  const supabaseAuth = await signInWithSupabasePassword(user.email, password);
  if (user.authUserId && !supabaseAuth.ok && supabaseAuth.reason !== "missing_config") {
    return Response.json({ error: "Невірний логін, email або пароль." }, { status: 401 });
  }

  const validPassword = supabaseAuth.ok || (!user.authUserId && (await bcrypt.compare(password, user.passwordHash)));
  if (!validPassword) {
    return Response.json({ error: "Невірний логін, email або пароль." }, { status: 401 });
  }

  const authUserId = supabaseAuth.ok ? supabaseAuth.user.id : user.authUserId;
  const factor = await getVerifiedTotpFactor(user.authUserId ?? authUserId);

  return Response.json({
    ok: true,
    mfaRequired: Boolean(factor)
  });
}
