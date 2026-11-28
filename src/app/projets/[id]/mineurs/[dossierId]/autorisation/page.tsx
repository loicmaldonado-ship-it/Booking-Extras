import Link from "next/link";
import { notFound } from "next/navigation";
import { getMinorPreparation } from "@/lib/drieets/data";
import { PrintButton } from "@/components/documents/print-button";
export const dynamic = "force-dynamic";
const date = (v: string | null) => v ? v.split("-").reverse().join("/") : "—";
export default async function MinorAuthorizationPage({ params, searchParams }: { params: Promise<{ id: string; dossierId: string }>; searchParams: Promise<{ representant?: string }> }) {
 const { id,dossierId } = await params;
 const number = (await searchParams).representant === "2" ? 2 : 1;
 const result = await getMinorPreparation(id,dossierId); if (!result) notFound();
 const data = result.data;
 const guardian = data ? number === 1 ? data.guardians.first : data.guardians.second : null;
 return <div className="flex max-w-3xl flex-col gap-6"><div className="print-hide"><Link href={`/projets/${id}/mineurs`}>← Dossier mineur</Link></div><h1 className="text-2xl font-semibold">Préparation d’autorisation parentale {number}</h1>
 {result.errors.length > 0 ? <ul role="alert" className="list-disc pl-5">{result.errors.map(e => <li key={e}>{e}</li>)}</ul> : guardian && "absence_reason" in guardian ? <p>Le second représentant est dispensé selon l’exception documentée dans le dossier.</p> : data && guardian && <><PrintButton /><article className="flex flex-col gap-5 rounded-xl bg-white p-8 text-black"><p className="font-semibold">Modèle de préparation à faire valider par la production</p><p>Je soussigné·e {guardian.prenom} {guardian.nom}, demeurant {guardian.adresse}, représentant·e légal·e de {data.child.prenom} {data.child.nom}, né·e le {date(data.child.date_naissance)}, prépare mon autorisation pour sa participation au projet « {data.project.nom} », produit par {data.project.societe_production}.</p><p>Période prévue : du {date(data.dossier.tournage_debut)} au {date(data.dossier.tournage_fin)}.</p><p>Fonction prévue : {data.dossier.role_label}.</p><p>Conditions de rémunération prévues : {data.dossier.cachet_info}.</p><p>Conditions détaillées et pièces jointes validées par la production :<br />__________________________________________________<br />__________________________________________________</p><p>Contact du représentant : {guardian.telephone} · {guardian.email}.</p><p>Fait à ____________________, le ____________________.</p><p>Signature du représentant {number} :<br /><br /><br />__________________________________________________</p><p className="text-sm">Ce document préparatoire ne vaut pas autorisation signée. La production doit valider le modèle et les conditions, puis le représentant doit le signer. Le fichier signé devra être déposé et vérifié par l’équipe.</p></article></> }
 </div>;
}
