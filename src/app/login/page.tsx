import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/ui/logo";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo iconSize={48} stacked textClassName="text-2xl" />
        </div>
        <LoginForm next={next ?? "/"} />
      </div>
    </div>
  );
}
