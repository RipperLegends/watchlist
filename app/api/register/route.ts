import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: "Перевірте логін, email і пароль." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { name: parsed.data.name }]
    },
    select: { id: true }
  });

  if (existingUser) {
    return Response.json({ error: "Користувач із таким логіном або email уже існує." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const isFirstUser = (await prisma.user.count()) === 0;

  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      passwordHash,
      role: isFirstUser ? "admin" : "user"
    }
  });

  return Response.json({ ok: true });
}
