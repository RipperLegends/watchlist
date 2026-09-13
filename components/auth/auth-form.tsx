"use client";

import * as React from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": () => void;
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

type AuthFormProps = {
  mode: "login" | "register";
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [turnstileSiteKey, setTurnstileSiteKey] = React.useState("");
  const [turnstileToken, setTurnstileToken] = React.useState("");
  const [turnstileScriptReady, setTurnstileScriptReady] = React.useState(false);
  const [mfaRequired, setMfaRequired] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const turnstileContainerRef = React.useRef<HTMLDivElement>(null);
  const turnstileWidgetIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (mode !== "register") return;

    fetch("/api/security-config")
      .then((response) => response.json())
      .then((config) => {
        const siteKey = config?.turnstile?.enabled ? String(config.turnstile.siteKey || "") : "";
        setTurnstileSiteKey(siteKey);
      })
      .catch(() => setTurnstileSiteKey(""));
  }, [mode]);

  React.useEffect(() => {
    if (mode !== "register" || !turnstileSiteKey || !turnstileScriptReady || !turnstileContainerRef.current || !window.turnstile) return;
    if (turnstileWidgetIdRef.current) return;

    turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
      sitekey: turnstileSiteKey,
      callback: (token) => setTurnstileToken(token),
      "expired-callback": () => setTurnstileToken(""),
      "error-callback": () => setTurnstileToken("")
    });

    return () => {
      if (turnstileWidgetIdRef.current && window.turnstile) {
        window.turnstile.remove(turnstileWidgetIdRef.current);
        turnstileWidgetIdRef.current = null;
      }
    };
  }, [mode, turnstileScriptReady, turnstileSiteKey]);

  function resetTurnstile() {
    setTurnstileToken("");
    if (turnstileWidgetIdRef.current) {
      window.turnstile?.reset(turnstileWidgetIdRef.current);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const form = event.currentTarget;
    const formData = new FormData(event.currentTarget);
    const identifier = String(formData.get("identifier") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "");
    const mfaCode = String(formData.get("mfaCode") ?? "");

    startTransition(async () => {
      if (mode === "register") {
        if (turnstileSiteKey && !turnstileToken) {
          setError("Підтвердьте, що ви не бот.");
          return;
        }

        const response = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password, turnstileToken })
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          setError(payload?.error ?? "Не вдалося створити акаунт.");
          resetTurnstile();
          return;
        }
        const payload = await response.json().catch(() => null);
        if (payload?.requiresEmailConfirmation) {
          setSuccess("Акаунт створено. Перевірте email і підтвердьте реєстрацію перед входом.");
          form.reset();
          resetTurnstile();
          return;
        }
      }

      if (mode === "login" && !mfaRequired) {
        const checkResponse = await fetch("/api/auth/login-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier, password })
        });
        const checkPayload = await checkResponse.json().catch(() => null);
        if (!checkResponse.ok) {
          setError(checkPayload?.error ?? "Невірний логін, email або пароль.");
          return;
        }
        if (checkPayload?.mfaRequired) {
          setMfaRequired(true);
          setSuccess("Введіть 6-значний код з Authenticator, щоб завершити вхід.");
          return;
        }
      }

      if (mode === "login" && mfaRequired && !/^\d{6}$/.test(mfaCode.replace(/\s+/g, ""))) {
        setError("Введіть 6-значний 2FA код.");
        return;
      }

      const result = await signIn("credentials", {
        identifier: mode === "register" ? email : identifier,
        password,
        mfaCode,
        redirect: false
      });

      if (result?.error) {
        setError(mfaRequired ? "Невірний 2FA код або пароль." : "Невірний логін, email або пароль.");
        resetTurnstile();
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
          {mode === "login" ? "Поверніться до свого каталогу." : "Створіть акаунт, щоб реагувати на каталог і додавати друзів."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {mode === "register" && turnstileSiteKey ? (
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
            strategy="afterInteractive"
            onLoad={() => setTurnstileScriptReady(true)}
          />
        ) : null}
        <form className="flex flex-col gap-4" method="post" onSubmit={handleSubmit}>
          {mode === "register" ? <Input name="name" placeholder="Логін" required minLength={2} /> : null}
          {mode === "login" ? <Input name="identifier" placeholder="Логін або email" required readOnly={mfaRequired} /> : null}
          {mode === "register" ? <Input name="email" placeholder="Email" type="email" required /> : null}
          <Input
            name="password"
            placeholder="Пароль"
            type="password"
            required
            minLength={6}
            readOnly={mode === "login" && mfaRequired}
          />
          {mode === "login" && mfaRequired ? <Input name="mfaCode" placeholder="2FA код" inputMode="numeric" maxLength={6} autoFocus /> : null}
          {mode === "login" && mfaRequired ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setMfaRequired(false);
                setSuccess("");
                setError("");
              }}
            >
              Змінити логін або пароль
            </Button>
          ) : null}
          {mode === "register" && turnstileSiteKey ? <div ref={turnstileContainerRef} className="min-h-[65px]" /> : null}
          {error ? <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
          {success ? <p className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">{success}</p> : null}
          <Button type="submit" disabled={isPending}>
            {isPending ? "Зачекайте..." : mode === "login" ? "Увійти" : "Створити акаунт"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
