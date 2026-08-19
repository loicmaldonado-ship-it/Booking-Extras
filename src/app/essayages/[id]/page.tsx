import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, Badge } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { BackLink } from "@/components/ui/back-link";
import { deleteEssayage } from "@/lib/essayages/actions";

export default async function EssayageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: essayage } = await supabase
    .from("essayages")
    .select("*, figurants(id, prenom, nom, telephone, email), projets(id, nom, confidentiel)")
    .eq("id", id)
    .single();

  if (!essayage) notFound();

  const boundDelete = deleteEssayage.bind(null, id);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <BackLink href="/essayages" label="Essayages" />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-semibold">
            Essayage #{essayage.numero} — {essayage.figurants?.prenom} {essayage.figurants?.nom}
          </h1>
          <p className="mt-1 text-text-muted">
            {essayage.projets?.nom}
            {essayage.date ? ` · ${essayage.date}` : ""}
            {essayage.heure ? ` · ${essayage.heure}` : ""}
          </p>
        </div>
        <div className="flex gap-3">
          <ButtonLink href={`/essayages/${id}/modifier`} variant="secondary">
            Modifier
          </ButtonLink>
          <form action={boundDelete}>
            <Button type="submit" variant="ghost">
              Supprimer
            </Button>
          </form>
        </div>
      </div>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Badge tone={essayage.statut === "fait" ? "turquoise" : "yellow"}>{essayage.statut}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-text-muted">Lieu : </span>{essayage.lieu ?? "—"}</div>
        </div>
      </Card>

      {essayage.notes && (
        <Card className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Notes</h2>
          <p className="text-sm whitespace-pre-wrap">{essayage.notes}</p>
        </Card>
      )}

      <div className="flex gap-4 text-sm text-text-muted">
        <Link href={`/figurants/${essayage.figurants?.id}`} className="hover:text-coral">
          Voir le figurant →
        </Link>
        <Link href={`/projets/${essayage.projets?.id}`} className="hover:text-coral">
          Voir le projet →
        </Link>
      </div>
    </div>
  );
}
