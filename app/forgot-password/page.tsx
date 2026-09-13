import Link from "next/link";
import crypto from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseAuthUser, sendSupabasePasswordReset } from "@/lib/supabase-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type ForgotPasswordPageProps = {
  searchParams?: Promise<{ sent?: string }>;
};

async function requestPasswordReset(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return;

  const headerStore = await headers();
  const origin = headerStore.get("origin") || process.env.NEXTAUTH_URL || "http://localhost:3000";
  const localUser = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, name: true, authUserId: true }
  });

  if (localUser && !localUser.authUserId) {
    const temporaryPassword = crypto.randomBytes(24).toString("base64url");
    const createdAuthUser = await createSupabaseAuthUser({
      email,
      password: temporaryPassword,
      name: localUser.name
    });
    if (createdAuthUser.ok) {
      await prisma.user.update({
        where: { id: localUser.id },
        data: { authUserId: createdAuthUser.user.id }
      });
    }
  }

  await sendSupabasePasswordReset(email, `${origin}/reset-password`);
  redirect("/forgot-password?sent=1");
}

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = searchParams ? await searchParams : {};
  const sent = params.sent === "1";

  return (
    <div className="page-shell flex min-h-[70vh] flex-col items-center justify-center gap-5">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Відновлення пароля</CardTitle>
          <CardDescription>
            Введіть email акаунта. Якщо він існує в Supabase Auth, ви отримаєте лист для зміни пароля.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="flex flex-col gap-4">
              <p className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
                Якщо email знайдено, інструкція вже відправлена. Перевірте пошту.
              </p>
              <Button asChild>
                <Link href="/login">Повернутися до входу</Link>
              </Button>
            </div>
          ) : (
            <form action={requestPasswordReset} className="flex flex-col gap-4">
              <Input name="email" type="email" placeholder="Email" required />
              <Button type="submit">Надіслати лист</Button>
            </form>
          )}
        </CardContent>
      </Card>
      <Link href="/login" className="text-sm font-semibold text-primary">
        Я згадав пароль
      </Link>
    </div>
  );
}
