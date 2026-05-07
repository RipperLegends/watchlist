import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";

export default function RegisterPage() {
  return (
    <div className="page-shell flex min-h-[70vh] flex-col items-center justify-center gap-5">
      <AuthForm mode="register" />
      <p className="text-sm text-muted-foreground">
        Уже маєте акаунт?{" "}
        <Link href="/login" className="font-semibold text-primary">
          Увійдіть
        </Link>
      </p>
    </div>
  );
}
