import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildXlsxResponse, sanitizeFilenamePart, type ExportColumn } from "@/lib/export/xlsx";
import { getListeArtistiqueItems } from "@/lib/casting/liste-artistique";
import { checkProjetAccess } from "@/lib/auth/session";

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

export async function GET(request: NextRequest) {
  const projetId = request.nextUrl.searchParams.get("projet_id");
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return NextResponse.json({ error: accessError }, { status: 403 });
  if (!projetId) return NextResponse.json({ error: "projet_id requis." }, { status: 400 });

  const supabase = createAdminClient();
  const [{ data: projet }, items] = await Promise.all([
    supabase.from("projets").select("nom").eq("id", projetId).single(),
    getListeArtistiqueItems(projetId),
  ]);

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

  const projetNom = projet?.nom ?? "projet";
  return buildXlsxResponse(
    `liste-artistique-${sanitizeFilenamePart(projetNom)}.xlsx`,
    "Liste artistique",
    COLUMNS,
    rows,
    `Liste artistique — ${projetNom}`
  );
}
