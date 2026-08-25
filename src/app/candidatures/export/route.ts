import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildXlsxResponse, sanitizeFilenamePart } from "@/lib/export/xlsx";
import { getCurrentProfile } from "@/lib/auth/session";
import { isOwner } from "@/lib/auth/owner";
import { computeAge } from "@/lib/documents/fields";
import { formatDateShort } from "@/lib/format-date";

type ExportRow = {
  id: string;
  onglet_id: string | null;
  fonction_assignee: string | null;
  cachet_assigne: string | null;
  message: string | null;
  created_at: string;
  figurants: {
    prenom: string;
    nom: string;
    ville: string | null;
    email: string | null;
    telephone: string | null;
    genre: string | null;
    date_naissance: string | null;
    compte_myrole: boolean;
    a_vehicule: boolean | null;
    vehicule_velo: boolean;
    vehicule_moto: boolean;
    vehicule_scooter: boolean;
  } | null;
};

export async function GET(request: NextRequest) {
  const profile = await getCurrentProfile();
  if (!isOwner(profile)) return NextResponse.json({ error: "Non autorisé." }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const annonceId = sp.get("annonce_id");
  if (!annonceId) return NextResponse.json({ error: "annonce_id manquant." }, { status: 400 });

  const myrole = sp.get("myrole");
  const genre = sp.get("genre");
  const vehicule = sp.get("vehicule");

  const supabase = createAdminClient();

  const [{ data: candidaturesRaw }, { data: onglets }, { data: bookedCandidatures }, { data: annonce }] =
    await Promise.all([
      supabase
        .from("candidatures")
        .select(
          "id, onglet_id, fonction_assignee, cachet_assigne, message, created_at, figurants(prenom, nom, ville, email, telephone, genre, date_naissance, compte_myrole, a_vehicule, vehicule_velo, vehicule_moto, vehicule_scooter)"
        )
        .eq("annonce_id", annonceId)
        .order("created_at", { ascending: false })
        .returns<ExportRow[]>(),
      supabase.from("candidature_onglets").select("id, nom"),
      supabase.from("bookings").select("candidature_id").not("candidature_id", "is", null),
      supabase.from("annonces").select("titre, projets(nom)").eq("id", annonceId).single<{
        titre: string;
        projets: { nom: string } | null;
      }>(),
    ]);
  const projetNom = annonce?.projets?.nom ?? "";

  const bookedIds = new Set((bookedCandidatures ?? []).map((b) => b.candidature_id));
  const ongletNom = new Map((onglets ?? []).map((o) => [o.id, o.nom]));

  let candidatures = (candidaturesRaw ?? []).filter((c) => !bookedIds.has(c.id));
  if (myrole === "oui") candidatures = candidatures.filter((c) => c.figurants?.compte_myrole);
  else if (myrole === "non") candidatures = candidatures.filter((c) => !c.figurants?.compte_myrole);
  if (genre) candidatures = candidatures.filter((c) => c.figurants?.genre === genre);
  if (vehicule === "oui") candidatures = candidatures.filter((c) => c.figurants?.a_vehicule);
  else if (vehicule === "non") candidatures = candidatures.filter((c) => c.figurants?.a_vehicule === false);
  else if (vehicule === "velo") candidatures = candidatures.filter((c) => c.figurants?.vehicule_velo);
  else if (vehicule === "moto") candidatures = candidatures.filter((c) => c.figurants?.vehicule_moto);
  else if (vehicule === "scooter") candidatures = candidatures.filter((c) => c.figurants?.vehicule_scooter);

  const rows = candidatures.map((c) => {
    const f = c.figurants;
    return {
      prenom: f?.prenom ?? "",
      nom: f?.nom ?? "",
      ville: f?.ville ?? "",
      email: f?.email ?? "",
      telephone: f?.telephone ?? "",
      genre: f?.genre ?? "",
      age: f?.date_naissance ? (computeAge(f.date_naissance) ?? "") : "",
      onglet: c.onglet_id ? (ongletNom.get(c.onglet_id) ?? "") : "À trier",
      fonction: c.fonction_assignee ?? "",
      cachet: c.cachet_assigne ?? "",
      myrole: f?.compte_myrole ? "Oui" : "Non",
      vehicule: f?.a_vehicule === null || f?.a_vehicule === undefined ? "" : f.a_vehicule ? "Oui" : "Non",
      vehiculeType: f
        ? [f.vehicule_velo && "Vélo", f.vehicule_moto && "Moto", f.vehicule_scooter && "Scooter"]
            .filter(Boolean)
            .join(", ")
        : "",
      message: c.message ?? "",
      recueLe: formatDateShort(c.created_at),
    };
  });

  return buildXlsxResponse(
    `candidatures-${sanitizeFilenamePart(projetNom)}.xlsx`,
    "Candidatures",
    [
      { header: "Prénom", key: "prenom" },
      { header: "Nom", key: "nom" },
      { header: "Ville", key: "ville" },
      { header: "Email", key: "email", width: 28 },
      { header: "Téléphone", key: "telephone" },
      { header: "Genre", key: "genre" },
      { header: "Âge", key: "age" },
      { header: "Onglet", key: "onglet" },
      { header: "Fonction assignée", key: "fonction" },
      { header: "Cachet assigné", key: "cachet" },
      { header: "Compte Myrole", key: "myrole" },
      { header: "Véhicule", key: "vehicule" },
      { header: "Type véhicule", key: "vehiculeType" },
      { header: "Message", key: "message", width: 40 },
      { header: "Reçue le", key: "recueLe" },
    ],
    rows,
    `${projetNom}${annonce?.titre ? ` — ${annonce.titre}` : ""}`
  );
}
