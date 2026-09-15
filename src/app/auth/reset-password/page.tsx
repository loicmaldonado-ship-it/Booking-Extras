import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";

export default async function ResetPasswordPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo iconSize={48} stacked textClassName="text-2xl" />
        </div>
        {user ? (
          <ResetPasswordForm />
        ) : (
          <Card>
            <p className="text-sm text-danger">
              Lien expiré ou invalide. Redemande un lien depuis la page de connexion.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
