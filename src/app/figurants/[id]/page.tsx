import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, Badge } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { CopyLink } from "@/components/annonces/copy-link";
import { AvailabilityCalendar } from "@/components/figurants/availability-calendar";
import { PhotoDropzones } from "@/components/figurants/photo-dropzones";
import { BackLink } from "@/components/ui/back-link";
import { MessageriePanel } from "@/components/figurants/messagerie-panel";
import { CopyEmailButton } from "@/components/figurants/copy-email-button";
import { smsConversationHref } from "@/lib/bookings/covoiturage-messages";
import type { Figurant, FigurantLien, FigurantPhoto } from "@/lib/figurants/types";
import type { FigurantMessage } from "@/lib/candidats/types";
import { deleteFigurant, deleteLien } from "@/lib/figurants/actions";
import { formatDateShort } from "@/lib/format-date";

type FigurantBookingRow = {
  id: string;
  date: string;
  heure_convocation: string | null;
  fonction: string | null;
  statut: string;
  projet_id: string;
  projets: { nom: string; confidentiel: boolean } | null;
};

export default async function FigurantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: figurant } = await supabase
    .from("figurants")
    .select("*")
    .eq("id", id)
    .single<Figurant>();

  if (!figurant) notFound();

  const { data: photosRaw } = await supabase
    .from("figurant_photos")
    .select("*")
    .eq("figurant_id", id)
    .returns<FigurantPhoto[]>();

  const { data: liens } = await supabase
    .from("figurant_liens")
    .select("*")
    .eq("figurant_id", id)
    .returns<FigurantLien[]>();

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, date, heure_convocation, fonction, statut, projet_id, projets(nom, confidentiel)")
    .eq("figurant_id", id)
    .order("date", { ascending: true })
    .returns<FigurantBookingRow[]>();

  const { data: indispos } = await supabase
    .from("figurant_indisponibilites")
    .select("date")
    .eq("figurant_id", id);

  const { data: messages } = await supabase
    .from("figurant_messages")
    .select("*")
    .eq("figurant_id", id)
    .order("created_at", { ascending: true })
    .returns<FigurantMessage[]>();

  const { data: costumes } = await supabase
    .from("essayages")
    .select("id, numero_costume, projets(nom)")
    .eq("figurant_id", id)
    .not("numero_costume", "is", null)
    .returns<{ id: string; numero_costume: string; projets: { nom: string } | null }[]>();

  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const protocol = host?.startsWith("localhost") || host?.startsWith("127.0.0.1") ? "http" : "https";
  const disponibiliteUrl = `${protocol}://${host}/disponibilites/${figurant.token_disponibilite}`;

  const photos = await Promise.all(
    (photosRaw ?? []).map(async (p) => {
      const { data } = await supabase.storage
        .from("figurant-photos")
        .createSignedUrl(p.storage_path, 60 * 60);
      return { ...p, url: data?.signedUrl };
    })
  );

  const boundDeleteFigurant = deleteFigurant.bind(null, id);

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <BackLink href="/figurants" label="Base Profils" />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold">
            {figurant.civilite ? `${figurant.civilite} ` : ""}
            {figurant.prenom} {figurant.nom}
          </h1>
          <p className="mt-1 text-text-muted">
            {figurant.ville ?? "Ville non renseignée"}
            {figurant.pronom ? ` · ${figurant.pronom}` : ""}
            {figurant.genre ? ` · ${figurant.genre}` : ""}
          </p>
        </div>
        <div className="flex gap-3">
          <ButtonLink href={`/figurants/${id}/fiche`} variant="secondary">
            Fiche mensuration
          </ButtonLink>
          <ButtonLink href={`/figurants/${id}/modifier`} variant="secondary">
            Modifier
          </ButtonLink>
          <form action={boundDeleteFigurant}>
            <Button type="submit" variant="ghost">
              Supprimer
            </Button>
          </form>
        </div>
      </div>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Contact</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-text-muted">Email : </span>
            {figurant.email ?? "—"}
            {figurant.email && <CopyEmailButton email={figurant.email} />}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-text-muted">Téléphone : </span>
            {figurant.telephone ?? "—"}
            {figurant.telephone && (
              <a href={smsConversationHref(figurant.telephone)} className="text-xs text-coral hover:underline">
                Ouvrir la conversation ↗
              </a>
            )}
          </div>
          <div>
            <span className="text-text-muted">Date de naissance : </span>
            {figurant.date_naissance ?? "—"}
          </div>
          <div>
            <span className="text-text-muted">Commune de naissance : </span>
            {figurant.commune_naissance ?? "—"}
          </div>
          <div>
            <span className="text-text-muted">Adresse : </span>
            {figurant.adresse ?? "—"}
          </div>
          <div>
            <span className="text-text-muted">Compte Myrole : </span>
            {figurant.compte_myrole ? (
              <Badge tone="turquoise">Oui</Badge>
            ) : (
              <Badge>Non</Badge>
            )}
          </div>
        </div>
        {figurant.logement_france && (
          <div className="text-sm">
            <span className="text-text-muted">Peut loger en France : </span>
            {figurant.logement_france}
          </div>
        )}
        {costumes && costumes.length > 0 && (
          <div className="text-sm">
            <span className="text-text-muted">Numéro(s) de costume : </span>
            {costumes.map((c, i) => (
              <span key={c.id}>
                {i > 0 && ", "}
                <Badge tone="coral">{c.numero_costume}</Badge>
                {c.projets?.nom ? ` (${c.projets.nom})` : ""}
              </span>
            ))}
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Messagerie interne</h2>
        <p className="text-sm text-text-muted">
          Message direct dans l&apos;espace du figurant, sans passer par email ou SMS. Il·elle doit se connecter
          sur son compte pour le lire.
        </p>
        <MessageriePanel
          figurantId={id}
          figurantEmail={figurant.email}
          figurantPrenom={figurant.prenom}
          messages={messages ?? []}
        />
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Disponibilités</h2>
        <p className="text-sm text-text-muted">
          Envoie ce lien au figurant pour qu&apos;il déclare lui-même ses jours indisponibles.
        </p>
        <CopyLink url={disponibiliteUrl} />
        <AvailabilityCalendar
          token={figurant.token_disponibilite}
          initialDates={(indispos ?? []).map((i) => i.date)}
          readOnly
        />
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Mensurations</h2>
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div><span className="text-text-muted">Hauteur : </span>{figurant.taille_cm ? `${figurant.taille_cm} cm` : "—"}</div>
          <div><span className="text-text-muted">Poids : </span>{figurant.poids_kg ? `${figurant.poids_kg} kg` : "—"}</div>
          <div><span className="text-text-muted">Veste : </span>{figurant.veste ?? "—"}</div>
          <div><span className="text-text-muted">Pantalon : </span>{figurant.pantalon ?? "—"}</div>
          <div><span className="text-text-muted">Tour de tête : </span>{figurant.tour_tete_cm ? `${figurant.tour_tete_cm} cm` : "—"}</div>
          <div><span className="text-text-muted">Tour de cou : </span>{figurant.tour_cou_cm ? `${figurant.tour_cou_cm} cm` : "—"}</div>
          <div><span className="text-text-muted">Tour de poitrine : </span>{figurant.tour_poitrine_cm ? `${figurant.tour_poitrine_cm} cm` : "—"}</div>
          <div><span className="text-text-muted">Tour de taille : </span>{figurant.tour_taille_cm ? `${figurant.tour_taille_cm} cm` : "—"}</div>
          <div><span className="text-text-muted">Tour de hanches : </span>{figurant.tour_hanches_cm ? `${figurant.tour_hanches_cm} cm` : "—"}</div>
          <div><span className="text-text-muted">Jambes ext. : </span>{figurant.jambes_ext_cm ? `${figurant.jambes_ext_cm} cm` : "—"}</div>
          <div><span className="text-text-muted">Jambes int. : </span>{figurant.jambes_int_cm ? `${figurant.jambes_int_cm} cm` : "—"}</div>
          <div><span className="text-text-muted">Pointure : </span>{figurant.pointure ?? "—"}</div>
          <div><span className="text-text-muted">Gant : </span>{figurant.gant ?? "—"}</div>
          <div><span className="text-text-muted">Carrure : </span>{figurant.carrure_cm ? `${figurant.carrure_cm} cm` : "—"}</div>
          <div><span className="text-text-muted">Yeux : </span>{figurant.couleur_yeux ?? "—"}</div>
          <div><span className="text-text-muted">Cheveux : </span>{figurant.couleur_cheveux ?? "—"}</div>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Photos</h2>
        <PhotoDropzones figurantId={id} photos={photos} />
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Journées ({(bookings ?? []).length})</h2>
        {(bookings ?? []).length === 0 ? (
          <p className="text-sm text-text-muted">Aucun booking pour l&apos;instant.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(bookings ?? []).map((b) => (
              <li key={b.id} className="flex items-center justify-between text-sm">
                <Link
                  href={`/bookings/documents?projet_id=${b.projet_id}&date=${b.date}`}
                  className="hover:text-coral"
                >
                  {formatDateShort(b.date)}
                  {b.heure_convocation ? ` · ${b.heure_convocation}` : ""} —{" "}
                  {b.projets?.nom}
                  {b.fonction ? ` · ${b.fonction}` : ""}
                </Link>
                <Badge tone={b.statut === "confirmé" ? "turquoise" : "default"}>{b.statut}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Liens</h2>
        {(liens ?? []).length === 0 ? (
          <p className="text-sm text-text-muted">Aucun lien pour l&apos;instant.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(liens ?? []).map((l) => (
              <li key={l.id} className="flex items-center justify-between text-sm">
                <a href={l.url} target="_blank" rel="noreferrer" className="hover:text-coral">
                  {l.label} — {l.url}
                </a>
                <form action={deleteLien.bind(null, l.id, id)}>
                  <button type="submit" className="text-text-muted hover:text-coral">
                    Suppr.
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {(figurant.tags.length > 0 || figurant.notes_internes) && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Suivi interne</h2>
          {figurant.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {figurant.tags.map((t) => (
                <Badge key={t} tone="yellow">
                  {t}
                </Badge>
              ))}
            </div>
          )}
          {figurant.notes_internes && (
            <p className="text-sm text-text-muted whitespace-pre-wrap">
              {figurant.notes_internes}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}
