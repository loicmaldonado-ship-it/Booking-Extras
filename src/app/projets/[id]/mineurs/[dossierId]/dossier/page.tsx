import Link from "next/link";
import { notFound } from "next/navigation";
import { getMinorPreparation } from "@/lib/drieets/data";
import { PrintButton } from "@/components/documents/print-button";
export const dynamic = "force-dynamic";
const date = (v: string | null) => v ? v.split("-").reverse().join("/") : "—";
export default async function MinorPrintPage({ params }: { params: Promise<{ id: string; dossierId: string }> }) {
 const { id, dossierId } = await params;
 const result = await getMinorPreparation(id, dossierId); if (!result) notFound();
 const data = result.data;
 return <div className="flex max-w-4xl flex-col gap-6"><div className="print-hide"><Link href={`/projets/${id}/mineurs`}>← Dossiers mineurs</Link></div><h1 className="text-2xl font-semibold">Préparation du dossier DRIEETS</h1>
 {result.errors.length > 0 ? <div role="alert" className="rounded-xl border border-danger p-4"><p>La préparation ne peut pas être générée :</p><ul className="list-disc pl-5">{result.errors.map(e => <li key={e}>{e}</li>)}</ul></div> : data && data.age >= 16 ? <p>Selon DEC-03, le dossier DRIEETS concerne les moins de 16 ans. Pour cet adolescent, prépare les autorisations parentales depuis le dossier.</p> : data && <>
 <PrintButton /><article className="minor-print flex flex-col gap-5 rounded-xl bg-white p-8 text-black"><h2 className="text-xl font-semibold">{data.project.nom} — {data.child.prenom} {data.child.nom}</h2><p><strong>{data.complete ? "Pièces requises complètes pour le début de période renseigné" : "PRÉPARATION — dossier incomplet"}</strong></p><p>Ce récapitulatif ne vaut ni décision administrative, ni autorisation signée. Il doit être confronté au modèle demandé par la commission et validé par la production.</p>
 <section><h3 className="font-semibold">Projet et tournage</h3><p>Production : {data.project.societe_production}</p><p>Réalisation : {data.project.realisateur ?? "—"} · Lieu : {data.project.lieu ?? "—"}</p><p>Période : {date(data.dossier.tournage_debut)} au {date(data.dossier.tournage_fin)}</p><p>Commission : {date(data.dossier.commission_date)}</p><p>Fonction prévue : {data.dossier.role_label}</p><p>Conditions de rémunération prévues : {data.dossier.cachet_info}</p></section>
 <section><h3 className="font-semibold">Enfant</h3><p>{data.child.prenom} {data.child.nom}, né·e le {date(data.child.date_naissance)}</p><p>{data.child.adresse}, {data.child.code_postal} {data.child.ville}</p><p>Email personnel : {data.child.email}</p></section>
 {[data.guardians.first, data.guardians.second].map((g,index) => <section key={index}><h3 className="font-semibold">Représentant légal {index+1}</h3>{"absence_reason" in g ? <p>Exception documentée : {g.absence_reason === "decede" ? "décès" : "absence d’autorité parentale"}.</p> : <><p>{g.prenom} {g.nom}</p><p>{g.adresse}</p><p>{g.telephone} · {g.email}</p></>}</section>)}
 <section><h3 className="font-semibold">Pièces reçues</h3>{data.documents.length === 0 ? <p>Aucune pièce reçue.</p> : <ul>{data.documents.map((d,index) => <li key={index}>{d.label} — {({validated:"validée",received:"reçue, à vérifier",refused:"refusée",requested:"manquante"} as Record<string,string>)[d.state] ?? d.state}{d.valid_until ? ` — expiration ${date(d.valid_until)}` : ""}</li>)}</ul>}<p>Les fichiers sensibles sont transmis séparément par le lien production privé, après validation.</p></section>
 <section><h3 className="font-semibold">Dates déjà bookées sur ce projet</h3>{data.bookings.length ? <ul>{data.bookings.map((b,index) => <li key={index}>{date(b.date)} · {b.fonction ?? "fonction non renseignée"} · {b.cachet ?? "cachet non renseigné"}</li>)}</ul> : <p>Aucune : la période préparatoire ci-dessus est utilisée avant ajout au booking.</p>}</section></article>
 <style>{`@media print { .minor-print { padding:0!important; box-shadow:none!important; } .minor-print section { break-inside:avoid; } }`}</style>
 </> }</div>;
}
