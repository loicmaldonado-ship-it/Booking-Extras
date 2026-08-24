import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { CastingUploadForm } from "@/components/casting/casting-upload-form";

export default async function CastingUploadPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: entry } = await supabase
    .from("casting_entries")
    .select("id, submitted_at, figurants(prenom)")
    .eq("request_token", token)
    .maybeSingle<{ id: string; submitted_at: string | null; figurants: { prenom: string } | null }>();

  if (!entry) {
    return (
      <Card className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold">Lien introuvable</h1>
        <p className="text-sm text-text-muted">Ce lien n&apos;est plus valide.</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-display text-lg font-semibold">
          Booking<span className="text-coral">Extras</span>
        </span>
        <h1 className="mt-4 text-2xl font-semibold">Bonjour {entry.figurants?.prenom}</h1>
        <p className="mt-1 text-text-muted">
          Envoie une courte vidéo de présentation (et des photos si tu veux) pour ta candidature.
        </p>
      </div>

      {entry.submitted_at ? (
        <Card className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-turquoise">Déjà envoyé</h2>
          <p className="text-sm text-text-muted">
            Ta vidéo a bien été reçue. L&apos;équipe de casting te recontacte si besoin.
          </p>
        </Card>
      ) : (
        <CastingUploadForm token={token} />
      )}
    </div>
  );
}
