import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, Badge } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { deleteBooking } from "@/lib/bookings/actions";
import { ExportMyroleButtons } from "@/components/bookings/export-myrole-buttons";
import { BackLink } from "@/components/ui/back-link";
import { statutLabel, statutTone, covoiturageRoleLabel } from "@/lib/bookings/types";
import { formatDateShort } from "@/lib/format-date";
import { requireProjetAccess } from "@/lib/auth/session";
import { getIndisponibilitesForFigurants } from "@/lib/figurants/disponibilites";

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select(
      "*, figurants!bookings_figurant_id_fkey(id, prenom, nom, telephone, email), projets(id, nom, confidentiel), covoiturage:figurants!bookings_covoiturage_conducteur_id_fkey(prenom, nom)"
    )
    .eq("id", id)
    .single();

  if (!booking) notFound();
  await requireProjetAccess(booking.projet_id);

  const boundDelete = deleteBooking.bind(null, id);

  const indispoMap = booking.figurants?.id
    ? await getIndisponibilitesForFigurants([booking.figurants.id])
    : new Map<string, string | null>();
  const indispoMotif = booking.figurants?.id ? indispoMap.get(`${booking.figurants.id}|${booking.date}`) : undefined;
  const enConflit = indispoMotif !== undefined;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <BackLink
        href={`/bookings/documents?projet_id=${booking.projets?.id}&date=${booking.date}`}
        label="Retour à la journée"
      />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold">
            {booking.figurants?.prenom} {booking.figurants?.nom}
          </h1>
          <p className="mt-1 text-text-muted">
            {booking.projets?.nom} · {formatDateShort(booking.date)}
            {booking.heure_convocation ? ` · ${booking.heure_convocation}` : ""}
          </p>
        </div>
        <div className="flex gap-3">
          <ButtonLink href={`/figurants/${booking.figurants?.id}/modifier`} variant="secondary">
            Modifier la fiche
          </ButtonLink>
          <ButtonLink href={`/bookings/${id}/modifier`} variant="secondary">
            Modifier
          </ButtonLink>
          <form action={boundDelete}>
            <Button type="submit" variant="ghost">
              Supprimer
            </Button>
          </form>
        </div>
      </div>

      {enConflit && (
        <div className="rounded-xl border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger">
          ⚠ {booking.figurants?.prenom} a déclaré être indisponible le {formatDateShort(booking.date)}
          {indispoMotif ? ` (${indispoMotif})` : ""}.
        </div>
      )}

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Statut</h2>
        <div className="flex gap-3">
          <Badge tone={statutTone(booking.statut)}>{statutLabel(booking.statut)}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-text-muted">Fonction : </span>{booking.fonction ?? "—"}</div>
          <div><span className="text-text-muted">Cachet : </span>{booking.cachet ?? "—"}</div>
          <div><span className="text-text-muted">Convocation envoyée : </span>{booking.convocation_envoyee ? "Oui" : "Non"}</div>
          <div><span className="text-text-muted">Lien Myrole envoyé : </span>{booking.lien_myrole_envoye ? "Oui" : "Non"}</div>
        </div>
      </Card>

      {(booking.covoiturage_role || booking.covoiturage_lieu_depart) && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Covoiturage</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-text-muted">Rôle : </span>
              {booking.covoiturage_role ? covoiturageRoleLabel(booking.covoiturage_role) : "—"}
            </div>
            <div><span className="text-text-muted">Lieu de départ : </span>{booking.covoiturage_lieu_depart ?? "—"}</div>
            {booking.covoiturage_role === "conducteur" && (
              <div><span className="text-text-muted">Places disponibles : </span>{booking.covoiturage_places_disponibles ?? "—"}</div>
            )}
            {booking.covoiturage_role === "passager" && booking.covoiturage && (
              <div><span className="text-text-muted">Conducteur : </span>{booking.covoiturage.prenom} {booking.covoiturage.nom}</div>
            )}
          </div>
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Documents de cette journée</h2>
        <div className="flex flex-wrap gap-3">
          <ButtonLink
            href={`/bookings/documents?projet_id=${booking.projets?.id}&date=${booking.date}`}
            variant="secondary"
          >
            Documents du jour (trombis, fiches, liste d&apos;appel)
          </ButtonLink>
        </div>
        <ExportMyroleButtons projetId={booking.projets?.id} date={booking.date} />
      </Card>

      {booking.notes && (
        <Card className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Notes</h2>
          <p className="text-sm whitespace-pre-wrap">{booking.notes}</p>
        </Card>
      )}

      <div className="flex gap-4 text-sm text-text-muted">
        <Link href={`/figurants/${booking.figurants?.id}`} className="hover:text-coral">
          Voir le figurant →
        </Link>
        <Link href={`/projets/${booking.projets?.id}`} className="hover:text-coral">
          Voir le projet →
        </Link>
      </div>
    </div>
  );
}
