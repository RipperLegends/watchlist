import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isTurnstileEnabledForRequest } from "@/lib/security";
import { signUpWithSupabasePassword } from "@/lib/supabase-auth";
import { registerSchema } from "@/lib/validators";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function publicError(message: string, status = 400) {
  const error = new Error(message) as Error & { statusCode?: number; publicMessage?: string };
  error.statusCode = status;
  error.publicMessage = message;
  return error;
}

function getClientIp(request: Request) {
  const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim();
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return cloudflareIp || forwarded || realIp || "";
}

function hashIp(request: Request) {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "watchlist-local-secret";
  return crypto.createHash("sha256").update(`${secret}:${getClientIp(request) || "unknown"}`).digest("hex");
}

async function verifyTurnstile(request: Request, token?: string) {
  if (!isTurnstileEnabledForRequest(request)) return;
  const responseToken = String(token || "").trim();
  if (!responseToken || responseToken.length > 2048) {
    throw publicError("Підтвердьте, що ви не бот.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const clientIp = getClientIp(request);
    const body: Record<string, string> = {
      secret: String(process.env.TURNSTILE_SECRET_KEY || ""),
      response: responseToken,
      idempotency_key: crypto.randomUUID()
    };
    if (clientIp) body.remoteip = clientIp;

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) {
      throw publicError("Не вдалося пройти перевірку безпеки.");
    }
  } catch (error) {
    if (error instanceof Error && "statusCode" in error) throw error;
    throw publicError("Перевірка безпеки тимчасово недоступна.", 503);
  } finally {
    clearTimeout(timeout);
  }
}

async function enforceRegistrationLimits(request: Request, email: string) {
  const maxAttempts = Number(process.env.REGISTRATION_RATE_LIMIT || 8);
  const maxAccounts = Number(process.env.REGISTRATION_MAX_ACCOUNTS_PER_IP || 5);
  const windowMs = Number(process.env.REGISTRATION_RATE_WINDOW_MS || 15 * 60 * 1000);
  const cutoff = new Date(Date.now() - windowMs);
  const ipHash = hashIp(request);
  const emailDomain = email.split("@")[1] || "";

  await prisma.registrationAttempt.deleteMany({
    where: {
      result: { not: "registered" },
      createdAt: { lt: cutoff }
    }
  });

  const registeredCount = await prisma.registrationAttempt.count({
    where: { ipHash, result: "registered" }
  });
  if (registeredCount >= maxAccounts) {
    await prisma.registrationAttempt.create({ data: { ipHash, emailDomain, result: "account_limit" } });
    throw publicError("З цього IP вже створено максимальну кількість акаунтів.", 429);
  }

  const recentCount = await prisma.registrationAttempt.count({
    where: {
      ipHash,
      createdAt: { gte: cutoff }
    }
  });
  if (recentCount >= maxAttempts) {
    await prisma.registrationAttempt.create({ data: { ipHash, emailDomain, result: "rate_limited" } });
    throw publicError("Забагато спроб реєстрації. Спробуйте пізніше.", 429);
  }

  return prisma.registrationAttempt.create({
    data: { ipHash, emailDomain, result: "allowed" },
    select: { id: true }
  });
}

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: "Перевірте логін, email і пароль." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  let attempt: { id: number } | null = null;

  try {
    attempt = await enforceRegistrationLimits(request, email);
    await verifyTurnstile(request, parsed.data.turnstileToken);

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: email, mode: "insensitive" } },
          { name: { equals: parsed.data.name, mode: "insensitive" } }
        ]
      },
      select: { id: true }
    });

    if (existingUser) {
      await prisma.registrationAttempt.update({
        where: { id: attempt.id },
        data: { result: "rejected" }
      });
      return Response.json({ error: "Користувач із таким логіном або email уже існує." }, { status: 409 });
    }

    const origin = request.headers.get("origin") || process.env.NEXTAUTH_URL || "http://localhost:3000";
    const supabaseAuthUser = await signUpWithSupabasePassword({
      email,
      password: parsed.data.password,
      name: parsed.data.name,
      redirectTo: `${origin.replace(/\/$/, "")}/login`
    });

    if (!supabaseAuthUser.ok && supabaseAuthUser.reason === "duplicate") {
      await prisma.registrationAttempt.update({
        where: { id: attempt.id },
        data: { result: "rejected" }
      });
      return Response.json({ error: "Користувач із таким email уже існує в системі авторизації." }, { status: 409 });
    }

    if (!supabaseAuthUser.ok && supabaseAuthUser.reason !== "missing_config") {
      throw publicError("Не вдалося створити акаунт авторизації. Спробуйте пізніше.", 502);
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const isFirstUser = (await prisma.user.count()) === 0;

    await prisma.user.create({
      data: {
        authUserId: supabaseAuthUser.ok ? supabaseAuthUser.user.id : undefined,
        name: parsed.data.name,
        email,
        passwordHash,
        role: isFirstUser ? "admin" : "user"
      }
    });

    await prisma.registrationAttempt.update({
      where: { id: attempt.id },
      data: { result: "registered" }
    });

    return Response.json({
      ok: true,
      requiresEmailConfirmation: supabaseAuthUser.ok && !supabaseAuthUser.user.accessToken
    });
  } catch (error) {
    if (attempt?.id) {
      await prisma.registrationAttempt.update({
        where: { id: attempt.id },
        data: { result: "rejected" }
      }).catch(() => undefined);
    }

    const status = error instanceof Error && "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 500;
    const message = error instanceof Error && "publicMessage" in error && typeof error.publicMessage === "string"
      ? error.publicMessage
      : "Не вдалося створити акаунт.";
    return Response.json({ error: message }, { status });
  }
}
