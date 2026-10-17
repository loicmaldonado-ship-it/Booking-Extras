import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { getCurrentFigurant } from "@/lib/candidats/session";
import { projetNomPublic } from "@/lib/projets/types";
import { formatTournageLabel } from "@/lib/casting/types";
import { formatDateLong } from "@/lib/format-date";
import { RejoindreBouton } from "@/components/casting/rejoindre-bouton";

export const dynamic = "force-dynamic";

// Lien rapide de casting (un par rôle) : à envoyer à plusieurs personnes.
// Chacune se connecte ou crée son compte, puis envoie les photos / vidéos
// demandées — sa fiche casting se crée toute seule dans le rôle.
export default async function RejoindreCastingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = createAdminClient();
  const { data: role } = /^[0-9a-f-]{36}$/i.test(token)
    ? await supabase
        .from("casting_roles")
        .select(
          "id, nom, nb_videos, photo_labels, demande_bande_demo, date_tournage, date_tournage_fin, date_limite_envoi, lien_public_actif, projets(nom, confidentiel, nom_code)"
        )
        .eq("public_token", token)
        .maybeSingle<{
          id: string;
          nom: string;
          nb_videos: number;
          photo_labels: string[];
          demande_bande_demo: boolean;
          date_tournage: string | null;
          date_tournage_fin: string | null;
          date_limite_envoi: string | null;
          lien_public_actif: boolean;
          projets: { nom: string; confidentiel: boolean; nom_code: string | null } | null;
        }>()
    : { data: null };

  const entete = (
    <Link href="/" aria-label="Accueil">
      <Logo iconSize={26} textClassName="text-lg" />
    </Link>
  );

  if (!role || !role.lien_public_actif) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
        {entete}
        <Card className="flex flex-col gap-2">
          <h1 className="text-lg font-semibold">Casting fermé</h1>
          <p className="text-sm text-text-muted">Ce lien de casting n&apos;est plus actif.</p>
        </Card>
      </div>
    );
  }

  const deadlinePassee = !!role.date_limite_envoi && role.date_limite_envoi < new Date().toISOString().slice(0, 10);
  const tournage = formatTournageLabel(role.date_tournage, role.date_tournage_fin);
  const retour = `/casting/rejoindre/${token}`;
  const session = await getCurrentFigurant();

  // Déjà inscrit·e à ce rôle (sa fiche ou sa fiche comédien·ne) ?
  let dejaEnvoye = false;
  if (session?.email) {
    const { data: entrees } = await supabase
      .from("casting_entries")
      .select("submitted_at, figurants!inner(email)")
      .eq("role_id", role.id)
      .ilike("figurants.email", session.email)
      .returns<{ submitted_at: string | null }[]>();
    dejaEnvoye = (entrees ?? []).some((e) => !!e.submitted_at);
  }

  const demandes = [
    role.photo_labels.length > 0 &&
      `${role.photo_labels.length} photo${role.photo_labels.length > 1 ? "s" : ""} (${role.photo_labels.join(", ")})`,
    role.nb_videos > 0 && `${role.nb_videos} vidéo${role.nb_videos > 1 ? "s" : ""}`,
    role.demande_bande_demo && "ta bande démo",
  ].filter(Boolean) as string[];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      {entete}
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-text-muted">
          Casting · {projetNomPublic(role.projets)}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{role.nom}</h1>
        {tournage && <p className="mt-1 text-text-muted">Tournage : {tournage}</p>}
        {role.date_limite_envoi && !deadlinePassee && (
          <p className="mt-1 text-sm text-coral">À envoyer avant le {formatDateLong(role.date_limite_envoi)}.</p>
        )}
      </div>

      {demandes.length > 0 && (
        <Card className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-text-muted">Ce qu&apos;on te demande</h2>
          <p>{demandes.join(" · ")}</p>
        </Card>
      )}

      {deadlinePassee ? (
        <Card className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-danger">Délai dépassé</h2>
          <p className="text-sm text-text-muted">
            La date limite d&apos;envoi ({formatDateLong(role.date_limite_envoi!)}) est passée.
          </p>
        </Card>
      ) : dejaEnvoye ? (
        <Card className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-turquoise">Déjà envoyé</h2>
          <p className="text-sm text-text-muted">
            Tout a bien été reçu pour ce rôle. L&apos;équipe de casting te recontacte si besoin.
          </p>
        </Card>
      ) : session ? (
        <Card className="flex flex-col gap-3">
          <p>
            Connecté·e en tant que <strong>{session.prenom} {session.nom}</strong>.
          </p>
          <RejoindreBouton token={token} libelle="Envoyer mes photos et vidéos →" />
        </Card>
      ) : (
        <Card className="flex flex-col gap-4">
          <p>Pour participer, connecte-toi à ton espace — ou crée ton compte, c&apos;est gratuit.</p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/compte/connexion?retour=${encodeURIComponent(retour)}`}
              className="rounded-full bg-coral px-5 py-2.5 text-sm font-semibold text-ink hover:bg-coral-hover"
            >
              J&apos;ai déjà un compte
            </Link>
            <Link
              href={`/compte/inscription?retour=${encodeURIComponent(retour)}`}
              className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold hover:border-coral/60"
            >
              Créer mon compte
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
