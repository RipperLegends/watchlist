"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type AuthFormProps = {
  mode: "login" | "register";
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [error, setError] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "");

    startTransition(async () => {
      if (mode === "register") {
        const response = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password })
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          setError(payload?.error ?? "Не вдалося створити акаунт.");
          return;
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false
      });

      if (result?.error) {
        setError("Невірний email або пароль.");
        return;
      }

      router.push("/profile");
      router.refresh();
    });
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle>{mode === "login" ? "Увійти" : "Реєстрація"}</CardTitle>
        <CardDescription>
          {mode === "login" ? "Поверніться до свого каталогу." : "Створіть акаунт, щоб додавати записи й друзів."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {mode === "register" ? <Input name="name" placeholder="Логін" required minLength={2} /> : null}
          <Input name="email" placeholder="Email" type="email" required />
          <Input name="password" placeholder="Пароль" type="password" required minLength={6} />
          {error ? <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Зачекайте..." : mode === "login" ? "Увійти" : "Створити акаунт"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
