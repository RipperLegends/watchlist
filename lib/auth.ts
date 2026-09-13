import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSupabaseAuthUser, signInWithSupabasePassword, verifySupabaseTotpFactor } from "@/lib/supabase-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "user" | "admin";
      accountStatus: "active" | "blocked";
      preferredLanguage?: "UK" | "RU" | "EN";
    } & DefaultSession["user"];
  }
}

const credentialsSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
  mfaCode: z.string().optional()
});

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

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/login"
  },
  providers: [
    Credentials({
      credentials: {
        identifier: { label: "Логін або email", type: "text" },
        password: { label: "Пароль", type: "password" },
        mfaCode: { label: "2FA код", type: "text" }
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const identifier = parsed.data.identifier.trim();
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: { equals: identifier.toLowerCase(), mode: "insensitive" } },
              { name: { equals: identifier, mode: "insensitive" } }
            ]
          }
        });

        // Mitigate timing attack (user enumeration)
        if (!user || user.accountStatus === "blocked") {
          await bcrypt.compare(parsed.data.password, "$2b$10$uyeAY7C5FZ4h5vz6aLEOnOvWDBN70XkmwoYjfGm243UflVVo.hcJe");
          return null;
        }

        const supabaseAuth = await signInWithSupabasePassword(user.email, parsed.data.password);
        if (user.authUserId && !supabaseAuth.ok && supabaseAuth.reason !== "missing_config") return null;

        const validPassword = supabaseAuth.ok || (!user.authUserId && (await bcrypt.compare(parsed.data.password, user.passwordHash)));
        if (!validPassword) return null;

        const signedInAuthUserId = supabaseAuth.ok ? supabaseAuth.user.id : user.authUserId;
        const factor = await getVerifiedTotpFactor(user.authUserId ?? signedInAuthUserId);
        if (factor) {
          const code = String(parsed.data.mfaCode || "").replace(/\s+/g, "");
          if (!supabaseAuth.ok || !supabaseAuth.user.accessToken || !/^\d{6}$/.test(code)) return null;
          const verified = await verifySupabaseTotpFactor(supabaseAuth.user.accessToken, factor.id, code);
          if (!verified.ok) return null;
        }

        let authUserId = user.authUserId;
        if (!supabaseAuth.ok && supabaseAuth.reason !== "missing_config") {
          const createdAuthUser = await createSupabaseAuthUser({
            email: user.email,
            password: parsed.data.password,
            name: user.name
          }).catch(() => null);
          if (createdAuthUser?.ok) authUserId = createdAuthUser.user.id;
        }
        if (supabaseAuth.ok && !authUserId) {
          authUserId = supabaseAuth.user.id;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: {
            lastSeen: new Date(),
            presenceStatus: "online",
            ...(authUserId && authUserId !== user.authUserId ? { authUserId } : {})
          }
        });

        return {
          id: String(user.id),
          name: user.name,
          email: user.email,
          role: user.role,
          accountStatus: user.accountStatus,
          preferredLanguage: user.preferredLanguage
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const appToken = token as Record<string, unknown>;
        appToken.id = user.id;
        appToken.role = (user as { role?: "user" | "admin" }).role ?? "user";
        appToken.accountStatus = (user as { accountStatus?: "active" | "blocked" }).accountStatus ?? "active";
        appToken.preferredLanguage = (user as { preferredLanguage?: "UK" | "RU" | "EN" }).preferredLanguage ?? "UK";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const appToken = token as { id?: unknown; role?: unknown; accountStatus?: unknown; preferredLanguage?: unknown };
        session.user.id = typeof appToken.id === "string" ? appToken.id : "";
        session.user.role = appToken.role === "admin" ? "admin" : "user";
        session.user.accountStatus = appToken.accountStatus === "blocked" ? "blocked" : "active";
        session.user.preferredLanguage = appToken.preferredLanguage === "RU" || appToken.preferredLanguage === "EN" ? appToken.preferredLanguage : "UK";
      }
      return session;
    }
  }
});

export async function requireUser() {
  const session = await auth();
  const id = Number(session?.user?.id);
  if (!Number.isInteger(id) || id < 0) return null;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      accountStatus: true,
      preferredLanguage: true,
      avatarUrl: true
    }
  });

  if (!user || user.accountStatus === "blocked") return null;

  return {
    id: String(user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    accountStatus: user.accountStatus,
    preferredLanguage: user.preferredLanguage,
    avatarUrl: user.avatarUrl
  };
}

export async function requireAdmin() {
  const user = await requireUser();
  return user?.role === "admin" ? user : null;
}
