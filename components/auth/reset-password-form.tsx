"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function readRecoveryAccessToken() {
  if (typeof window === "undefined") return "";
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const searchParams = new URLSearchParams(window.location.search);
  const type = hashParams.get("type") || searchParams.get("type");
  const accessToken = hashParams.get("access_token") || searchParams.get("access_token");

  if (type && type !== "recovery") return "";
  return accessToken || "";
}

export function ResetPasswordForm() {
  const router = useRouter();
  const [accessToken, setAccessToken] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    setAccessToken(readRecoveryAccessToken());
  }, []);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!accessToken) {
      setError("Посилання для відновлення пароля недійсне або вже застаріло.");
      return;
    }

    if (password.length < 6) {
      setError("Пароль має містити мінімум 6 символів.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Паролі не співпадають.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, password })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Не вдалося оновити пароль.");
        return;
      }

      setSuccess("Пароль оновлено. Тепер можна увійти з новим паролем.");
      window.history.replaceState(null, "", "/reset-password");
      setTimeout(() => router.push("/login?reset=1"), 900);
    });
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Новий пароль</CardTitle>
        <CardDescription>Введіть новий пароль для акаунта. Мінімум 6 символів.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Новий пароль" minLength={6} required />
          <Input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" placeholder="Повторіть пароль" minLength={6} required />
          {error ? <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
          {success ? <p className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">{success}</p> : null}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Оновлюємо..." : "Змінити пароль"}
          </Button>
        </form>
        <Link href="/login" className="mt-4 block text-sm font-semibold text-primary">
          Повернутися до входу
        </Link>
      </CardContent>
    </Card>
  );
}
