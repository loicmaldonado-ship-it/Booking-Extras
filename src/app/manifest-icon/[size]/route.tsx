import { ImageResponse } from "next/og";
import { LogoMark } from "@/components/ui/logo";

export const dynamic = "force-static";

// Note : "force-static" fait que cette route ignore la query string
// (?maskable) pour la génération — même comportement (non différencié)
// qu'avant ce changement, on se contente donc de remplacer le glyphe. Le
// dessin garde une marge intérieure suffisante pour rester lisible même
// recadré en cercle/squircle par l'OS.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> }
) {
  const { size } = await params;
  const dim = Number(size) === 512 ? 512 : 192;

  return new ImageResponse(<LogoMark size={dim} />, { width: dim, height: dim });
}
