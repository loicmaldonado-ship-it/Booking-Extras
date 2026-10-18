import { createHash } from "crypto";
import { getLienParToken, getPlanches, getVotesLiens, getCommentaires } from "@/lib/validation/data";
import { projetNomPublic } from "@/lib/projets/types";
import { Logo } from "@/components/ui/logo";
import { ValidationMes } from "@/components/validation/validation-mes";
import { parseLang, t } from "@/lib/i18n/partage";
import { ts } from "@/lib/i18n/suivi";

export const dynamic = "force-dynamic";

// Empreinte courte de l'identifiant d'appareil : la page reconnaît ses
// propres votes sans exposer l'identifiant des autres votant·es.
const cle = (visiteurId: string) => createHash("sha256").update(visiteurId).digest("hex").slice(0, 16);

export default async function ValidationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ apercu?: string; lang?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const apercu = sp.apercu === "1";
  const lang = parseLang(sp.lang);
  const lien = await getLienParToken(token);

  if (!lien) {
    return (
      <div className="flex flex-col gap-4">
        <Logo iconSize={26} textClassName="text-lg" />
        <h1 className="text-2xl font-semibold">{t(lang, "lien_introuvable")}</h1>
        <p className="text-text-muted">{ts(lang, "lien_validation_introuvable")}</p>
      </div>
    );
  }

  const [{ planches, dates }, votes, commentaires] = await Promise.all([
    getPlanches(lien),
    getVotesLiens([lien.id]),
    getCommentaires([lien.id]),
  ]);

  return (
    <ValidationMes
      token={token}
      apercu={apercu}
      lang={lang}
      source={lien.source}
      titre={lien.nom}
      contexte={[lien.projets?.societe_production, projetNomPublic(lien.projets), lien.annonces?.titre].filter(Boolean).join(" · ")}
      planches={planches}
      jours={dates}
      votes={votes.map((v) => ({
        profilId: v.profil_id,
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
