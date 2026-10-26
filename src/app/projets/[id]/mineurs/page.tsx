import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Badge } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentProfile, requireProjetAccess } from "@/lib/auth/session";
import { hasSectionAccess } from "@/lib/auth/sections";
import { ageOnDate, todayInParis } from "@/lib/minors/model";
import { staffDossier, dossierContents, signedMinorFile, type MinorDossier } from "@/lib/minors/dossiers";
import { CreateMinorDossierForm, MinorDatesForm, MinorGuardiansForm, MinorRequirementForm, MinorLinkForm, MinorReviewForm, RemoveMinorRequirement } from "@/components/minors/dossier-forms";
export const dynamic = "force-dynamic";
const states: Record<string, string> = { requested: "Manquante", received: "Reçue, à vérifier", validated: "Validée", refused: "Refusée" };

export default async function MinorProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ enfant?: string }> }) {
  const { id } = await params;
  const actor = await getCurrentProfile(); if (!hasSectionAccess(actor, "/mineurs")) notFound();
  await requireProjetAccess(id);
  const admin = createAdminClient();
  const { data: project } = await admin.from("projets").select("id,nom").eq("id", id).maybeSingle(); if (!project) notFound();
  const today = todayInParis();
  const [dossierResult, peopleResult] = await Promise.all([
    admin.from("minor_dossiers").select("*").eq("projet_id", id).order("created_at").returns<MinorDossier[]>(),
    (await createServerSupabaseClient()).from("figurants").select("id,prenom,nom,date_naissance").eq("est_comedien", false).gte("date_naissance", `${Number(today.slice(0, 4)) - 18}-01-01`).order("nom").limit(1000),
  ]);
  if (dossierResult.error || peopleResult.error) throw new Error("Liste des dossiers temporairement indisponible.");
  const profiles = (peopleResult.data ?? []).filter(p => { const age = ageOnDate(p.date_naissance); return age !== null && age < 18; });
  const people = new Map(profiles.map(p => [p.id, p]));
  const requested = (await searchParams).enfant;
  const selected = (dossierResult.data ?? []).find(d => d.figurant_id === requested) ?? dossierResult.data?.[0];
  const access = selected ? await staffDossier(selected.id) : null;
  const content = access ? await dossierContents(access.dossier) : null;
  const fileUrls = content ? new Map(await Promise.all(content.documents.filter(d => d.storage_path).map(async d => [d.id, await signedMinorFile(d.storage_path!)] as const))) : new Map<string, string | null>();
  const requiredItems = content ? [
    { key: "guardian_1", label: "Autorisation signée — représentant 1", required: true },
    ...(content.guardians && "absence_reason" in content.guardians.second ? [] : [{ key: "guardian_2", label: "Autorisation signée — représentant 2", required: true }]),
    ...(access && (ageOnDate(access.child.date_naissance, access.dossier.tournage_debut ?? today) ?? 18) < 16 ? content.requirements.map(r => ({ key: `extra_${r.id}`, label: r.label, required: r.required })) : []),
  ] : [];
  return <div className="flex max-w-4xl flex-col gap-6">
    <Link href={`/projets/${id}`} className="text-sm text-coral">← {project.nom}</Link>
    <h1 className="text-3xl font-semibold">Mineurs / DRIEETS</h1>
    <p className="text-sm text-text-muted">Un dossier par enfant et par projet. Les autorisations doivent être lues et validées par l’équipe avant tout booking. Les contrôles de booking utilisent l’âge et la validité des pièces au jour de tournage.</p>
    <Card className="flex flex-col gap-4"><h2 className="text-lg font-semibold">Ouvrir un dossier</h2><CreateMinorDossierForm project={id} profiles={profiles.map(p => ({ id: p.id, label: `${p.prenom} ${p.nom}` }))} /><p className="text-xs text-text-muted">Si l’enfant n’apparaît pas, complète sa naissance dans Base Profils. Liste limitée à 1 000 profils.</p></Card>
    {(dossierResult.data ?? []).length > 0 && <div className="flex flex-wrap gap-2">{dossierResult.data!.map(d => <Link key={d.id} href={`/projets/${id}/mineurs?enfant=${d.figurant_id}`} className="rounded-lg border border-border px-3 py-2 text-sm">{people.get(d.figurant_id) ? `${people.get(d.figurant_id)!.prenom} ${people.get(d.figurant_id)!.nom}` : "Dossier existant"}</Link>)}</div>}
    {access && content && <>
      <Card className="flex flex-col gap-4"><h2 className="text-xl font-semibold">{access.child.prenom} {access.child.nom}</h2><Badge tone={content.complete ? "turquoise" : "coral"}>{content.complete ? "Complet pour la date de début renseignée" : "Incomplet — booking refusé si les pièces requises manquent"}</Badge><p className="text-xs text-text-muted">La complétude est recalculée pour chaque date lors du booking, notamment autour d’un anniversaire ou d’une expiration. Une modification des représentants invalide les validations qui ne correspondent plus aux coordonnées actuelles.</p><Link className="text-coral underline" href={`/figurants/${access.child.id}`}>Fiche de l’enfant</Link><MinorDatesForm dossier={access.dossier} /><div className="flex flex-wrap gap-3 text-sm"><Link className="text-coral underline" href={`/projets/${id}/mineurs/${access.dossier.id}/dossier`}>Préparer le dossier DRIEETS</Link><Link className="text-coral underline" href={`/projets/${id}/mineurs/${access.dossier.id}/autorisation?representant=1`}>Préparer l’autorisation 1</Link><Link className="text-coral underline" href={`/projets/${id}/mineurs/${access.dossier.id}/autorisation?representant=2`}>Préparer l’autorisation 2</Link></div></Card>
      <Card><MinorGuardiansForm key={JSON.stringify(content.guardians)} dossierId={access.dossier.id} birth={access.child.date_naissance ?? ""} initial={content.guardians} /></Card>
      <Card className="flex flex-col gap-4"><h2 className="text-lg font-semibold">Pièces et autorisations</h2>{requiredItems.map(item => {
        const document = content.documents.find(d => d.source_key === item.key);
        return <section key={item.key} className="flex flex-col gap-3 rounded-xl border border-border p-4"><h3 className="font-medium">{item.label}{item.required ? " — obligatoire" : " — facultative"}</h3><p className="text-sm">{document ? document.state === "validated" && !document.validationCurrent ? "À revalider — coordonnées modifiées ou pièce expirée" : states[document.state] : "Manquante"}{document?.valid_until ? ` · Valable jusqu’au ${document.valid_until.split("-").reverse().join("/")}` : ""}</p>{document?.storage_path && <>{fileUrls.get(document.id) && <a className="text-coral underline" href={fileUrls.get(document.id)!} referrerPolicy="no-referrer">Télécharger {document.filename ?? "la pièce"}</a>}<p className="text-xs text-text-muted">Le lien de téléchargement expire après une minute. Recharge la page si nécessaire. Vérifie le contenu et la signature avant de valider.</p><MinorReviewForm key={`${document.id}:${document.state}:${document.internal_note}:${document.valid_until}:${document.storage_path}:${document.current_guardian_fingerprint}`} document={document} dossierId={access.dossier.id} /></>}</section>;
      })}</Card>
      <Card className="flex flex-col gap-4"><h2 className="text-lg font-semibold">Liens privés</h2><MinorLinkForm dossierId={access.dossier.id} /><p className="text-xs text-text-muted">Les liens parents permettent le dépôt de leur autorisation et des pièces du projet. Le lien production ne montre que les pièces validées encore valables. Aucun email réel n’est envoyé par cette version de test.</p></Card>
    </>}
    <Card className="flex flex-col gap-4"><h2 className="text-lg font-semibold">Pièces DRIEETS demandées aux moins de 16 ans</h2><p className="text-sm text-text-muted">Les deux autorisations parentales sont requises par défaut, sauf exception documentée du représentant 2. Ajoute les pièces demandées par la commission ou la production. Une nouvelle pièce obligatoire rend les dossiers incomplets tant qu’elle manque.</p><MinorRequirementForm project={id} />{content?.requirements.map(r => <div key={r.id} className="rounded border border-border p-3"><p className="mb-2">{r.label} — {r.required ? "obligatoire" : "facultative"}</p><RemoveMinorRequirement project={id} id={r.id} /></div>)}</Card>
  </div>;
}
