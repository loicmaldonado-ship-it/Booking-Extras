import { AcceptInviteForm } from "@/components/auth/accept-invite-form";

export default function AcceptInvitePage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="font-display text-2xl font-semibold tracking-tight">
            Booking<span className="text-coral">Extras</span>
          </span>
        </div>
        <AcceptInviteForm />
      </div>
    </div>
  );
}
