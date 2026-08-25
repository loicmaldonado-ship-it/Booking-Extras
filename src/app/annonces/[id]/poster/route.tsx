import { ImageResponse } from "next/og";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess } from "@/lib/auth/session";
import { getAnnoncePhotos } from "@/lib/annonces/moodboard";
import { getAnnoncePhotoUrl } from "@/lib/projets/annonce-photo";
import { generateQrCodeDataUrl } from "@/lib/annonces/qrcode";
import { getSiteOrigin } from "@/lib/partage/data";
import { formatDateShort } from "@/lib/format-date";

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

  const [moodboard, origin] = await Promise.all([getAnnoncePhotos(supabase, id), getSiteOrigin()]);
  const backgroundUrl = moodboard[0]?.url ?? getAnnoncePhotoUrl(supabase, annonce.projets?.annonce_photo_storage_path);
  const postulerUrl = `${origin}/postuler/${annonce.public_token}`;
  const qrCode = await generateQrCodeDataUrl(postulerUrl);

  const infoLine = [annonce.projets?.nom, annonce.date_recherchee ? formatDateShort(annonce.date_recherchee) : null, annonce.lieu]
    .filter(Boolean)
    .join(" · ");

  const descriptionText = annonce.description?.replace(/\s+/g, " ").trim() ?? "";
  const description = descriptionText.length > 220 ? `${descriptionText.slice(0, 220).trim()}…` : descriptionText;

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
            gap: 16,
            padding: 64,
            background: "linear-gradient(to top, rgba(10,10,10,0.92) 40%, rgba(10,10,10,0))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 8 }}>
              <div style={{ fontSize: 56, fontWeight: 700, color: "white", lineHeight: 1.1 }}>{annonce.titre}</div>
              {infoLine && <div style={{ fontSize: 28, color: "#E8E8E8" }}>{infoLine}</div>}
              {description && (
                <div style={{ fontSize: 22, color: "#D8D8D8", lineHeight: 1.4, marginTop: 4 }}>{description}</div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- rendu via Satori (next/og), pas le DOM */}
              <img src={qrCode} width={140} height={140} style={{ borderRadius: 8, background: "white", padding: 8 }} alt="" />
              <div style={{ fontSize: 16, color: "#E8E8E8" }}>Scannez pour postuler</div>
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 20, color: "#F5A47A", fontWeight: 600 }}>
            Booking<span style={{ color: "white" }}>Extras</span>
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 }
  );
}
