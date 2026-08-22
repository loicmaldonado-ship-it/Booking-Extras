import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, Badge } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { resolvePartageToken } from "@/lib/partage/data";
import { getPhotosByFigurantId, pickPortrait, getCachetFonctionByFigurant } from "@/lib/documents/data";
import { formatDateShort } from "@/lib/format-date";
import { projetNomPublic } from "@/lib/projets/types";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  numero: number;
  date: string | null;
  heure: string | null;
  lieu: string | null;
  statut: string;
  notes: string | null;
  numero_costume: string | null;
  creneau_id: string | null;
  figurants: { id: string; prenom: string; nom: string } | null;
};

function heureLabel(h: string) {
  return h.slice(0, 5);
}

export default async function PartageEssayagesPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const projet = await resolvePartageToken(token, "essayages");

  if (!projet) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Lien introuvable</h1>
        <p className="text-text-muted">Ce lien de partage n&apos;est plus valide.</p>
      </div>
    );
  }

  const supabase = createAdminClient();
  const { data: essayagesRaw } = await supabase
    .from("essayages")
    .select("id, numero, date, heure, lieu, statut, notes, numero_costume, creneau_id, figurants(id, prenom, nom)")
    .eq("projet_id", projet.id)
    // Le lien de partage ne montre que ce qui est acté — les propositions pas
    // encore confirmées restent internes.
    .in("statut", ["confirmé", "fait"])
    .order("date", { ascending: true, nullsFirst: false })
    .returns<Row[]>();

  const essayages = essayagesRaw ?? [];

  const creneauIds = essayages.map((e) => e.creneau_id).filter((id): id is string => !!id);
  const figurantIds = essayages.map((e) => e.figurants?.id).filter((id): id is string => !!id);
  const [{ data: creneauxRaw }, photosByFigurant, cachetFonctionByFigurant] = await Promise.all([
    creneauIds.length > 0
      ? supabase.from("essayage_creneaux").select("id, heure_debut, heure_fin").in("id", creneauIds)
      : Promise.resolve({ data: [] as { id: string; heure_debut: string; heure_fin: string }[] }),
    getPhotosByFigurantId(figurantIds),
    getCachetFonctionByFigurant(projet.id, figurantIds),
  ]);
  const creneauById = new Map((creneauxRaw ?? []).map((c) => [c.id, c]));

  const byDate = new Map<string, Row[]>();
  for (const e of essayages) {
    const key = e.date ?? "Date à confirmer";
    const list = byDate.get(key) ?? [];
    list.push(e);
    byDate.set(key, list);
  }
  const groups = Array.from(byDate.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-display text-lg font-semibold">
          Booking<span className="text-coral">Extras</span>
        </span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{projetNomPublic(projet)}</h1>
          <p className="mt-1 text-text-muted">Planning des essayages par jour — lecture seule.</p>
        </div>
        <ButtonLink href={`/partage/essayages/${token}/fiches`} variant="secondary">
          Fiches de mensuration
        </ButtonLink>
      </div>

      <div className="flex flex-col gap-4">
        {groups.map(([date, rows]) => (
          <Card key={date} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-text-muted">
              {date === "Date à confirmer" ? date : formatDateShort(date)}
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-muted">
                  <th className="py-2 pr-4 font-medium">Photo</th>
                  <th className="py-2 pr-4 font-medium">Figurant</th>
                  <th className="py-2 pr-4 font-medium">Fonction</th>
                  <th className="py-2 pr-4 font-medium">Costume</th>
                  <th className="py-2 pr-4 font-medium">Heure</th>
                  <th className="py-2 pr-4 font-medium">Lieu</th>
                  <th className="py-2 pr-4 font-medium">Statut</th>
                  <th className="py-2 pr-4 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const portrait = e.figurants ? pickPortrait(photosByFigurant.get(e.figurants.id), projet.id) : null;
                  const fonction = e.figurants ? cachetFonctionByFigurant.get(e.figurants.id)?.fonction : null;
                  return (
                    <tr key={e.id} className="border-b border-border last:border-0">
                      <td className="py-2 pr-4">
                        <div className="relative h-12 w-9 overflow-hidden rounded bg-ink-raised-2">
                          {portrait?.url && (
                            <Image src={portrait.url} alt="" fill className="object-cover" unoptimized />
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-4 font-medium">
                        #{e.numero} {e.figurants ? `${e.figurants.prenom} ${e.figurants.nom}` : "—"}
                      </td>
                      <td className="py-2 pr-4 text-text-muted">{fonction ?? "—"}</td>
                      <td className="py-2 pr-4">
                        {e.numero_costume ? <Badge tone="coral">{e.numero_costume}</Badge> : <span className="text-text-muted">—</span>}
                      </td>
                      <td className="py-2 pr-4 text-text-muted">
                        {e.creneau_id && creneauById.has(e.creneau_id)
                          ? `${heureLabel(creneauById.get(e.creneau_id)!.heure_debut)}–${heureLabel(creneauById.get(e.creneau_id)!.heure_fin)}`
                          : (e.heure ?? "—")}
                      </td>
                      <td className="py-2 pr-4 text-text-muted">{e.lieu ?? "—"}</td>
                      <td className="py-2 pr-4">
                        <Badge tone={e.statut === "fait" ? "turquoise" : e.statut === "confirmé" ? "coral" : "yellow"}>
                          {e.statut}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-text-muted">{e.notes ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        ))}
        {groups.length === 0 && <p className="text-sm text-text-muted">Aucun essayage pour l&apos;instant.</p>}
      </div>
    </div>
  );
}
