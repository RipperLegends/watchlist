import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mailer";

const MFA_RESET_CODE_TTL_MINUTES = 10;

function secret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "watchlist-local-secret";
}

function hashMfaResetCode(userId: number, code: string) {
  return crypto
    .createHmac("sha256", secret())
    .update(`${userId}:${code.trim()}`)
    .digest("hex");
}

function createCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

export async function sendMfaResetCode(userId: number, email: string) {
  const code = createCode();
  const expiresAt = new Date(Date.now() + MFA_RESET_CODE_TTL_MINUTES * 60 * 1000);

  await prisma.mfaResetCode.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() }
  });

  await prisma.mfaResetCode.create({
    data: {
      userId,
      codeHash: hashMfaResetCode(userId, code),
      expiresAt
    }
  });

  const emailResult = await sendEmail({
    to: email,
    subject: "Код підтвердження скидання 2FA",
    text: `Ваш код для скидання 2FA: ${code}\n\nКод дійсний ${MFA_RESET_CODE_TTL_MINUTES} хвилин. Якщо це були не ви, просто проігноруйте цей лист.`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
        <h2>Код підтвердження скидання 2FA</h2>
        <p>Ваш код:</p>
        <p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>
        <p>Код дійсний ${MFA_RESET_CODE_TTL_MINUTES} хвилин.</p>
        <p>Якщо це були не ви, просто проігноруйте цей лист.</p>
      </div>
    `
  });

  if (!emailResult.ok) {
    await prisma.mfaResetCode.updateMany({
      where: { userId, codeHash: hashMfaResetCode(userId, code), usedAt: null },
      data: { usedAt: new Date() }
    });
  }

  return emailResult;
}

export async function consumeMfaResetCode(userId: number, code: string) {
  const normalizedCode = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalizedCode)) return false;

  const row = await prisma.mfaResetCode.findFirst({
    where: {
      userId,
      codeHash: hashMfaResetCode(userId, normalizedCode),
      usedAt: null,
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: "desc" }
  });

  if (!row) return false;

  await prisma.mfaResetCode.update({
    where: { id: row.id },
    data: { usedAt: new Date() }
  });

  return true;
}
