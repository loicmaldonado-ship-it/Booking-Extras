import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { bearerDossier, signedMinorFile, type MinorDocument } from "@/lib/minors/dossiers";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayInParis } from "@/lib/minors/model";
export const dynamic = "force-dynamic";
export const metadata = { title: "Pièces validées — Booking Extras", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default async function MinorSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const access = await bearerDossier(token, "production"); if (!access) notFound();
  const admin = createAdminClient();
  const [documents, requirements, fingerprints] = await Promise.all([
    admin.from("minor_documents").select("*").eq("dossier_id", access.dossier.id).eq("state", "validated").returns<MinorDocument[]>(),
    admin.from("minor_requirements").select("id,label").eq("projet_id", access.dossier.projet_id).eq("active", true),
    Promise.all([1, 2].map(p => admin.rpc("minor_guardian_fingerprint", { p_id: access.dossier.figurant_id, p_position: p }))),
  ]);
  if (documents.error || requirements.error || fingerprints.some(p => p.error)) throw new Error("Téléchargements momentanément indisponibles.");
  const labels = new Map((requirements.data ?? []).map(r => [`extra_${r.id}`, r.label]));
  const reference = access.dossier.tournage_debut && access.dossier.tournage_debut > todayInParis() ? access.dossier.tournage_debut : todayInParis();
  const files = await Promise.all((documents.data ?? []).filter(d => {
    if (!d.storage_path || d.valid_until && d.valid_until < reference) return false;
    if (d.source_key.startsWith("extra_")) return access.age !== null && access.age < 16 && labels.has(d.source_key);
    return typeof d.guardian_fingerprint === "string" && d.guardian_fingerprint === fingerprints[d.source_key === "guardian_1" ? 0 : 1].data;
  }).map(async d => ({ id: d.id, label: labels.get(d.source_key) ?? `Autorisation parentale ${d.source_key === "guardian_1" ? "1" : "2"}`, url: await signedMinorFile(d.storage_path!) })));
  return <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-10"><h1 className="text-2xl font-semibold">Pièces de {access.child.prenom} {access.child.nom}</h1><p>Accès privé production. Seules les pièces validées et encore valables sont proposées. Ce partage ne constitue pas une attestation de complétude pour toutes les dates de tournage.</p><Card className="flex flex-col gap-4">{files.filter(f => f.url).map(f => <a key={f.id} href={f.url!} referrerPolicy="no-referrer" className="text-coral underline">Télécharger : {f.label}</a>)}{files.length === 0 && <p>Aucune pièce validée disponible.</p>}</Card><p className="text-sm text-text-muted">Téléchargements valables une minute : rechargez si nécessaire. Ne transmettez pas ce lien ni les pièces à une personne non autorisée. Le lien de partage peut être révoqué par l’équipe et expire après sept jours.</p></div>;
}
