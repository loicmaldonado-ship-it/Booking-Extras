import { createHash } from "crypto";
import { getLienParToken, getPlanches, getVotesLiens, getCommentaires } from "@/lib/validation/data";
import { projetNomPublic } from "@/lib/projets/types";
import { Logo } from "@/components/ui/logo";
import { ValidationMes } from "@/components/validation/validation-mes";

export const dynamic = "force-dynamic";

// Empreinte courte de l'identifiant d'appareil : la page reconnaît ses
// propres votes sans exposer l'identifiant des autres votant·es.
const cle = (visiteurId: string) => createHash("sha256").update(visiteurId).digest("hex").slice(0, 16);

export default async function ValidationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ apercu?: string }>;
}) {
  const { token } = await params;
  const apercu = (await searchParams).apercu === "1";
  const lien = await getLienParToken(token);

  if (!lien) {
    return (
      <div className="flex flex-col gap-4">
        <Logo iconSize={26} textClassName="text-lg" />
        <h1 className="text-2xl font-semibold">Lien introuvable</h1>
        <p className="text-text-muted">Ce lien de validation n&apos;existe pas ou a été supprimé par l&apos;équipe casting.</p>
      </div>
    );
  }

  const [planches, votes, commentaires] = await Promise.all([
    getPlanches(lien.id, lien.projet_id, lien.annonce_id),
    getVotesLiens([lien.id]),
    getCommentaires([lien.id]),
  ]);

  return (
    <ValidationMes
      token={token}
      apercu={apercu}
      titre={lien.nom}
      contexte={[lien.projets?.societe_production, projetNomPublic(lien.projets), lien.annonces?.titre].filter(Boolean).join(" · ")}
      planches={planches}
      votes={votes.map((v) => ({
        candidatureId: v.candidature_id,
        cle: cle(v.visiteur_id),
        qui: v.visiteur_role ? `${v.visiteur_nom} (${v.visiteur_role})` : v.visiteur_nom,
        vote: v.vote,
        note: v.note,
      }))}
      commentaires={(commentaires.get(lien.id) ?? []).map((c) => ({
        id: c.id,
        auteur: c.auteur,
        equipe: c.equipe,
        texte: c.texte,
        created_at: c.created_at,
        profil: c.profil,
      }))}
    />
  );
}
