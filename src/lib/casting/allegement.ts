import "server-only";
import { spawn } from "node:child_process";
import { copyFile, chmod, mkdir, readFile, rm, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createAdminClient } from "@/lib/supabase/admin";

// Allègement d'une vidéo du casting APRÈS l'envoi : l'original arrive tel
// quel (rapide pour la personne), puis ffmpeg le réduit en arrière-plan
// (H.264, 1280 px max, débit raisonnable) et remplace le fichier au même
// chemin — rien d'autre à mettre à jour. Sûr par construction : l'original
// n'est remplacé que si le résultat est valide ET nettement plus léger ;
// sinon il reste en place.

const BUCKET = "casting-videos";
// /tmp de la fonction serveur : 512 Mo (original + résultat).
const MAX_ORIGINAL_OCTETS = 300 * 1024 * 1024;
const MAX_DUREE_S = 4 * 60;
// Sous ce débit (kb/s) et cette hauteur, la vidéo est déjà légère.
const DEJA_LEGERE_KBPS = 3500;
const GAIN_MINIMUM = 0.85; // le résultat doit faire ≤ 85 % de l'original
const ESSAIS_MAX = 3;
const ENCODAGE_MAX_MS = 230_000;
const PATH_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}-video-[\w-]+\.mp4$/i;

export const cheminVideoValide = (path: string) => PATH_RE.test(path);

type Resultat = { statut: "ok" | "ignore" | "erreur" | "occupe" | "absent"; message?: string };

// Binaire ffmpeg du paquet npm, copié dans /tmp et rendu exécutable (les
// fonctions serveur ne gardent pas toujours le droit d'exécution).
async function binaireFfmpeg(): Promise<string> {
  const { path } = (await import("@ffmpeg-installer/ffmpeg")).default as { path: string };
  const cible = join(tmpdir(), "ffmpeg-bin");
  try {
    await stat(cible);
  } catch {
    await copyFile(path, cible);
  }
  await chmod(cible, 0o755);
  return cible;
}

function lancer(bin: string, args: string[], delaiMs: number): Promise<{ code: number | null; sortie: string; delai: boolean }> {
  return new Promise((resolve) => {
    const proc = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let sortie = "";
    let delai = false;
    proc.stderr.on("data", (d: Buffer) => {
      sortie = (sortie + d.toString()).slice(-20_000);
    });
    const minuteur = setTimeout(() => {
      delai = true;
      proc.kill("SIGKILL");
    }, delaiMs);
    proc.on("close", (code) => {
      clearTimeout(minuteur);
      resolve({ code, sortie, delai });
    });
    proc.on("error", (e) => {
      clearTimeout(minuteur);
      resolve({ code: -1, sortie: String(e), delai });
    });
  });
}

// Durée, débit et hauteur lus dans le texte d'information de ffmpeg.
function lireInfos(texte: string) {
  const d = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(texte);
  const duree = d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : null;
  const b = /bitrate:\s*(\d+)\s*kb\/s/.exec(texte);
  const v = /Video:.*?(\d{3,5})x(\d{3,5})/.exec(texte);
  return {
    duree,
    kbps: b ? Number(b[1]) : null,
    cote: v ? Math.max(Number(v[1]), Number(v[2])) : null,
  };
}

// Réserve la vidéo pour ce traitement (une seule exécution à la fois) :
// jamais deux fois la même, 3 essais au plus après une erreur.
async function reserver(path: string): Promise<"ok" | Resultat> {
  const supabase = createAdminClient();
  const { data: ligne } = await supabase.from("casting_videos_allegees").select("statut, essais, updated_at").eq("path", path).maybeSingle();
  if (!ligne) {
    const { error } = await supabase.from("casting_videos_allegees").insert({ path, statut: "en_cours", essais: 1 });
    return error ? { statut: "occupe" } : "ok";
  }
  if (ligne.statut === "ok" || ligne.statut === "ignore") return { statut: ligne.statut };
  const bloque = ligne.statut === "en_cours" && Date.now() - new Date(ligne.updated_at).getTime() < 10 * 60_000;
  if (bloque) return { statut: "occupe" };
  if (ligne.essais >= ESSAIS_MAX) return { statut: "erreur", message: "Trop d'échecs, vidéo laissée telle quelle." };
  await supabase
    .from("casting_videos_allegees")
    .update({ statut: "en_cours", essais: ligne.essais + 1, updated_at: new Date().toISOString() })
    .eq("path", path);
  return "ok";
}

async function noter(path: string, patch: Record<string, unknown>) {
  await createAdminClient()
    .from("casting_videos_allegees")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("path", path);
}

