import { ImageResponse } from "next/og";
import { NextResponse, type NextRequest } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { LogoMark } from "@/components/ui/logo";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess } from "@/lib/auth/session";
import { getAnnoncePhotos } from "@/lib/annonces/moodboard";
import { getAnnoncePhotoUrl } from "@/lib/projets/annonce-photo";
import { generateQrCodeDataUrl } from "@/lib/annonces/qrcode";
import { getSiteOrigin } from "@/lib/partage/data";
import { getAnnonceDates } from "@/lib/annonces/dates";
import { formatAnnonceDatesLabel } from "@/lib/format-date";
import {
  affichePolice,
  affichePoliceCorps,
  afficheTaille,
  afficheCouleurs,
  normalizeAfficheCouleur,
  normalizeAffichePolice,
  normalizeAffichePoliceCorps,
  normalizeAfficheTaille,
  normalizeAfficheFormat,
  type AfficheFormat,
} from "@/lib/annonces/affiche";

export const runtime = "nodejs";

// Lus une fois par instance, à la demande : seules les polices utilisées
// par l'affiche sont passées au rendu.
const polices = new Map<string, Promise<Buffer>>();
function lirePolice(fichier: string) {
  if (!polices.has(fichier)) polices.set(fichier, readFile(join(process.cwd(), "src/app/fonts", fichier)));
  return polices.get(fichier)!;
}

type Contenu = {
  titre: string;
  description: string | null;
  date_recherchee: string | null;
  lieu: string | null;
  couleur: string | null;
  police: string | null;
  couleurTitre: string | null;
  policeCorps: string | null;
  couleurCorps: string | null;
  tailleCorps: string | null;
};

// Marge basse en plus pour une story : Instagram y affiche la barre de
// réponse, le texte ne doit pas passer dessous.
const STORY_MARGE_BAS = 220;

