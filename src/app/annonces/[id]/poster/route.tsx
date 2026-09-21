import { ImageResponse } from "next/og";
import { NextResponse, type NextRequest } from "next/server";
import { LogoMark } from "@/components/ui/logo";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess } from "@/lib/auth/session";
import { getAnnoncePhotos } from "@/lib/annonces/moodboard";
import { getAnnoncePhotoUrl } from "@/lib/projets/annonce-photo";
import { generateQrCodeDataUrl } from "@/lib/annonces/qrcode";
import { getSiteOrigin } from "@/lib/partage/data";
import { getAnnonceDates } from "@/lib/annonces/dates";
import { formatAnnonceDatesLabel } from "@/lib/format-date";

export const runtime = "nodejs";

// Affiche carrée (1080×1080, format Instagram/Facebook) générée à la volée
// pour diffuser rapidement une annonce — photo de fond (moodboard ou photo
// projet), infos clés, QR code vers le lien de candidature.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: annonce } = await supabase
    .from("annonces")
    .select("titre, description, date_recherchee, lieu, public_token, projet_id, projets(nom, annonce_photo_storage_path)")
    .eq("id", id)
    .single<{
      titre: string;
      description: string | null;
      date_recherchee: string | null;
      lieu: string | null;
      public_token: string;
      projet_id: string;
      projets: { nom: string; annonce_photo_storage_path: string | null } | null;
    }>();
  if (!annonce) return NextResponse.json({ error: "Annonce introuvable." }, { status: 404 });

  const accessError = await checkProjetAccess(annonce.projet_id);
  if (accessError) return NextResponse.json({ error: accessError }, { status: 403 });

  const [moodboard, origin, annonceDates] = await Promise.all([
    getAnnoncePhotos(supabase, id),
    getSiteOrigin(),
    getAnnonceDates(id),
  ]);
  const backgroundUrl = moodboard[0]?.url ?? getAnnoncePhotoUrl(supabase, annonce.projets?.annonce_photo_storage_path);
  const postulerUrl = `${origin}/postuler/${annonce.public_token}`;
  const qrCode = await generateQrCodeDataUrl(postulerUrl);

  const datesLabel = formatAnnonceDatesLabel(annonceDates, annonce.date_recherchee);
  const infoLine = [annonce.projets?.nom, datesLabel, annonce.lieu].filter(Boolean).join(" · ");

  // Texte complet, plus de troncature à 220 caractères — l'affiche grandit
  // en hauteur pour l'accueillir plutôt que de couper le message (voir
  // calcul de imageHeight plus bas), au lieu du carré 1080×1080 fixe
  // d'origine qui coupait tout texte un peu long.
  //
  // Découpé en paragraphes sur les sauts de ligne d'origine : un
  // remplacement global de TOUS les espaces (y compris les retours à la
  // ligne) fondait les paragraphes de la personne qui rédige en un seul
  // bloc illisible ("tout collé", signalé en usage réel) — on ne
  // normalise les espaces qu'À L'INTÉRIEUR de chaque paragraphe, jamais
  // les sauts de ligne entre eux.
  const descriptionParagraphs = (annonce.description ?? "")
    .split(/\n+/)
    .map((p) => p.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);

  // Estimation grossière du nombre de lignes que le texte va occuper, pour
  // dimensionner l'image en conséquence (Satori/ImageResponse ne permet pas
  // un canevas qui s'ajuste tout seul à son contenu — la hauteur doit être
  // connue à la génération). Largeur dispo pour la colonne de texte ≈ 1080
  // - 128 (padding) - 140 (colonne QR) - 24 (gap) ≈ 788px ; ~11px par
  // caractère à 22px de police sans-serif → ~68 caractères/ligne. Valeur
  // volontairement prudente (sous-estimer la largeur plutôt que risquer un
  // débordement). Chaque paragraphe arrondit indépendamment à la ligne
  // supérieure (un paragraphe court prend quand même sa propre ligne).
  const CHARS_PER_LINE = 68;
  const descriptionLines = descriptionParagraphs.reduce(
    (sum, p) => sum + Math.max(1, Math.ceil(p.length / CHARS_PER_LINE)),
    0
  );
  const descriptionGapsHeight = Math.max(0, descriptionParagraphs.length - 1) * 10;
  const titleLines = annonce.titre.length > 26 ? 2 : 1;

  // Même logique de repli pour l'infoLine (projet · dates · lieu) : une
  // annonce avec plusieurs dates peut dépasser une ligne à 28px — elle passe
  // alors à la ligne suivante (le style ne fixe pas whiteSpace: nowrap), et
  // la hauteur doit en tenir compte comme pour la description.
  const INFO_CHARS_PER_LINE = 50;
  const infoLineLines = infoLine ? Math.max(1, Math.ceil(infoLine.length / INFO_CHARS_PER_LINE)) : 0;
  const infoLineHeight = infoLineLines > 1 ? (infoLineLines - 1) * 34 : 0;

  // Hauteur de base (padding, titre, infoLine, bloc QR + légende, ligne de
  // lien, pied de page logo) + la place prise par la description, avec un
  // minimum de 1080 pour garder le format carré Instagram/Facebook tant que
  // le texte est court.
  const baseHeight = 620 + titleLines * 62 + infoLineHeight;
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
          backgroundColor: "#E8734A",
          fontFamily: "sans-serif",
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
            background: "linear-gradient(to top, rgba(10,10,10,0.94) 46%, rgba(10,10,10,0))",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 14 }}>
              <div style={{ fontSize: 56, fontWeight: 700, color: "white", lineHeight: 1.15 }}>{annonce.titre}</div>
              {infoLine && <div style={{ fontSize: 28, color: "#E8E8E8" }}>{infoLine}</div>}
              {descriptionParagraphs.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    fontSize: 22,
                    color: "#D8D8D8",
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
              <div style={{ fontSize: 16, color: "#E8E8E8" }}>Scannez pour postuler</div>
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 18, color: "#F5A47A", marginTop: 4 }}>{postulerUrl}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
            <LogoMark size={28} />
            <div style={{ display: "flex", fontSize: 20, color: "#F5A47A", fontWeight: 600 }}>
              Booking<span style={{ color: "white" }}>Extras</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: imageHeight }
  );
}
