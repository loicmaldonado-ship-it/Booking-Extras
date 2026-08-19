import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCurrentFigurant } from "@/lib/candidats/session";
import { logoutFigurant } from "@/lib/candidats/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { MessageThread } from "@/components/candidats/message-thread";
import { PushSubscribe } from "@/components/candidats/push-subscribe";
import type { FigurantMessage } from "@/lib/candidats/types";

export const dynamic = "force-dynamic";

export default async function CompteCandidatPage() {
  const figurant = await getCurrentFigurant();

  if (!figurant) {
    redirect("/compte/connexion");
  }

  const supabase = createAdminClient();
  const { data: messages } = await supabase
    .from("figurant_messages")
    .select("*")
    .eq("figurant_id", figurant.id)
    .order("created_at", { ascending: true })
    .returns<FigurantMessage[]>();

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 py-10">
      <div>
        <span className="font-display text-lg font-semibold">
          Booking<span className="text-coral">Extras</span>
        </span>
        <h1 className="mt-4 text-2xl font-semibold">
          Bonjour {figurant.prenom} {figurant.nom}
        </h1>
        <p className="mt-1 text-text-muted">Votre espace personnel.</p>
      </div>

      <PushSubscribe />

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Messages</h2>
        <MessageThread messages={messages ?? []} />
      </Card>

      <form action={logoutFigurant}>
        <Button type="submit" variant="ghost">
          Se déconnecter
        </Button>
      </form>
    </div>
  );
}