// Affiche (1080 de large ; carrée pour un post, 1080×1920 pour une story,
// plus haute si le texte l'exige) : photo de fond (moodboard ou photo
// projet), infos clés, QR code vers le lien de candidature. GET =
// l'annonce telle qu'enregistrée ; POST = aperçu depuis le formulaire, avec
// le texte et le style pas encore enregistrés.
async function rendreAffiche(id: string, format: AfficheFormat, surcharge?: Partial<Contenu>) {
  const supabase = createAdminClient();
  const { data: annonce } = await supabase
    .from("annonces")
    .select(
      "titre, description, date_recherchee, lieu, public_token, projet_id, affiche_couleur, affiche_police, affiche_couleur_titre, affiche_police_corps, affiche_couleur_corps, affiche_taille_corps, projets(nom, annonce_photo_storage_path)"
    )
    .eq("id", id)
    .single<{
      titre: string;
      description: string | null;
      date_recherchee: string | null;
      lieu: string | null;
      public_token: string;
      projet_id: string;
      affiche_couleur: string | null;
      affiche_police: string | null;
      affiche_couleur_titre: string | null;
      affiche_police_corps: string | null;
      affiche_couleur_corps: string | null;
      affiche_taille_corps: string | null;
      projets: { nom: string; annonce_photo_storage_path: string | null } | null;
    }>();
  if (!annonce) return NextResponse.json({ error: "Annonce introuvable." }, { status: 404 });

  const accessError = await checkProjetAccess(annonce.projet_id);
  if (accessError) return NextResponse.json({ error: accessError }, { status: 403 });

  const contenu: Contenu = {
    titre: annonce.titre,
    description: annonce.description,
    date_recherchee: annonce.date_recherchee,
    lieu: annonce.lieu,
    couleur: annonce.affiche_couleur,
    police: annonce.affiche_police,
    couleurTitre: annonce.affiche_couleur_titre,
    policeCorps: annonce.affiche_police_corps,
    couleurCorps: annonce.affiche_couleur_corps,
    tailleCorps: annonce.affiche_taille_corps,
    ...surcharge,
  };
  const couleurs = afficheCouleurs(normalizeAfficheCouleur(contenu.couleur));
  const police = affichePolice(normalizeAffichePolice(contenu.police));
  const policeCorps = affichePoliceCorps(normalizeAffichePoliceCorps(contenu.policeCorps));
  const echelle = afficheTaille(normalizeAfficheTaille(contenu.tailleCorps)).echelle * policeCorps.facteur;
  const couleurTitre = normalizeAfficheCouleur(contenu.couleurTitre) ?? couleurs.texte;
  const couleurCorps = normalizeAfficheCouleur(contenu.couleurCorps) ?? couleurs.texteDoux;

  const [moodboard, origin, annonceDates, policeBase, policeTexte, policeTitre] = await Promise.all([
    getAnnoncePhotos(supabase, id),
    getSiteOrigin(),
    getAnnonceDates(id),
    lirePolice("SpaceGrotesk-500.ttf"),
    lirePolice(policeCorps.fichier),
    lirePolice(police.fichier),
  ]);
  const backgroundUrl = moodboard[0]?.url ?? getAnnoncePhotoUrl(supabase, annonce.projets?.annonce_photo_storage_path);
  const postulerUrl = `${origin}/postuler/${annonce.public_token}`;
  const qrCode = await generateQrCodeDataUrl(postulerUrl);

  const datesLabel = formatAnnonceDatesLabel(annonceDates, contenu.date_recherchee);
  const infoLine = [annonce.projets?.nom, datesLabel, contenu.lieu].filter(Boolean).join(" · ");

  // Texte complet, jamais tronqué : l'affiche grandit en hauteur. Découpé
  // sur les sauts de ligne d'origine, en ne normalisant les espaces qu'à
  // l'intérieur de chaque paragraphe (sinon tout est "collé").
  const descriptionParagraphs = (contenu.description ?? "")
    .split(/\n+/)
    .map((p) => p.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);

  // Satori ne s'ajuste pas à son contenu : la hauteur est estimée avant le
  // rendu. Colonne de texte ≈ 788px (1080 - 128 de marges - 140 de QR - 24
  // d'écart) ; le nombre de caractères par ligne dépend de la police et de
  // la taille choisies (valeurs prudentes, voir affiche.ts).
  const descriptionTaille = Math.round(22 * echelle);
  const descriptionInterligne = Math.ceil(descriptionTaille * 1.5);
  const descriptionCarParLigne = Math.floor(policeCorps.caracteresParLigne / echelle);
  const descriptionEcart = Math.round(10 * echelle);
  const descriptionLines = descriptionParagraphs.reduce(
    (sum, p) => sum + Math.max(1, Math.ceil(p.length / descriptionCarParLigne)),
    0
  );
  const descriptionGapsHeight = Math.max(0, descriptionParagraphs.length - 1) * descriptionEcart;
  const titleLines = Math.max(1, Math.ceil(contenu.titre.length / police.titreCaracteresParLigne));
  const titleLineHeight = Math.ceil(police.titreTaille * police.titreInterligne);

  const infoTaille = Math.round(28 * echelle);
  const infoCarParLigne = Math.floor((46 * policeCorps.caracteresParLigne) / 62 / echelle);
  const infoLineLines = infoLine ? Math.max(1, Math.ceil(infoLine.length / infoCarParLigne)) : 0;
  // La base compte déjà une ligne d'infos de 34px.
  const infoLineHeight = infoLineLines > 0 ? infoLineLines * Math.ceil(infoTaille * 1.2) - 34 : 0;

  // Base (marges, infos, QR, lien, logo) + titre + description, minimum
  // 1080 (carré) ou 1920 (story) tant que le texte est court.
  const margeBas = format === "story" ? STORY_MARGE_BAS : 0;
  const baseHeight = 620 + margeBas + titleLines * titleLineHeight + infoLineHeight;
  const descriptionHeight = descriptionLines * descriptionInterligne + descriptionGapsHeight;
  const imageHeight = Math.max(format === "story" ? 1920 : 1080, baseHeight + descriptionHeight);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          backgroundColor: couleurs.fond,
          fontFamily: "Base",
          ...(backgroundUrl
            ? { backgroundImage: `url(${backgroundUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
            : {}),
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 28,
            padding: 64,
            paddingBottom: 64 + margeBas,
            background: `linear-gradient(to top, ${couleurs.voile} 46%, rgba(0,0,0,0))`,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 14 }}>
              <div
                style={{
                  fontFamily: "Titre",
                  fontSize: police.titreTaille,
                  color: couleurTitre,
                  lineHeight: police.titreInterligne,
                  textTransform: police.majuscules ? "uppercase" : "none",
                }}
              >
                {contenu.titre}
              </div>
              {infoLine && (
                <div style={{ fontFamily: "Corps", fontSize: infoTaille, color: couleurCorps, lineHeight: 1.2 }}>
                  {infoLine}
                </div>
              )}
              {descriptionParagraphs.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: descriptionEcart,
                    fontFamily: "Corps",
                    fontSize: descriptionTaille,
                    color: couleurCorps,
                    lineHeight: 1.5,
                    marginTop: 10,
                  }}
                >
                  {descriptionParagraphs.map((paragraph, i) => (
                    <div key={i}>{paragraph}</div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- rendu via Satori (next/og), pas le DOM */}
              <img src={qrCode} width={140} height={140} style={{ borderRadius: 8, background: "white", padding: 8 }} alt="" />
              <div style={{ fontSize: 16, color: couleurs.texteDoux }}>Scannez pour postuler</div>
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 18, color: couleurs.accent, marginTop: 4 }}>{postulerUrl}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
            <LogoMark size={28} />
            <div style={{ display: "flex", fontSize: 20, color: couleurs.accent }}>
              Booking<span style={{ color: couleurs.texte }}>Extras</span>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: imageHeight,
      fonts: [
        { name: "Base", data: policeBase, weight: 500, style: "normal" },
        { name: "Corps", data: policeTexte, weight: 500, style: "normal" },
        { name: "Titre", data: policeTitre, weight: 700, style: "normal" },
      ],
      // L'affiche change dès qu'on modifie l'annonce ou son style.
      headers: { "Cache-Control": "no-store" },
    }
  );
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return rendreAffiche(id, normalizeAfficheFormat(request.nextUrl.searchParams.get("format")));
}

function texte(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, max);
  return t === "" ? null : t;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  return rendreAffiche(id, normalizeAfficheFormat(body.format), {
    titre: texte(body.titre, 200) ?? "Titre de l'annonce",
    description: texte(body.description, 5000),
    date_recherchee: texte(body.date_recherchee, 10),
    lieu: texte(body.lieu, 200),
    couleur: normalizeAfficheCouleur(body.couleur),
    police: normalizeAffichePolice(body.police),
    couleurTitre: normalizeAfficheCouleur(body.couleur_titre),
    policeCorps: normalizeAffichePoliceCorps(body.police_corps),
    couleurCorps: normalizeAfficheCouleur(body.couleur_corps),
    tailleCorps: normalizeAfficheTaille(body.taille_corps),
  });
}
