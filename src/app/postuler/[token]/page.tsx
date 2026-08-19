import { createAdminClient } from "@/lib/supabase/admin";
import { Card, Badge } from "@/components/ui/card";
import { PostulerForm } from "@/components/candidatures/postuler-form";
import type { AnnonceAvecProjet } from "@/lib/annonces/types";
import { projetNomPublic } from "@/lib/projets/types";
import { getAnnonceQuestions } from "@/lib/annonces/questions";
import { getAnnonceDates } from "@/lib/annonces/dates";

export default async function PostulerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: annonce } = await supabase
    .from("annonces")
    .select("*, projets(nom, confidentiel, nom_code, signature)")
    .eq("public_token", token)
    .single<AnnonceAvecProjet>();

  if (!annonce) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Annonce introuvable</h1>
        <p className="text-text-muted">Ce lien n&apos;est plus valide.</p>
      </div>
    );
  }

  let complet = false;
  if (annonce.limite_candidatures !== null) {
    const { count } = await supabase
      .from("candidatures")
      .select("id", { count: "exact", head: true })
      .eq("annonce_id", annonce.id);
    complet = (count ?? 0) >= annonce.limite_candidatures;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-display text-lg font-semibold">
          Booking<span className="text-coral">Extras</span>
        </span>
      </div>

      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{annonce.titre}</h1>
          {annonce.statut === "fermée" && <Badge>Fermée</Badge>}
        </div>
        <p className="mt-1 text-text-muted">
          {projetNomPublic(annonce.projets)}
          {annonce.date_recherchee ? ` · ${annonce.date_recherchee}` : ""}
          {annonce.lieu ? ` · ${annonce.lieu}` : ""}
        </p>
      </div>

      {annonce.description && (
        <Card>
          <p className="text-sm whitespace-pre-wrap">{annonce.description}</p>
        </Card>
      )}

      {annonce.projets?.signature && (
        <p className="whitespace-pre-wrap text-sm text-text-muted">{annonce.projets.signature}</p>
      )}

      {annonce.statut === "ouverte" && !complet ? (
        <PostulerForm
          publicToken={annonce.public_token}
          questions={await getAnnonceQuestions(annonce.id)}
          dates={await getAnnonceDates(annonce.id)}
        />
      ) : (
        <Card>
          <p className="text-sm text-text-muted">
            {complet
              ? "Cette annonce a atteint son nombre maximum de candidatures."
              : "Cette annonce n'accepte plus de candidatures pour le moment."}
          </p>
        </Card>
      )}
    </div>
  );
}
