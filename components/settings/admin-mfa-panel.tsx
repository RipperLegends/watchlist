"use client";

import * as React from "react";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FactorStatus = {
  id: string;
  friendlyName: string;
  status: string;
  createdAt: string;
};

type MfaStatus = {
  enabled: boolean;
  factors: FactorStatus[];
};

type EnrollResponse = {
  factorId: string;
  qrCode: string;
  secret: string;
};

function qrCodeSrc(qrCode: string) {
  if (!qrCode) return "";
  if (qrCode.startsWith("data:")) return qrCode;
  return `data:image/svg+xml;utf8,${encodeURIComponent(qrCode)}`;
}

export function AccountMfaPanel() {
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [resetCode, setResetCode] = React.useState("");
  const [resetCodeSent, setResetCodeSent] = React.useState(false);
  const [enrollment, setEnrollment] = React.useState<EnrollResponse | null>(null);
  const [status, setStatus] = React.useState<MfaStatus>({ enabled: false, factors: [] });
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  const primaryFactor = status.factors[0] ?? null;

  async function loadStatus() {
    const response = await fetch("/api/auth/mfa/status", { cache: "no-store" });
    if (!response.ok) return;
    setStatus((await response.json()) as MfaStatus);
  }

  React.useEffect(() => {
    void loadStatus();
  }, []);

  function startEnrollment(resetExisting = false) {
    setError("");
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/auth/mfa/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, resetExisting, resetCode })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        if (payload?.alreadyEnabled) {
          await loadStatus();
          setMessage("2FA вже увімкнено. Щоб створити новий QR, спочатку натисніть «Скинути й створити новий QR».");
          return;
        }
        setError(payload?.error ?? "Не вдалося створити QR для 2FA.");
        return;
      }
      setEnrollment(payload as EnrollResponse);
      setResetCode("");
      setResetCodeSent(false);
      await loadStatus();
      setMessage("Відскануйте QR-код у Google Authenticator, 1Password або Authy.");
    });
  }

  function sendResetCode() {
    setError("");
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/auth/mfa/reset-code", { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ? `Не вдалося надіслати код: ${payload.error}` : "Не вдалося надіслати код.");
        return;
      }
      setResetCodeSent(true);
      setMessage("Код для скидання 2FA надіслано на вашу пошту.");
    });
  }

  function verifyEnrollment() {
    if (!enrollment) return;
    setError("");
    setMessage("");
    startTransition(async () => {
      const response = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, factorId: enrollment.factorId, code })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(payload?.error ?? "Не вдалося підтвердити код 2FA.");
        return;
      }
      setEnrollment(null);
      setCode("");
      await loadStatus();
      setMessage("2FA для акаунта увімкнено.");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">
        <p className="mb-1 flex items-center gap-2 font-bold text-foreground">
          <ShieldCheck className="size-4" />
          2FA через застосунок Authenticator
        </p>
        <p>Секрет не зберігається в Watchlist. Його перевіряє Supabase Auth.</p>
        <p className="mt-2 font-semibold text-foreground">
          Статус: {status.enabled ? "увімкнено" : primaryFactor ? "очікує підтвердження" : "не налаштовано"}
        </p>
        {primaryFactor ? (
          <p className="mt-1 text-xs">
            Фактор: {primaryFactor.friendlyName || "Authenticator"} · {primaryFactor.status}
          </p>
        ) : null}
      </div>

      <label className="flex flex-col gap-2 text-sm font-semibold">
        Поточний пароль акаунта
        <Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={6} />
      </label>

      <div className="flex flex-wrap gap-2">
        {!status.enabled ? (
          <Button type="button" disabled={isPending || password.length < 6} onClick={() => startEnrollment(false)}>
            {enrollment ? "Створити новий QR" : "Почати налаштування 2FA"}
          </Button>
        ) : null}
        {status.enabled ? (
          <Button type="button" variant="outline" disabled={isPending} onClick={sendResetCode}>
            Надіслати код для скидання 2FA
          </Button>
        ) : null}
      </div>

      {status.enabled && resetCodeSent ? (
        <div className="flex flex-col gap-3 rounded-md border border-dashed p-4">
          <p className="text-sm text-muted-foreground">
            Введіть код з email і поточний пароль, щоб скинути старий 2FA фактор та створити новий QR.
          </p>
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Код з email
            <Input value={resetCode} onChange={(event) => setResetCode(event.target.value)} inputMode="numeric" maxLength={6} placeholder="123456" />
          </label>
          <Button type="button" variant="destructive" disabled={isPending || password.length < 6 || !/^\d{6}$/.test(resetCode)} onClick={() => startEnrollment(true)}>
            Скинути й створити новий QR
          </Button>
        </div>
      ) : null}

      {enrollment ? (
        <div className="grid gap-4 rounded-md border p-4 md:grid-cols-[180px_1fr]">
          {enrollment.qrCode && qrCodeSrc(enrollment.qrCode) ? (
            <div className="relative size-44 rounded-md bg-white p-2">
              <Image src={qrCodeSrc(enrollment.qrCode)} alt="QR-код для 2FA" fill unoptimized className="object-contain p-2" />
            </div>
          ) : null}
          <div className="flex flex-col gap-3">
            {enrollment.secret ? (
              <p className="break-all rounded-md bg-muted p-3 text-sm text-muted-foreground">
                Secret: <b>{enrollment.secret}</b>
              </p>
            ) : null}
            <label className="flex flex-col gap-2 text-sm font-semibold">
              Код з Authenticator
              <Input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" maxLength={6} placeholder="123456" />
            </label>
            <Button type="button" disabled={isPending || !/^\d{6}$/.test(code)} onClick={verifyEnrollment}>
              Підтвердити 2FA
            </Button>
          </div>
        </div>
      ) : null}

      {message ? <p className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">{message}</p> : null}
      {error ? <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
