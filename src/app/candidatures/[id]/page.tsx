import { notFound } from "next/navigation";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, Badge } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { BackLink } from "@/components/ui/back-link";
import { CandidatureRow } from "@/components/candidatures/candidature-row";
import { getPhotosByFigurantId, pickPortrait } from "@/lib/documents/data";
import { ZoomButton, type GalleryPhoto } from "@/components/ui/zoomable-image";
import { projetNomPublic } from "@/lib/projets/types";
import { formatDateShort, formatDateTime } from "@/lib/format-date";
import { computeAge } from "@/lib/documents/fields";
import type { Cachet, CandidatureOnglet } from "@/lib/candidatures/types";
import { LIEN_BANDE_DEMO, LIEN_INSTAGRAM, type Figurant } from "@/lib/figurants/types";
import { requireProjetAccess } from "@/lib/auth/session";
import { findPossibleDuplicates } from "@/lib/figurants/duplicates";
import { DuplicateWarning } from "@/components/figurants/duplicate-warning";
import { SendEspacePersoButton } from "@/components/figurants/send-espace-perso-button";

type CandidatureDetail = {
  id: string;
  onglet_id: string | null;
  fonction_assignee: string | null;
  cachet_assigne: Cachet | null;
  message: string | null;
  created_at: string;
  figurants: Figurant | null;
  annonces: {
    id: string;
    titre: string;
    projet_id: string;
    projets: { nom: string; confidentiel: boolean; nom_code: string | null } | null;
  } | null;
};

