import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, Badge } from "@/components/ui/card";
import { type Row, type StaffMessageRow } from "@/components/bookings/bookings-table";
import { type EssayageRow, type BookedFigurant } from "@/components/bookings/essayages-panel";
import { type CovoiturageRow } from "@/components/bookings/covoiturage-board";
import { JourneeTabs } from "@/components/bookings/journee-tabs";
import { QuickAddFigurant } from "@/components/bookings/quick-add-figurant";
import { getPhotosByFigurantId, pickPortrait } from "@/lib/documents/data";
import { getJournees } from "@/lib/bookings/journees";
import { getBesoinsByJournee } from "@/lib/bookings/besoins";
import { getJourneePartageLien } from "@/lib/partage/actions";
import { getSiteOrigin } from "@/lib/partage/data";
import { formatDateShort } from "@/lib/format-date";
import { getUnreviewedReplies } from "@/lib/email/inbox";
import type { MessageTemplate } from "@/lib/templates/types";
import { requireProjetAccess } from "@/lib/auth/session";
import { getIndisponibilitesForFigurants } from "@/lib/figurants/disponibilites";

export const dynamic = "force-dynamic";

type BookingRow = Omit<Row, "portraitUrl"> & {
  figurant_id: string;
  covoiturage_role: "conducteur" | "passager" | null;
  covoiturage_lieu_depart: string | null;
  covoiturage_places_disponibles: number | null;
  covoiturage_conducteur_id: string | null;
};

