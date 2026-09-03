import { NextResponse } from "next/server";
import { buildXlsxResponse, sanitizeFilenamePart, type ExportColumn } from "@/lib/export/xlsx";
import { getListeArtistiqueItems } from "@/lib/casting/liste-artistique";
import { resolvePartageToken, getCastingDocsVisibilityByToken } from "@/lib/partage/data";
import { projetNomPublic } from "@/lib/projets/types";

const COLUMNS: ExportColumn[] = [
  { header: "N°", key: "numero", width: 6 },
  { header: "Rôle", key: "role", width: 24 },
  { header: "Comédien·ne", key: "comedien", width: 26 },
  { header: "Téléphone", key: "telephone", width: 16 },
  { header: "Email", key: "email", width: 28 },
  { header: "Agent", key: "agent", width: 20 },
  { header: "Agence", key: "agence", width: 20 },
  { header: "Tél. agent", key: "tel_agent", width: 16 },
  { header: "Email agent", key: "email_agent", width: 28 },
];

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [projet, visibility] = await Promise.all([
    resolvePartageToken(token, "casting"),
    getCastingDocsVisibilityByToken(token),
  ]);
  if (!projet || !visibility.listeArtistique) {
    return NextResponse.json({ error: "Document indisponible." }, { status: 404 });
  }

  const items = await getListeArtistiqueItems(projet.id);
  const rows = items.map(({ numero, role, entry }) => {
    const f = entry.figurants;
    return {
      numero,
      role: role.nom,
      comedien: f ? `${f.prenom} ${f.nom}` : "",
      telephone: f?.telephone ?? "",
      email: f?.email ?? "",
      agent: f?.agent_nom ?? "",
      agence: f?.agent_agence ?? "",
      tel_agent: f?.agent_telephone ?? "",
      email_agent: f?.agent_email ?? "",
    };
  });

  const nom = projetNomPublic(projet);
  return buildXlsxResponse(
    `liste-artistique-${sanitizeFilenamePart(nom)}.xlsx`,
    "Liste artistique",
    COLUMNS,
    rows,
    `Liste artistique — ${nom}`
  );
}
