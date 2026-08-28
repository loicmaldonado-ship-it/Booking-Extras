import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { getCurrentFigurant } from "@/lib/candidats/session";
import { logoutFigurant } from "@/lib/candidats/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { MessageThread } from "@/components/candidats/message-thread";
import { PushSubscribe } from "@/components/candidats/push-subscribe";
import { MaFicheForm } from "@/components/candidats/ma-fiche-form";
import { IndisponibilitesPanel } from "@/components/candidats/indisponibilites-panel";
import { MesPhotosPanel } from "@/components/candidats/mes-photos-panel";
import { formatAnnonceDatesLabel } from "@/lib/format-date";
import { projetNomPublic } from "@/lib/projets/types";
import { getAnnonceDates } from "@/lib/annonces/dates";
import { getProjetOwnerNames } from "@/lib/projets/signature";
import type { FigurantMessage } from "@/lib/candidats/types";
import { LIEN_BANDE_DEMO, LIEN_INSTAGRAM, type Figurant, type FigurantPhoto } from "@/lib/figurants/types";

export const dynamic = "force-dynamic";

type AnnonceOuverte = {
  id: string;
  titre: string;
  lieu: string | null;
  date_recherchee: string | null;
  public_token: string;
  types_cachet: string[];
  projet_id: string;
  projets: { nom: string; confidentiel: boolean; nom_code: string | null } | null;
};

export default async function CompteCandidatPage() {
  const session = await getCurrentFigurant();

  if (!session) {
    redirect("/compte/connexion");
  }

  const supabase = createAdminClient();
  const [{ data: figurant }, { data: messages }, { data: candidaturesExistantes }, { data: liens }, { data: photosRaw }] =
    await Promise.all([
      supabase.from("figurants").select("*").eq("id", session.id).single<Figurant>(),
      supabase
        .from("figurant_messages")
        .select("*")
        .eq("figurant_id", session.id)
        .order("created_at", { ascending: true })
        .returns<FigurantMessage[]>(),
      supabase.from("candidatures").select("annonce_id").eq("figurant_id", session.id),
      supabase.from("figurant_liens").select("label, url").eq("figurant_id", session.id),
      supabase.from("figurant_photos").select("*").eq("figurant_id", session.id).returns<FigurantPhoto[]>(),
    ]);

  const projetIdsAvecMessage = Array.from(
    new Set((messages ?? []).map((m) => m.projet_id).filter((id): id is string => !!id))
  );
  const { data: projetsMessages } =
    projetIdsAvecMessage.length > 0
      ? await supabase.from("projets").select("id, nom, archive").in("id", projetIdsAvecMessage)
      : { data: [] as { id: string; nom: string; archive: boolean }[] };
  const projetInfoById: Record<string, { label: string; archive: boolean }> = Object.fromEntries(
    (projetsMessages ?? []).map((p) => [p.id, { label: p.nom, archive: p.archive }])
  );

  const photos = await Promise.all(
    (photosRaw ?? []).map(async (p) => {
      const { data } = await supabase.storage.from("figurant-photos").createSignedUrl(p.storage_path, 60 * 60);
      return { id: p.id, type: p.type, url: data?.signedUrl };
    })
  );

  const { data: indisponibilites } = await supabase
    .from("figurant_indisponibilites")
    .select("date, motif")
    .eq("figurant_id", session.id);

  const lienBandeDemo = (liens ?? []).find((l) => l.label === LIEN_BANDE_DEMO)?.url ?? null;
  const lienInstagram = (liens ?? []).find((l) => l.label === LIEN_INSTAGRAM)?.url ?? null;

  const annonceIdsDejaPostulees = new Set((candidaturesExistantes ?? []).map((c) => c.annonce_id));

  const { data: annoncesRaw } = await supabase
    .from("annonces")
    .select(
      "id, titre, lieu, date_recherchee, public_token, types_cachet, projet_id, projets(nom, confidentiel, nom_code)"
    )
    .eq("statut", "ouverte")
    .order("date_recherchee", { ascending: true, nullsFirst: false })
    .returns<AnnonceOuverte[]>();

  const annonces = (annoncesRaw ?? []).filter((a) => !annonceIdsDejaPostulees.has(a.id));
  const [ownerNames, datesEntries] = await Promise.all([
    getProjetOwnerNames(supabase, annonces.map((a) => a.projet_id)),
    Promise.all(
      annonces.map(async (a) => [a.id, formatAnnonceDatesLabel(await getAnnonceDates(a.id), a.date_recherchee)] as const)
    ),
  ]);
  const datesByAnnonce = new Map(datesEntries);

  if (!figurant) {
    redirect("/compte/connexion");
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 py-10">
      <div>
        <Logo iconSize={26} textClassName="text-lg" />
        <h1 className="mt-4 text-2xl font-semibold">
          Bonjour {figurant.prenom} {figurant.nom}
        </h1>
        <p className="mt-1 text-text-muted">Votre espace personnel.</p>
      </div>

      <PushSubscribe />

      <MaFicheForm figurant={figurant} lienBandeDemo={lienBandeDemo} lienInstagram={lienInstagram} />

      <IndisponibilitesPanel indisponibilites={indisponibilites ?? []} />

      <MesPhotosPanel photos={photos} />

      {annonces.length > 0 && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Annonces en cours</h2>
          <div className="flex flex-col gap-2">
            {annonces.map((a) => {
              const chef = ownerNames.get(a.projet_id);
              const dates = datesByAnnonce.get(a.id);
              return (
                <Link
                  key={a.id}
                  href={`/postuler/${a.public_token}`}
                  className="flex flex-col gap-1.5 rounded-xl border border-border bg-ink px-4 py-3 transition-colors hover:border-coral/60"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{a.titre}</span>
                    <Badge tone="coral">Postuler →</Badge>
                  </div>
                  <span className="text-xs text-text-muted">
                    {projetNomPublic(a.projets, "Projet confidentiel")}
                    {chef ? ` · ${chef}` : ""}
                    {a.lieu ? ` · ${a.lieu}` : ""}
                  </span>
                  {dates && (
                    <span className="text-xs text-text-muted">
                      <span className="font-medium text-text">Dates : </span>
                      {dates}
                    </span>
                  )}
                  {a.types_cachet.length > 0 && (
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {a.types_cachet.map((t) => (
                        <Badge key={t} tone="turquoise">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </Card>
      )}

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Messages</h2>
        <MessageThread messages={messages ?? []} projetInfoById={projetInfoById} />
      </Card>

      <form action={logoutFigurant}>
        <Button type="submit" variant="ghost">
          Se déconnecter
        </Button>
      </form>
    </div>
  );
}
