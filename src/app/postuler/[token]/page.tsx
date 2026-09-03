import Image from "next/image";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, Badge } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { PostulerForm } from "@/components/candidatures/postuler-form";
import type { AnnonceAvecProjet } from "@/lib/annonces/types";
import { projetNomPublic } from "@/lib/projets/types";
import { getAnnonceQuestions } from "@/lib/annonces/questions";
import { getAnnonceDates } from "@/lib/annonces/dates";
import { getAnnoncePhotos } from "@/lib/annonces/moodboard";
import { getAnnoncePhotoUrl } from "@/lib/projets/annonce-photo";
import { getCurrentFigurant } from "@/lib/candidats/session";
import { formatAnnonceDatesLabel } from "@/lib/format-date";
import { LIEN_BANDE_DEMO } from "@/lib/figurants/types";
import { getProjetOwnerNames } from "@/lib/projets/signature";

export default async function PostulerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: annonce } = await supabase
    .from("annonces")
    .select("*, projets(nom, confidentiel, nom_code, signature, annonce_photo_storage_path)")
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

  const [moodboardPhotos, annonceDates, ownerNames] = await Promise.all([
    getAnnoncePhotos(supabase, annonce.id),
    getAnnonceDates(annonce.id),
    getProjetOwnerNames(supabase, [annonce.projet_id]),
  ]);
  const photoUrl = getAnnoncePhotoUrl(supabase, annonce.projets?.annonce_photo_storage_path);
  const datesLabel = formatAnnonceDatesLabel(annonceDates, annonce.date_recherchee);
  const chefNom = ownerNames.get(annonce.projet_id);

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
    adresse: string | null;
    code_postal: string | null;
    commune_naissance: string | null;
    date_naissance: string | null;
    lien_bande_demo: string | null;
    taille_cm: number | null;
    poids_kg: number | null;
    pointure: number | null;
    veste: string | null;
    pantalon: string | null;
    genre: string | null;
    pronom: string | null;
    agent_nom?: string | null;
    agent_email?: string | null;
    agent_telephone?: string | null;
    agent_agence?: string | null;
  } | undefined;
  if (session) {
    const [{ data: figurantComplet }, { data: lienBandeDemo }] = await Promise.all([
      supabase
        .from("figurants")
        .select(
          "prenom, nom, email, telephone, ville, adresse, code_postal, commune_naissance, date_naissance, taille_cm, poids_kg, pointure, veste, pantalon, genre, pronom, agent_nom, agent_email, agent_telephone, agent_agence"
        )
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
        adresse: figurantComplet.adresse,
        code_postal: figurantComplet.code_postal,
        commune_naissance: figurantComplet.commune_naissance,
        date_naissance: figurantComplet.date_naissance,
        lien_bande_demo: lienBandeDemo?.url ?? null,
        taille_cm: figurantComplet.taille_cm,
        poids_kg: figurantComplet.poids_kg,
        pointure: figurantComplet.pointure,
        veste: figurantComplet.veste,
        pantalon: figurantComplet.pantalon,
        genre: figurantComplet.genre,
        pronom: figurantComplet.pronom,
        agent_nom: figurantComplet.agent_nom,
        agent_email: figurantComplet.agent_email,
        agent_telephone: figurantComplet.agent_telephone,
        agent_agence: figurantComplet.agent_agence,
      };
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Logo iconSize={26} textClassName="text-lg" />
      </div>

      <div>
        <div className="flex items-center gap-3">
          {photoUrl && (
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-ink-raised-2">
              <Image src={photoUrl} alt="" fill className="object-cover" />
            </div>
          )}
          <h1 className="text-2xl font-semibold">{annonce.titre}</h1>
          {annonce.statut === "fermée" && <Badge>Fermée</Badge>}
        </div>
        <p className="mt-1 text-text-muted">
          {projetNomPublic(annonce.projets)}
          {chefNom ? ` · ${chefNom}` : ""}
          {annonce.lieu ? ` · ${annonce.lieu}` : ""}
        </p>
        {datesLabel && (
          <p className="mt-0.5 text-sm text-text-muted">
            <span className="font-medium text-text">Dates : </span>
            {datesLabel}
          </p>
        )}
        {annonce.types_cachet.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {annonce.types_cachet.map((t) => (
              <Badge key={t} tone="turquoise">
                {t}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {annonce.description && (
        <Card>
          <p className="text-sm whitespace-pre-wrap">{annonce.description}</p>
        </Card>
      )}

      {moodboardPhotos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {moodboardPhotos.map((p) => (
            <div key={p.id} className="relative aspect-square overflow-hidden rounded-xl bg-ink-raised-2">
              <Image src={p.url} alt="" fill className="object-cover" />
            </div>
          ))}
        </div>
      )}

      {annonce.projets?.signature && (
        <p className="whitespace-pre-wrap text-sm text-text-muted">{annonce.projets.signature}</p>
      )}

      {annonce.statut === "ouverte" && !complet ? (
        <PostulerForm
          publicToken={annonce.public_token}
          questions={await getAnnonceQuestions(annonce.id)}
          dates={annonceDates}
          prefill={prefill}
          bandeDemoObligatoire={annonce.bande_demo_obligatoire}
          showAgent={annonce.types_cachet.includes("Rôle")}
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

      <Link href="/compte/connexion" className="text-center text-sm text-coral hover:underline">
        Voir toutes les annonces ouvertes / me connecter à mon espace →
      </Link>
    </div>
  );
}
