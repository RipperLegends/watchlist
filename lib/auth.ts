import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "user" | "admin";
      accountStatus: "active" | "blocked";
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: "user" | "admin";
    accountStatus?: "active" | "blocked";
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

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
        email: { label: "Email", type: "email" },
        password: { label: "Пароль", type: "password" }
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email.toLowerCase() }
        });
        if (!user || user.accountStatus === "blocked") return null;

        const validPassword = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!validPassword) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastSeen: new Date(), presenceStatus: "online" }
        });

        return {
          id: String(user.id),
          name: user.name,
          email: user.email,
          role: user.role,
          accountStatus: user.accountStatus
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: "user" | "admin" }).role ?? "user";
        token.accountStatus = (user as { accountStatus?: "active" | "blocked" }).accountStatus ?? "active";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? "";
        session.user.role = token.role ?? "user";
        session.user.accountStatus = token.accountStatus ?? "active";
      }
      return session;
    }
  }
});

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id || session.user.accountStatus === "blocked") return null;
  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser();
  return user?.role === "admin" ? user : null;
}
