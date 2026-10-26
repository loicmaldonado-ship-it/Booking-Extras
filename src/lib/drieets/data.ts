import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { staffDossier, dossierContents } from "@/lib/minors/dossiers";
import { buildMinorPreparation } from "./model";

export async function getMinorPreparation(projectId: string, dossierId: string) {
 const access = await staffDossier(dossierId);
 if (!access || access.dossier.projet_id !== projectId) return null;
 const admin = createAdminClient();
 let bookingQuery = admin.from("bookings").select("projet_id,figurant_id,date,fonction,cachet").eq("projet_id", projectId).eq("figurant_id", access.child.id).neq("statut", "annulé");
 if (access.dossier.tournage_debut) bookingQuery = bookingQuery.gte("date", access.dossier.tournage_debut);
 if (access.dossier.tournage_fin) bookingQuery = bookingQuery.lte("date", access.dossier.tournage_fin);
 const [project, bookings, content] = await Promise.all([
  admin.from("projets").select("id,nom,societe_production,realisateur,lieu").eq("id", projectId).maybeSingle(),
  bookingQuery.order("date"),
  dossierContents(access.dossier),
 ]);
 if (project.error || bookings.error || !project.data) return { errors: ["Lecture du projet ou des dates impossible. Réessaie."], data: null };
 const labels = new Map(content.requirements.map(r => [`extra_${r.id}`, r.label]));
 return buildMinorPreparation({ project: project.data, child: access.child, dossier: access.dossier, guardians: content.guardians, bookings: bookings.data ?? [], complete: content.complete,
  documents: content.documents.filter(d => d.source_key.startsWith("guardian_") || labels.has(d.source_key)).map(d => ({ label: labels.get(d.source_key) ?? `Autorisation représentant ${d.source_key === "guardian_1" ? "1" : "2"}`, state: d.state === "validated" && !d.validationCurrent ? "À revalider" : d.state, valid_until: d.valid_until })) });
}
