import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildXlsxResponse } from "@/lib/export/xlsx";
import { getCurrentProfile } from "@/lib/auth/session";
import { isOwner } from "@/lib/auth/owner";

type ExportRow = {
  heure_convocation: string | null;
  fonction: string | null;
  cachet: string | null;
  convocation_envoyee: boolean;
  reponse_recue: boolean;
  figurants: {
    prenom: string;
    nom: string;
    email: string | null;
    telephone: string | null;
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
  const projetId = sp.get("projet_id");
  const date = sp.get("date");
  if (!projetId || !date) return NextResponse.json({ error: "projet_id et date requis." }, { status: 400 });

  const supabase = createAdminClient();
  const { data: bookingsRaw } = await supabase
    .from("bookings")
    .select(
      "heure_convocation, fonction, cachet, convocation_envoyee, reponse_recue, figurants!bookings_figurant_id_fkey(prenom, nom, email, telephone, compte_myrole, a_vehicule, vehicule_velo, vehicule_moto, vehicule_scooter)"
    )
    .eq("projet_id", projetId)
    .eq("date", date)
    .eq("statut", "confirmé")
    .order("heure_convocation")
    .returns<ExportRow[]>();

  const rows = (bookingsRaw ?? []).map((b) => {
    const f = b.figurants;
    return {
      prenom: f?.prenom ?? "",
      nom: f?.nom ?? "",
      telephone: f?.telephone ?? "",
      email: f?.email ?? "",
      heure: b.heure_convocation ? b.heure_convocation.slice(0, 5) : "",
      fonction: b.fonction ?? "",
      cachet: b.cachet ?? "",
      convocationEnvoyee: b.convocation_envoyee ? "Oui" : "Non",
      reponseRecue: b.reponse_recue ? "Oui" : "Non",
      myrole: f?.compte_myrole ? "Oui" : "Non",
      vehicule: f?.a_vehicule === null || f?.a_vehicule === undefined ? "" : f.a_vehicule ? "Oui" : "Non",
      vehiculeType: f
        ? [f.vehicule_velo && "Vélo", f.vehicule_moto && "Moto", f.vehicule_scooter && "Scooter"]
            .filter(Boolean)
            .join(", ")
        : "",
    };
  });

  return buildXlsxResponse(`booking-${date}.xlsx`, "Booking", [
    { header: "Prénom", key: "prenom" },
    { header: "Nom", key: "nom" },
    { header: "Téléphone", key: "telephone" },
    { header: "Email", key: "email", width: 28 },
    { header: "Heure convocation", key: "heure" },
    { header: "Fonction", key: "fonction" },
    { header: "Cachet", key: "cachet" },
    { header: "Convocation envoyée", key: "convocationEnvoyee" },
    { header: "Réponse reçue", key: "reponseRecue" },
    { header: "Compte Myrole", key: "myrole" },
    { header: "Véhicule", key: "vehicule" },
    { header: "Type véhicule", key: "vehiculeType" },
  ], rows);
}