export default async function CandidatureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: candidature } = await supabase
    .from("candidatures")
    .select(
      "id, onglet_id, fonction_assignee, cachet_assigne, message, created_at, figurants(*), annonces(id, titre, projet_id, projets(nom, confidentiel, nom_code))"
    )
    .eq("id", id)
    .single<CandidatureDetail>();

  if (!candidature || !candidature.figurants) notFound();
  await requireProjetAccess(candidature.annonces?.projet_id);

  const f = candidature.figurants;
  const { data: lienBooking } = await supabase
    .from("bookings")
    .select("id")
    .eq("candidature_id", candidature.id)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: onglets } = await supabase
    .from("candidature_onglets")
    .select("id, nom, couleur, fixe, ordre")
    .order("ordre")
    .returns<CandidatureOnglet[]>();
  const ongletActuel = (onglets ?? []).find((o) => o.id === candidature.onglet_id);

  const [{ data: photosRaw }, { data: reponsesRaw }, { data: disposRaw }, { data: liens }] = await Promise.all([
    getPhotosByFigurantId([f.id]).then((map) => ({ data: map.get(f.id) ?? [] })),
    supabase
      .from("candidature_reponses")
      .select("reponse, annonce_questions(label)")
      .eq("candidature_id", id)
      .returns<{ reponse: boolean; annonce_questions: { label: string } | null }[]>(),
    supabase
      .from("candidature_disponibilites")
      .select("disponible, annonce_dates(date)")
      .eq("candidature_id", id)
      .returns<{ disponible: boolean; annonce_dates: { date: string } | null }[]>(),
    supabase.from("figurant_liens").select("label, url").eq("figurant_id", f.id),
  ]);

  const duplicates = await findPossibleDuplicates(f.id);

  const lienBandeDemo = (liens ?? []).find((l) => l.label === LIEN_BANDE_DEMO)?.url ?? null;
  const lienInstagram = (liens ?? []).find((l) => l.label === LIEN_INSTAGRAM)?.url ?? null;

  const photos = photosRaw ?? [];
  const portrait = pickPortrait(photos);
  const age = computeAge(f.date_naissance);

  const photosWithUrl = photos.filter((p) => p.url);
  const gallery: GalleryPhoto[] = photosWithUrl.map((p) => ({ src: p.url!, alt: p.type }));
  function galleryIndex(photoId: string) {
    return photosWithUrl.findIndex((p) => p.id === photoId);
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <BackLink href="/candidatures" label="Candidatures" />

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-ink-raised-2">
            {portrait?.url && (
              <>
                <Image src={portrait.url} alt="" fill className="object-cover" />
                <ZoomButton src={portrait.url} gallery={gallery} index={galleryIndex(portrait.id)} />
              </>
            )}
          </div>
          <div>
            <h1 className="text-3xl font-semibold">
              {f.prenom} {f.nom}
            </h1>
            <p className="mt-1 text-text-muted">
              {candidature.annonces?.titre} · {projetNomPublic(candidature.annonces?.projets)}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Dernière connexion : {f.last_seen_at ? formatDateTime(f.last_seen_at) : "Jamais connecté·e"}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge tone={ongletActuel?.couleur === "danger" ? "danger" : ongletActuel?.couleur === "coral" ? "coral" : "default"}>
            {ongletActuel?.nom ?? "À trier"}
          </Badge>
          {lienBooking ? (
            <ButtonLink href={`/bookings/${lienBooking.id}`} variant="secondary">
              → Voir le booking
            </ButtonLink>
          ) : (
            <ButtonLink href={`/bookings/nouveau?figurant_id=${f.id}&projet_id=${candidature.annonces?.projet_id ?? ""}`}>
              + Ajouter à un booking
            </ButtonLink>
          )}
          {candidature.annonces?.projet_id && (
            <SendEspacePersoButton figurantId={f.id} projetId={candidature.annonces.projet_id} email={f.email} />
          )}
        </div>
      </div>

      <DuplicateWarning figurantId={f.id} figurantNom={`${f.prenom} ${f.nom}`} duplicates={duplicates} />

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Rangement de la candidature</h2>
        <CandidatureRow
          id={candidature.id}
          ongletId={candidature.onglet_id}
          onglets={onglets ?? []}
          fonctionAssignee={candidature.fonction_assignee}
          cachetAssigne={candidature.cachet_assigne}
        />
        <p className="text-xs text-text-muted">Reçue le {formatDateShort(candidature.created_at)}</p>
      </Card>

      {candidature.message && (
        <Card className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Message</h2>
          <p className="text-sm whitespace-pre-wrap">{candidature.message}</p>
        </Card>
      )}

      {(reponsesRaw ?? []).length > 0 && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Questions</h2>
          <div className="flex flex-col gap-2 text-sm">
            {(reponsesRaw ?? []).map((r, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-text-muted">{r.annonce_questions?.label}</span>
                <Badge tone={r.reponse ? "turquoise" : "default"}>{r.reponse ? "Oui" : "Non"}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {(disposRaw ?? []).length > 0 && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Disponibilités demandées</h2>
          <div className="flex flex-col gap-2 text-sm">
            {(disposRaw ?? []).map((d, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-text-muted">
                  {d.annonce_dates?.date ? formatDateShort(d.annonce_dates.date) : "—"}
                </span>
                <Badge tone={d.disponible ? "turquoise" : "danger"}>
                  {d.disponible ? "Disponible" : "Pas disponible"}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Contact</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-text-muted">Email : </span>
            {f.email ?? "—"}
          </div>
          <div>
            <span className="text-text-muted">Téléphone : </span>
            {f.telephone ?? "—"}
          </div>
          <div>
            <span className="text-text-muted">Ville : </span>
            {f.ville ?? "—"}
          </div>
          <div>
            <span className="text-text-muted">Âge : </span>
            {age !== null ? `${age} ans` : "—"}
          </div>
          <div>
            <span className="text-text-muted">Bande démo : </span>
            {lienBandeDemo ? (
              <a href={lienBandeDemo} target="_blank" rel="noreferrer" className="text-coral hover:underline">
                Voir le lien
              </a>
            ) : (
              "—"
            )}
          </div>
          <div>
            <span className="text-text-muted">Instagram : </span>
            {lienInstagram ? (
              <a href={lienInstagram} target="_blank" rel="noreferrer" className="text-coral hover:underline">
                Voir le lien
              </a>
            ) : (
              "—"
            )}
          </div>
          <div>
            <span className="text-text-muted">Véhicule : </span>
            {f.a_vehicule === null ? (
              "Non renseigné"
            ) : f.a_vehicule ? (
              <>
                <Badge tone="turquoise">Oui</Badge>{" "}
                {[f.vehicule_velo && "Vélo", f.vehicule_moto && "Moto", f.vehicule_scooter && "Scooter"]
                  .filter(Boolean)
                  .join(", ")}
                {f.vehicule_marque ? ` (${f.vehicule_marque})` : ""}
              </>
            ) : (
              <Badge>Non</Badge>
            )}
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Mensurations</h2>
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div>
            <span className="text-text-muted">Hauteur : </span>
            {f.taille_cm ? `${f.taille_cm} cm` : "—"}
          </div>
          <div>
            <span className="text-text-muted">Poids : </span>
            {f.poids_kg ? `${f.poids_kg} kg` : "—"}
          </div>
          <div>
            <span className="text-text-muted">Pointure : </span>
            {f.pointure ?? "—"}
          </div>
          <div>
            <span className="text-text-muted">Yeux : </span>
            {f.couleur_yeux ?? "—"}
          </div>
          <div>
            <span className="text-text-muted">Cheveux : </span>
            {f.couleur_cheveux ?? "—"}
          </div>
        </div>
      </Card>

      {photos.length > 0 && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Photos</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((p) => (
              <div key={p.id} className="relative aspect-square overflow-hidden rounded-lg bg-ink-raised-2">
                {p.url && (
                  <>
                    <Image src={p.url} alt={p.type} fill className="object-cover" />
                    <ZoomButton src={p.url} alt={p.type} gallery={gallery} index={galleryIndex(p.id)} />
                  </>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <a href={`/figurants/${f.id}`} className="text-sm text-text-muted hover:text-coral">
        Voir la fiche complète du profil →
      </a>
    </div>
  );
}
