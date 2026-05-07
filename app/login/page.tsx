import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";

export default function LoginPage() {
  return (
    <div className="page-shell flex min-h-[70vh] flex-col items-center justify-center gap-5">
      <AuthForm mode="login" />
      <p className="text-sm text-muted-foreground">
        Немає акаунта?{" "}
        <Link href="/register" className="font-semibold text-primary">
          Зареєструйтесь
        </Link>
      </p>
    </div>
  );
}