export default async function JourneeDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ projet_id?: string; date?: string }>;
}) {
  const { projet_id, date } = await searchParams;

  if (!projet_id || !date) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-semibold">Journée</h1>
        <Card>
          <p className="text-sm text-text-muted">
            Choisis une journée depuis la liste des <Link href="/bookings" className="text-coral hover:underline">bookings</Link>.
          </p>
        </Card>
      </div>
    );
  }
  await requireProjetAccess(projet_id);

  const supabase = createAdminClient();
  const [{ data: projet }, { data: bookingsRaw }, { data: templates }, { data: allFigurants }] = await Promise.all([
    supabase
      .from("projets")
      .select("nom, confidentiel, lieu, covoiturage_tarif_base, covoiturage_tarif_passager")
      .eq("id", projet_id)
      .single(),
    supabase
      .from("bookings")
      .select(
        "id, date, heure_convocation, fonction, cachet, statut, convocation_envoyee, reponse_recue, notes, figurant_id, covoiturage_role, covoiturage_lieu_depart, covoiturage_places_disponibles, covoiturage_conducteur_id, figurants!bookings_figurant_id_fkey(prenom, nom, ville, email, telephone, genre, date_naissance), projets(nom, confidentiel, nom_code, lieu, signature)"
      )
      .eq("projet_id", projet_id)
      .eq("date", date)
      .order("heure_convocation")
      .returns<BookingRow[]>(),
    supabase.from("message_templates").select("*").order("nom").returns<MessageTemplate[]>(),
    supabase.from("figurants").select("id, prenom, nom").order("nom"),
  ]);

  const journees = await getJournees(projet_id);
  const currentIndex = journees.findIndex((j) => j.date === date);
  const currentJournee = currentIndex >= 0 ? journees[currentIndex] : null;
  const prevJournee = currentIndex > 0 ? journees[currentIndex - 1] : null;
  const nextJournee =
    currentIndex >= 0 && currentIndex < journees.length - 1 ? journees[currentIndex + 1] : null;
  const besoins = currentJournee ? await getBesoinsByJournee(currentJournee.id) : [];

  const rawBookings = bookingsRaw ?? [];
  const figurantIds = rawBookings.map((b) => b.figurant_id);
  const photosByFigurant = await getPhotosByFigurantId(figurantIds);

  const { data: staffMessagesRaw } =
    figurantIds.length > 0
      ? await supabase
          .from("figurant_messages")
          .select("id, figurant_id, categorie, sujet, corps, created_at, repondu")
          .eq("sender", "staff")
          .in("figurant_id", figurantIds)
          .order("created_at", { ascending: false })
          .returns<(StaffMessageRow & { figurant_id: string })[]>()
      : { data: [] as (StaffMessageRow & { figurant_id: string })[] };
  const messagesByFigurant: Record<string, StaffMessageRow[]> = {};
  for (const m of staffMessagesRaw ?? []) {
    (messagesByFigurant[m.figurant_id] ??= []).push(m);
  }

  const { data: essayagesRaw } =
    figurantIds.length > 0
      ? await supabase
          .from("essayages")
          .select("id, numero, date, heure, lieu, statut, figurant_id")
          .eq("projet_id", projet_id)
          .in("figurant_id", figurantIds)
          .returns<EssayageRow[]>()
      : { data: [] as EssayageRow[] };
  const essaiOkFigurantIds = new Set(
    (essayagesRaw ?? []).filter((e) => e.statut === "fait").map((e) => e.figurant_id)
  );

  const { data: costumesRaw } =
    figurantIds.length > 0
      ? await supabase
          .from("essayages")
          .select("figurant_id, numero_costume")
          .eq("projet_id", projet_id)
          .not("numero_costume", "is", null)
          .in("figurant_id", figurantIds)
      : { data: [] as { figurant_id: string; numero_costume: string }[] };
  const numeroCostumeByFigurant = new Map((costumesRaw ?? []).map((c) => [c.figurant_id, c.numero_costume]));
  const indispoMap = await getIndisponibilitesForFigurants(figurantIds);

  // Raccord = cette personne a d'autres journées sur ce même projet — on le
  // signale (badge R) et on peut dérouler toutes ses dates avec leur statut.
  const { data: allProjetBookingsRaw } =
    figurantIds.length > 0
      ? await supabase
          .from("bookings")
          .select("figurant_id, date, statut")
          .eq("projet_id", projet_id)
          .in("figurant_id", figurantIds)
          .order("date", { ascending: true })
      : { data: [] as { figurant_id: string; date: string; statut: string }[] };
  const otherDatesByFigurant = new Map<string, { date: string; statut: string }[]>();
  const raccordFigurantIds = new Set<string>();
  for (const b of allProjetBookingsRaw ?? []) {
    if (b.date === date) continue;
    const list = otherDatesByFigurant.get(b.figurant_id) ?? [];
    list.push({ date: b.date, statut: b.statut });
    otherDatesByFigurant.set(b.figurant_id, list);
    if (b.date < date) raccordFigurantIds.add(b.figurant_id);
  }

  const bookings: Row[] = rawBookings.map((b) => ({
    ...b,
    portraitUrl: pickPortrait(photosByFigurant.get(b.figurant_id), projet_id)?.url ?? null,
    essaiOk: essaiOkFigurantIds.has(b.figurant_id),
    numeroCostume: numeroCostumeByFigurant.get(b.figurant_id) ?? null,
    indispoMotif: indispoMap.get(`${b.figurant_id}|${b.date}`),
    raccord: raccordFigurantIds.has(b.figurant_id),
    autresDates: otherDatesByFigurant.get(b.figurant_id) ?? [],
  }));
  const covoiturageRows: CovoiturageRow[] = rawBookings.map((b) => ({
    ...b,
    portraitUrl: pickPortrait(photosByFigurant.get(b.figurant_id), projet_id)?.url ?? null,
  }));

  const essayageFigurants: BookedFigurant[] = rawBookings
    .filter((b) => b.figurants)
    .map((b) => ({ id: b.figurant_id, prenom: b.figurants!.prenom, nom: b.figurants!.nom }))
    .filter((f, i, arr) => arr.findIndex((x) => x.id === f.id) === i);

  const confirmes = bookings.filter((b) => b.statut === "confirmé").length;
  const enAttente = bookings.filter((b) =>
    ["proposé", "envoyé", "a_relancer", "doit_rappeler"].includes(b.statut)
  ).length;

  const [journeePartage, publicOrigin, initialReplies] = await Promise.all([
    getJourneePartageLien(projet_id, date),
    getSiteOrigin(),
    getUnreviewedReplies(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            <Link href="/bookings" className="hover:text-text">
              ← Bookings
            </Link>
            <Link href="/bookings?switch=1" className="ml-3 text-coral hover:underline">
              Changer de projet
            </Link>
          </p>
          <div className="flex items-center gap-3">
            {prevJournee ? (
              <Link
                href={`/bookings/documents?projet_id=${projet_id}&date=${prevJournee.date}`}
                className="text-sm text-text-muted hover:text-coral"
              >
                ← J{prevJournee.numero} ({formatDateShort(prevJournee.date)})
              </Link>
            ) : (
              <span className="text-sm text-text-muted/30">← Journée précédente</span>
            )}
            <h1 className="text-3xl font-semibold">
              {projet?.nom} — {formatDateShort(date)}
            </h1>
            {nextJournee ? (
              <Link
                href={`/bookings/documents?projet_id=${projet_id}&date=${nextJournee.date}`}
                className="text-sm text-text-muted hover:text-coral"
              >
                J{nextJournee.numero} ({formatDateShort(nextJournee.date)}) →
              </Link>
            ) : (
              <span className="text-sm text-text-muted/30">Journée suivante →</span>
            )}
          </div>
          <div className="mt-2 flex gap-2">
            <Badge tone="turquoise">{confirmes} confirmé{confirmes > 1 ? "s" : ""}</Badge>
            <Badge tone="yellow">{enAttente} en attente</Badge>
            <Badge>{bookings.length} au total</Badge>
          </div>
        </div>
        <QuickAddFigurant
          projetId={projet_id}
          date={date}
          figurants={allFigurants ?? []}
          alreadyBookedIds={figurantIds}
        />
      </div>

      <JourneeTabs
        bookings={bookings}
        templates={templates ?? []}
        essayageFigurants={essayageFigurants}
        essayages={essayagesRaw ?? []}
        covoiturageRows={covoiturageRows}
        projetId={projet_id}
        date={date}
        besoins={besoins}
        journeeId={currentJournee?.id ?? null}
        totalRequis={currentJournee?.total_requis ?? null}
        journeeLieu={currentJournee?.lieu ?? null}
        projetLieu={projet?.lieu ?? null}
        covoiturageTarifBase={projet?.covoiturage_tarif_base ?? 15}
        covoiturageTarifPassager={projet?.covoiturage_tarif_passager ?? 5}
        initialReplies={initialReplies}
        messagesByFigurant={messagesByFigurant}
        convocationSettings={{
          precisions: currentJournee?.convocation_precisions ?? null,
          hmc: currentJournee?.convocation_hmc ?? null,
          accessoires: currentJournee?.convocation_accessoires ?? null,
          commentaires: currentJournee?.convocation_commentaires ?? null,
        }}
        journeePartage={journeePartage}
        publicOrigin={publicOrigin}
      />
    </div>
  );
}
