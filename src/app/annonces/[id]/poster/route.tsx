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
  afficheCouleurs,
  normalizeAfficheCouleur,
  normalizeAffichePolice,
} from "@/lib/annonces/affiche";

export const runtime = "nodejs";

// Lus une fois par instance, à la demande : seules la police du corps et
// celle du titre choisie sont passées au rendu.
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
};

// Affiche (1080 de large, format Instagram/Facebook, plus haute si le texte
// l'exige) : photo de fond (moodboard ou photo projet), infos clés, QR code
// vers le lien de candidature. GET = l'annonce telle qu'enregistrée ; POST
// = aperçu depuis le formulaire, avec le texte et le style pas encore
// enregistrés.
async function rendreAffiche(id: string, surcharge?: Partial<Contenu>) {
  const supabase = createAdminClient();
  const { data: annonce } = await supabase
    .from("annonces")
    .select(
      "titre, description, date_recherchee, lieu, public_token, projet_id, affiche_couleur, affiche_police, affiche_couleur_titre, projets(nom, annonce_photo_storage_path)"
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
    ...surcharge,
  };
  const couleurs = afficheCouleurs(normalizeAfficheCouleur(contenu.couleur));
  const police = affichePolice(normalizeAffichePolice(contenu.police));
  const couleurTitre = normalizeAfficheCouleur(contenu.couleurTitre) ?? couleurs.texte;

  const [moodboard, origin, annonceDates, policeCorps, policeTitre] = await Promise.all([
    getAnnoncePhotos(supabase, id),
    getSiteOrigin(),
    getAnnonceDates(id),
    lirePolice("SpaceGrotesk-500.ttf"),
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
  // d'écart) ; ~62 caractères par ligne à 22px en Space Grotesk, valeur
  // prudente. Le titre dépend de la police choisie (voir affiche.ts).
  const CHARS_PER_LINE = 62;
  const descriptionLines = descriptionParagraphs.reduce(
    (sum, p) => sum + Math.max(1, Math.ceil(p.length / CHARS_PER_LINE)),
    0
  );
  const descriptionGapsHeight = Math.max(0, descriptionParagraphs.length - 1) * 10;
  const titleLines = Math.max(1, Math.ceil(contenu.titre.length / police.titreCaracteresParLigne));
  const titleLineHeight = Math.ceil(police.titreTaille * police.titreInterligne);

  const INFO_CHARS_PER_LINE = 46;
  const infoLineLines = infoLine ? Math.max(1, Math.ceil(infoLine.length / INFO_CHARS_PER_LINE)) : 0;
  const infoLineHeight = infoLineLines > 1 ? (infoLineLines - 1) * 34 : 0;

  // Base (marges, infos, QR, lien, logo) + titre + description, minimum
  // 1080 pour garder le format carré tant que le texte est court.
  const baseHeight = 620 + titleLines * titleLineHeight + infoLineHeight;
  const descriptionHeight = descriptionLines * 31 + descriptionGapsHeight;
  const imageHeight = Math.max(1080, baseHeight + descriptionHeight);

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
          fontFamily: "Corps",
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
              {infoLine && <div style={{ fontSize: 28, color: couleurs.texteDoux }}>{infoLine}</div>}
              {descriptionParagraphs.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    fontSize: 22,
                    color: couleurs.texteDoux,
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
        { name: "Corps", data: policeCorps, weight: 500, style: "normal" },
        { name: "Titre", data: policeTitre, weight: 700, style: "normal" },
      ],
      // L'affiche change dès qu'on modifie l'annonce ou son style.
      headers: { "Cache-Control": "no-store" },
    }
  );
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return rendreAffiche(id);
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
  return rendreAffiche(id, {
    titre: texte(body.titre, 200) ?? "Titre de l'annonce",
    description: texte(body.description, 5000),
    date_recherchee: texte(body.date_recherchee, 10),
    lieu: texte(body.lieu, 200),
    couleur: normalizeAfficheCouleur(body.couleur),
    police: normalizeAffichePolice(body.police),
    couleurTitre: normalizeAfficheCouleur(body.couleur_titre),
  });
}
