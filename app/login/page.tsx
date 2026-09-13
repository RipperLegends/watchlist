import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";

type LoginPageProps = {
  searchParams?: Promise<{ reset?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = searchParams ? await searchParams : {};
  const passwordReset = params.reset === "1";

  return (
    <div className="page-shell flex min-h-[70vh] flex-col items-center justify-center gap-5">
      {passwordReset ? (
        <p className="w-full max-w-md rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
          Пароль оновлено. Увійдіть з новим паролем.
        </p>
      ) : null}
      <AuthForm mode="login" />
      <Link href="/forgot-password" className="text-sm font-semibold text-primary">
        Забули пароль?
      </Link>
      <p className="text-sm text-muted-foreground">
        Немає акаунта?{" "}
        <Link href="/register" className="font-semibold text-primary">
          Зареєструйтесь
        </Link>
      </p>
    </div>
  );
}
