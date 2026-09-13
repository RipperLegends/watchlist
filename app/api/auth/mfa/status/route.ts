import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type TotpFactorRow = {
  id: string;
  friendlyName: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function GET() {
  const sessionUser = await requireUser();
  if (!sessionUser) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: Number(sessionUser.id) },
    select: { authUserId: true }
  });
  if (!user?.authUserId) {
    return Response.json({ enabled: false, factors: [] });
  }

  const factors = await prisma.$queryRaw<TotpFactorRow[]>`
    select
      id::text as "id",
      coalesce(friendly_name, '')::text as "friendlyName",
      status::text as "status",
      created_at as "createdAt",
      updated_at as "updatedAt"
    from auth.mfa_factors
    where user_id = ${user.authUserId}::uuid
      and factor_type = 'totp'
    order by created_at desc
  `;

  return Response.json({
    enabled: factors.some((factor) => factor.status === "verified"),
    factors: factors.map((factor) => ({
      ...factor,
      createdAt: factor.createdAt.toISOString(),
      updatedAt: factor.updatedAt.toISOString()
    }))
  });
}
