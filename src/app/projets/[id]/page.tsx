import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, Badge } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { BackLink } from "@/components/ui/back-link";
import { projetSupprimableDepuis, projetEstSupprimable, type Projet } from "@/lib/projets/types";
import { countProjetTemporaires } from "@/lib/projets/actions";
import {
  ArchiverProjetButton,
  DesarchiverProjetButton,
  SupprimerProjetButton,
} from "@/components/projets/archiver-projet-button";
import { formatDateShort } from "@/lib/format-date";
import { requireProjetAccess } from "@/lib/auth/session";

export default async function ProjetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireProjetAccess(id);
  const supabase = createAdminClient();

  const { data: projet } = await supabase
    .from("projets")
    .select("*")
    .eq("id", id)
    .single<Projet>();

  if (!projet) notFound();

  const temporaireCount = projet.archive ? 0 : await countProjetTemporaires(id);
  const supprimableDepuis = projetSupprimableDepuis(projet.archive_le);
  const supprimable = projetEstSupprimable(projet);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <BackLink href="/projets" label="Projets" />

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold">{projet.nom}</h1>
            {projet.confidentiel && <Badge tone="coral">Confidentiel</Badge>}
            {projet.archive && (
              <Badge title={projet.archive_le ? `Archivé le ${formatDateShort(projet.archive_le)}` : undefined}>
                Archivé
              </Badge>
            )}
          </div>
          <p className="mt-1 text-text-muted">
            {projet.type ?? "Type non renseigné"}
            {projet.lieu ? ` · ${projet.lieu}` : ""}
          </p>
        </div>
        <div className="flex gap-3">
          <ButtonLink href={`/projets/${id}/modifier`} variant="secondary">
            Modifier
          </ButtonLink>
          {projet.archive ? (
            <>
              <DesarchiverProjetButton projetId={id} />
              {supprimable && <SupprimerProjetButton projetId={id} nom={projet.nom} />}
            </>
          ) : (
            <ArchiverProjetButton projetId={id} temporaireCount={temporaireCount} />
          )}
        </div>
      </div>

      {projet.archive && !supprimable && supprimableDepuis && (
        <p className="text-xs text-text-muted">
          Suppression définitive possible à partir du {formatDateShort(supprimableDepuis.toISOString())}.
        </p>
      )}

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Identité du projet</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-text-muted">Convention : </span>{projet.convention ?? "—"}</div>
          <div><span className="text-text-muted">Réalisateur·ice : </span>{projet.realisateur ?? "—"}</div>
          <div><span className="text-text-muted">Société de production : </span>{projet.societe_production ?? "—"}</div>
          <div><span className="text-text-muted">Diffuseur / chaîne : </span>{projet.diffuseur ?? "—"}</div>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Tournage</h2>
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
          <div><span className="text-text-muted">Début : </span>{projet.date_debut ? formatDateShort(projet.date_debut) : "—"}</div>
          <div><span className="text-text-muted">Fin : </span>{projet.date_fin ? formatDateShort(projet.date_fin) : "—"}</div>
          <div><span className="text-text-muted">Lieu : </span>{projet.lieu ?? "—"}</div>
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Contact projet</h2>
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
          <div><span className="text-text-muted">Nom : </span>{projet.contact_nom ?? "—"}</div>
          <div><span className="text-text-muted">Téléphone : </span>{projet.contact_telephone ?? "—"}</div>
          <div><span className="text-text-muted">Email : </span>{projet.contact_email ?? "—"}</div>
        </div>
      </Card>

      {(projet.besoins_figuration || projet.synopsis) && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Figuration</h2>
          {projet.besoins_figuration && (
            <div>
              <span className="text-xs font-medium text-text-muted">Besoins figuration</span>
              <p className="text-sm whitespace-pre-wrap">{projet.besoins_figuration}</p>
            </div>
          )}
          {projet.synopsis && (
            <div>
              <span className="text-xs font-medium text-text-muted">Synopsis</span>
              <p className="text-sm whitespace-pre-wrap">{projet.synopsis}</p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
