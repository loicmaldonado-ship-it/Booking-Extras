import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, Badge } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { ConnexionForm } from "@/components/auth/connexion-form";
import { getAnnonceDates } from "@/lib/annonces/dates";
import { getProjetOwnerNames } from "@/lib/projets/signature";
import { formatAnnonceDatesLabel } from "@/lib/format-date";
import { projetNomPublic } from "@/lib/projets/types";

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

export default async function ConnexionCandidatPage() {
  const supabase = createAdminClient();

  const { data: annoncesRaw } = await supabase
    .from("annonces")
    .select(
      "id, titre, lieu, date_recherchee, public_token, types_cachet, projet_id, projets(nom, confidentiel, nom_code)"
    )
    .eq("statut", "ouverte")
    .order("date_recherchee", { ascending: true, nullsFirst: false })
    .returns<AnnonceOuverte[]>();

  const annonces = annoncesRaw ?? [];
  const [ownerNames, datesEntries] = await Promise.all([
    getProjetOwnerNames(supabase, annonces.map((a) => a.projet_id)),
    Promise.all(
      annonces.map(async (a) => [a.id, formatAnnonceDatesLabel(await getAnnonceDates(a.id), a.date_recherchee)] as const)
    ),
  ]);
  const datesByAnnonce = new Map(datesEntries);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-10">
      <div>
        <Logo iconSize={26} textClassName="text-lg" />
        <h1 className="mt-4 text-2xl font-semibold">Espace candidat·es</h1>
        <p className="mt-1 text-text-muted">
          Déjà booké·e par notre équipe ? Reçois ton lien de connexion par email pour mettre à jour tes infos
          (adresse, mensurations, photos...). Sinon, découvre les annonces ouvertes ci-dessous — postuler ne
          demande pas de compte.
        </p>
      </div>

      <ConnexionForm />

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Annonces en cours</h2>
        {annonces.length === 0 ? (
          <Card>
            <p className="text-sm text-text-muted">Aucune annonce ouverte pour l&apos;instant.</p>
          </Card>
        ) : (
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
                    {projetNomPublic(a.projets)}
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
        )}
      </div>
    </div>
  );
}
