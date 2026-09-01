import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { CastingUploadForm } from "@/components/casting/casting-upload-form";
import { formatDateLong } from "@/lib/format-date";

// Marge de sécurité pour les Server Actions de cette page (génération d'URL
// signée, finalisation) — elles ne reçoivent plus de fichier volumineux
// (upload direct vers Supabase Storage depuis le navigateur), donc ça ne
// devrait jamais approcher cette limite, mais coûte rien à fixer large.
export const maxDuration = 30;

export default async function CastingUploadPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: entry } = await supabase
    .from("casting_entries")
    .select(
      "id, submitted_at, figurants(prenom), casting_roles(nom, nb_videos, photo_labels, demande_bande_demo, date_limite_envoi)"
    )
    .eq("request_token", token)
    .maybeSingle<{
      id: string;
      submitted_at: string | null;
      figurants: { prenom: string } | null;
      casting_roles: {
        nom: string;
        nb_videos: number;
        photo_labels: string[];
        demande_bande_demo: boolean;
        date_limite_envoi: string | null;
      } | null;
    }>();

  if (!entry) {
    return (
      <Card className="flex flex-col gap-2">
        <h1 className="text-lg font-semibold">Lien introuvable</h1>
        <p className="text-sm text-text-muted">Ce lien n&apos;est plus valide.</p>
      </Card>
    );
  }

  const dateLimite = entry.casting_roles?.date_limite_envoi ?? null;
  const deadlinePassed = !!dateLimite && dateLimite < new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Logo iconSize={26} textClassName="text-lg" />
        <h1 className="mt-4 text-2xl font-semibold">Bonjour {entry.figurants?.prenom}</h1>
        <p className="mt-1 text-text-muted">
          {entry.casting_roles
            ? `Pour le rôle « ${entry.casting_roles.nom} », envoie-nous ce qui est demandé ci-dessous.`
            : "Envoie une courte vidéo de présentation (et des photos si tu veux) pour ta candidature."}
        </p>
        {dateLimite && !entry.submitted_at && !deadlinePassed && (
          <p className="mt-1 text-sm text-coral">Merci de nous répondre avant le {formatDateLong(dateLimite)}.</p>
        )}
      </div>

      {entry.submitted_at ? (
        <Card className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-turquoise">Déjà envoyé</h2>
          <p className="text-sm text-text-muted">
            Tout a bien été reçu. L&apos;équipe de casting te recontacte si besoin.
          </p>
        </Card>
      ) : deadlinePassed ? (
        <Card className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-danger">Délai dépassé</h2>
          <p className="text-sm text-text-muted">
            La date limite d&apos;envoi ({formatDateLong(dateLimite!)}) est passée. Contacte l&apos;équipe de
            casting si tu penses qu&apos;il s&apos;agit d&apos;une erreur.
          </p>
        </Card>
      ) : (
        <CastingUploadForm
          token={token}
          nbVideos={entry.casting_roles?.nb_videos ?? 1}
          photoLabels={entry.casting_roles?.photo_labels ?? []}
          demandeBandeDemo={entry.casting_roles?.demande_bande_demo ?? false}
        />
      )}
    </div>
  );
}
