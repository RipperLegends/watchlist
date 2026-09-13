import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <div className="page-shell flex min-h-[70vh] flex-col items-center justify-center gap-5">
      <ResetPasswordForm />
    </div>
  );
}
