import { createAdminClient } from "@/lib/supabase/admin";
import { Card, Badge } from "@/components/ui/card";
import { PostulerForm } from "@/components/candidatures/postuler-form";
import type { AnnonceAvecProjet } from "@/lib/annonces/types";
import { projetNomPublic } from "@/lib/projets/types";
import { getAnnonceQuestions } from "@/lib/annonces/questions";
import { getAnnonceDates } from "@/lib/annonces/dates";
import { getCurrentFigurant } from "@/lib/candidats/session";
import { formatDateShort } from "@/lib/format-date";
import { LIEN_BANDE_DEMO } from "@/lib/figurants/types";

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

  // Si le candidat est connecté (via son espace /compte), on pré-remplit
  // ses infos de contact — pas besoin de tout retaper à chaque candidature.
  const session = await getCurrentFigurant();
  let prefill: {
    prenom: string;
    nom: string;
    email: string;
    telephone: string | null;
    ville: string | null;
    date_naissance: string | null;
    lien_bande_demo: string | null;
    taille_cm: number | null;
    poids_kg: number | null;
    pointure: number | null;
    veste: string | null;
    pantalon: string | null;
  } | undefined;
  if (session) {
    const [{ data: figurantComplet }, { data: lienBandeDemo }] = await Promise.all([
      supabase
        .from("figurants")
        .select("prenom, nom, email, telephone, ville, date_naissance, taille_cm, poids_kg, pointure, veste, pantalon")
        .eq("id", session.id)
        .single(),
      supabase
        .from("figurant_liens")
        .select("url")
        .eq("figurant_id", session.id)
        .eq("label", LIEN_BANDE_DEMO)
        .maybeSingle(),
    ]);
    if (figurantComplet?.email) {
      prefill = {
        prenom: figurantComplet.prenom,
        nom: figurantComplet.nom,
        email: figurantComplet.email,
        telephone: figurantComplet.telephone,
        ville: figurantComplet.ville,
        date_naissance: figurantComplet.date_naissance,
        lien_bande_demo: lienBandeDemo?.url ?? null,
        taille_cm: figurantComplet.taille_cm,
        poids_kg: figurantComplet.poids_kg,
        pointure: figurantComplet.pointure,
        veste: figurantComplet.veste,
        pantalon: figurantComplet.pantalon,
      };
    }
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
          {annonce.date_recherchee ? ` · ${formatDateShort(annonce.date_recherchee)}` : ""}
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
          prefill={prefill}
          bandeDemoObligatoire={annonce.bande_demo_obligatoire}
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
