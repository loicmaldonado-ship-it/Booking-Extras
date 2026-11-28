"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess } from "@/lib/auth/session";
import { analyserCsv, marquerDoublonsProjet, normaliser, type LigneImport } from "./import-roles";

// Noms des rôles déjà présents sur le projet (la limite de 1000 lignes de
// PostgREST ne concerne pas un projet de casting, mais on pagine par sécurité).
async function nomsExistants(projetId: string): Promise<string[]> {
  const supabase = createAdminClient();
  const noms: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("casting_roles")
      .select("nom")
      .eq("projet_id", projetId)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    noms.push(...(data ?? []).map((r) => r.nom));
    if (!data || data.length < 1000) break;
  }
  return noms;
}

async function preparer(projetId: string, csv: string): Promise<{ lignes: LigneImport[]; error?: string }> {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { lignes: [], error: accessError };
  const analyse = analyserCsv(csv);
  if (analyse.erreur) return { lignes: [], error: analyse.erreur };
  try {
    return { lignes: marquerDoublonsProjet(analyse.lignes, await nomsExistants(projetId)) };
  } catch (e) {
    return { lignes: [], error: e instanceof Error ? e.message : "Lecture des rôles du projet impossible." };
  }
}

// Aperçu : ne crée rien. Les doublons de nom (dans le fichier ou avec les
// rôles déjà présents) sont signalés, jamais une erreur.
export async function apercuImportRoles(
  projetId: string,
  csv: string
): Promise<{ lignes: LigneImport[]; error?: string }> {
  return preparer(projetId, csv);
}

// Création : le fichier est relu et re-vérifié côté serveur (jamais la liste
// affichée par le navigateur), seules les lignes « ok » sont créées.
export async function importerRoles(
  projetId: string,
  csv: string,
  // ongletId : onglet d'arrivée de tous les rôles. parEpisode : un onglet par
  // valeur de la colonne « Épisode » (créé s'il n'existe pas encore).
  options: { ongletId?: string | null; parEpisode?: boolean } = {}
): Promise<{ crees?: number; ignorees?: number; error?: string }> {
  const { lignes, error } = await preparer(projetId, csv);
  if (error) return { error };

  const aCreer = lignes.filter((l) => l.etat === "ok" && l.categorie);
  const ignorees = lignes.length - aCreer.length;
  if (aCreer.length === 0) return { crees: 0, ignorees };

  const supabase = createAdminClient();

  // Onglet de chaque rôle : un par épisode, ou l'onglet choisi, ou aucun.
  const ongletParEpisode = new Map<string, string>();
  let ongletCommun: string | null = null;
  if (options.parEpisode) {
    const { data: existants } = await supabase.from("casting_onglets").select("id, nom, ordre").eq("projet_id", projetId);
    const parNom = new Map((existants ?? []).map((o) => [normaliser(o.nom), o.id]));
    let ordre = Math.max(-1, ...(existants ?? []).map((o) => o.ordre)) + 1;
    for (const l of aCreer) {
      const cle = normaliser(l.episode);
      if (!cle || ongletParEpisode.has(cle)) continue;
      const trouve = parNom.get(cle);
      if (trouve) {
        ongletParEpisode.set(cle, trouve);
        continue;
      }
      const { data: cree, error: ongletError } = await supabase
        .from("casting_onglets")
        .insert({ projet_id: projetId, nom: l.episode.slice(0, 60), ordre: ordre++ })
        .select("id")
        .single();
      if (ongletError) return { error: ongletError.message };
      ongletParEpisode.set(cle, cree.id);
    }
  } else if (options.ongletId) {
    const { data: onglet } = await supabase
      .from("casting_onglets")
      .select("id")
      .eq("id", options.ongletId)
      .eq("projet_id", projetId)
      .maybeSingle();
    ongletCommun = onglet?.id ?? null;
  }

  // Nouveaux rôles en dernier dans l'ordre d'affichage, dans l'ordre du fichier.
  const { data: maxOrdreRow } = await supabase
    .from("casting_roles")
    .select("ordre")
    .eq("projet_id", projetId)
    .order("ordre", { ascending: false })
    .limit(1)
    .maybeSingle();
  const premierOrdre = (maxOrdreRow?.ordre ?? -1) + 1;

  // Les autres réglages (mode, nombre de vidéos, photos demandées, visibilité…)
  // prennent les valeurs par défaut de la base — les mêmes que le formulaire.
  const rows = aCreer.map((l, i) => ({
    projet_id: projetId,
    nom: l.nom,
    categorie_cachet: l.categorie!,
    ordre: premierOrdre + i,
    message_corps: l.messageCorps,
    agents_description: l.agents.description,
    agents_age: l.agents.age,
    agents_sequence: l.agents.sequence,
    agents_repliques: l.agents.repliques,
    onglet_id: options.parEpisode ? (ongletParEpisode.get(normaliser(l.episode)) ?? null) : ongletCommun,
  }));

  let crees = 0;
  let doublonsPendantImport = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const lot = rows.slice(i, i + 50);
    const { error: insertError } = await supabase.from("casting_roles").insert(lot);
    if (!insertError) {
      crees += lot.length;
      continue;
    }
    if (insertError.code !== "23505") {
      revalidatePath("/casting");
      return { crees, ignorees: ignorees + doublonsPendantImport, error: insertError.message };
    }
    // Un rôle du même nom vient d'apparaître entre l'aperçu et la création :
    // on reprend ce lot un par un pour ne perdre que le doublon.
    for (const row of lot) {
      const { error: uniqueError } = await supabase.from("casting_roles").insert(row);
      if (!uniqueError) crees++;
      else if (uniqueError.code === "23505") doublonsPendantImport++;
      else {
        revalidatePath("/casting");
        return { crees, ignorees: ignorees + doublonsPendantImport, error: uniqueError.message };
      }
    }
  }

  revalidatePath("/casting");
  return { crees, ignorees: ignorees + doublonsPendantImport };
}
