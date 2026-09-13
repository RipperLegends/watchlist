import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSupabaseUserWithAccessToken, updateSupabaseAuthUserById } from "@/lib/supabase-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const accessToken = String(payload?.accessToken || "");
  const password = String(payload?.password || "");

  if (!accessToken || password.length < 6) {
    return Response.json({ error: "Потрібен recovery token і пароль від 6 символів." }, { status: 400 });
  }

  const recoveryUser = await getSupabaseUserWithAccessToken(accessToken);
  if (!recoveryUser.ok) {
    return Response.json({ error: recoveryUser.message || "Посилання для відновлення пароля недійсне." }, { status: 400 });
  }
  if (!recoveryUser.user.id) {
    return Response.json({ error: "Не вдалося визначити користувача після оновлення пароля." }, { status: 400 });
  }

  const updated = await updateSupabaseAuthUserById(recoveryUser.user.id, { password });
  if (!updated.ok) {
    return Response.json({ error: updated.message || "Не вдалося оновити пароль." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const searchConditions: Prisma.UserWhereInput[] = [{ authUserId: recoveryUser.user.id }];
  if (recoveryUser.user.email) {
    searchConditions.push({ email: { equals: recoveryUser.user.email, mode: "insensitive" } });
  }

  const localUser = await prisma.user.findFirst({
    where: { OR: searchConditions },
    select: { id: true }
  });

  if (localUser) {
    await prisma.user.update({
      where: { id: localUser.id },
      data: {
        passwordHash,
        authUserId: recoveryUser.user.id
      }
    });
    await prisma.auditLog.create({
      data: { userId: localUser.id, action: "auth.password.reset", details: "email-recovery" }
    });
  }

  return Response.json({ ok: true });
}
