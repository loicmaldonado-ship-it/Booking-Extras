import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { Logo } from "@/components/ui/logo";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo iconSize={48} stacked textClassName="text-2xl" />
        </div>
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