export async function alleger(path: string): Promise<Resultat> {
  if (!cheminVideoValide(path)) return { statut: "absent", message: "Chemin invalide." };
  const supabase = createAdminClient();

  // La vidéo doit être rattachée à un profil du casting.
  const { count } = await supabase
    .from("casting_entries")
    .select("id", { count: "exact", head: true })
    .contains("video_storage_paths", [path]);
  if (!count) return { statut: "absent", message: "Vidéo non rattachée à un profil." };

  const place = await reserver(path);
  if (place !== "ok") return place;

  const dossier = join(tmpdir(), `allegement-${crypto.randomUUID()}`);
  try {
    await mkdir(dossier, { recursive: true });
    const entree = join(dossier, "entree");
    const sortie = join(dossier, "sortie.mp4");

    const { data: signe, error: signeError } = await supabase.storage.from(BUCKET).createSignedUrl(path, 900);
    if (signeError || !signe) throw new Error(signeError?.message ?? "Lien de lecture impossible.");
    const reponse = await fetch(signe.signedUrl);
    if (!reponse.ok || !reponse.body) throw new Error(`Lecture impossible (${reponse.status}).`);
    const taille = Number(reponse.headers.get("content-length") ?? 0);
    if (taille > MAX_ORIGINAL_OCTETS) {
      await reponse.body.cancel();
      await noter(path, { statut: "ignore", octets_avant: taille, message: "Trop lourde pour l'allègement automatique (laissée telle quelle)." });
      return { statut: "ignore", message: "trop lourde" };
    }
    await pipeline(Readable.fromWeb(reponse.body as never), createWriteStream(entree));
    const octetsAvant = (await stat(entree)).size;

    const bin = await binaireFfmpeg();
    const sonde = await lancer(bin, ["-hide_banner", "-i", entree], 30_000);
    const infos = lireInfos(sonde.sortie);
    if (infos.duree && infos.duree > MAX_DUREE_S) {
      await noter(path, { statut: "ignore", octets_avant: octetsAvant, duree_s: Math.round(infos.duree), message: "Trop longue pour l'allègement automatique (laissée telle quelle)." });
      return { statut: "ignore", message: "trop longue" };
    }
    if (infos.kbps && infos.kbps < DEJA_LEGERE_KBPS && (infos.cote ?? 0) <= 1280) {
      await noter(path, { statut: "ignore", octets_avant: octetsAvant, duree_s: infos.duree ? Math.round(infos.duree) : null, message: "Déjà légère." });
      return { statut: "ignore", message: "déjà légère" };
    }

    const encodage = await lancer(
      bin,
      [
        "-hide_banner", "-y", "-i", entree,
        "-vf", "scale=w='if(gt(a,1),min(1280,iw),-2)':h='if(gt(a,1),-2,min(1280,ih))',format=yuv420p",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "27", "-maxrate", "5M", "-bufsize", "10M",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        sortie,
      ],
      ENCODAGE_MAX_MS
    );
    if (encodage.delai) throw new Error("Allègement trop long (délai dépassé).");
    if (encodage.code !== 0) throw new Error(`ffmpeg a échoué (code ${encodage.code}) : ${encodage.sortie.slice(-300)}`);

    const octetsApres = (await stat(sortie)).size;
    if (octetsApres <= 0 || octetsApres > octetsAvant * GAIN_MINIMUM) {
      await noter(path, {
        statut: "ignore",
        octets_avant: octetsAvant,
        octets_apres: octetsApres,
        duree_s: infos.duree ? Math.round(infos.duree) : null,
        message: "Gain trop faible : original conservé.",
      });
      return { statut: "ignore", message: "gain trop faible" };
    }

    const contenu = await readFile(sortie);
    const { error: envoiError } = await supabase.storage
      .from(BUCKET)
      .upload(path, contenu, { upsert: true, contentType: "video/mp4", cacheControl: "3600" });
    if (envoiError) throw new Error(`Remplacement impossible : ${envoiError.message}`);

    await noter(path, {
      statut: "ok",
      octets_avant: octetsAvant,
      octets_apres: octetsApres,
      duree_s: infos.duree ? Math.round(infos.duree) : null,
      message: null,
    });
    return { statut: "ok", message: `${Math.round(octetsAvant / 1048576)} Mo → ${Math.round(octetsApres / 1048576)} Mo` };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await noter(path, { statut: "erreur", message: message.slice(0, 500) });
    return { statut: "erreur", message };
  } finally {
    await rm(dossier, { recursive: true, force: true }).catch(() => {});
  }
}

// Vidéos rattachées à un profil et jamais traitées (nouvelles depuis la mise
// en service : les anciennes sont marquées « ignore » par la migration).
export async function prochainesAAlleger(limite = 1): Promise<string[]> {
  const supabase = createAdminClient();
  const { data: entrees } = await supabase
    .from("casting_entries")
    .select("video_storage_paths")
    .not("video_storage_paths", "eq", "{}")
    .order("created_at", { ascending: false })
    .limit(300)
    .returns<{ video_storage_paths: string[] }[]>();
  const chemins = Array.from(new Set((entrees ?? []).flatMap((e) => e.video_storage_paths))).filter(cheminVideoValide);
  if (chemins.length === 0) return [];
  const { data: faits } = await supabase.from("casting_videos_allegees").select("path, statut, essais, updated_at").in("path", chemins);
  const etat = new Map((faits ?? []).map((f) => [f.path, f]));
  const maintenant = Date.now();
  return chemins
    .filter((p) => {
      const f = etat.get(p);
      if (!f) return true;
      if (f.statut === "erreur") return f.essais < ESSAIS_MAX;
      if (f.statut === "en_cours") return maintenant - new Date(f.updated_at).getTime() > 10 * 60_000;
      return false;
    })
    .slice(0, limite);
}
