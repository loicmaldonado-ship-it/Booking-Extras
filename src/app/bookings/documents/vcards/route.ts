import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConfirmedBookings } from "@/lib/documents/data";
import { checkProjetAccess } from "@/lib/auth/session";

// Échappe , ; \ et les retours à la ligne comme l'exige la RFC 6350 —
// sinon une virgule dans un nom ("Dupont, Jean") casserait le parsing côté
// client (Contacts, Google, etc.).
function vcardEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const projetId = sp.get("projet_id");
  const date = sp.get("date");
  if (!projetId || !date) return NextResponse.json({ error: "projet_id et date requis." }, { status: 400 });

  const accessError = await checkProjetAccess(projetId);
  if (accessError) return NextResponse.json({ error: accessError }, { status: 403 });

  const supabase = createAdminClient();
  const [{ data: projet }, bookings] = await Promise.all([
    supabase.from("projets").select("nom").eq("id", projetId).single(),
    getConfirmedBookings(projetId, date),
  ]);
  const projetNom = projet?.nom ?? "";

  const cards = bookings
    .filter((b) => b.figurant.telephone || b.figurant.email)
    .map((b) => {
      const f = b.figurant;
      const noteParts = [b.fonction, b.cachet, b.heure_convocation ? `Convocation ${b.heure_convocation.slice(0, 5)}` : null].filter(
        (v): v is string => !!v
      );
      const lines = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `N:${vcardEscape(f.nom)};${vcardEscape(f.prenom)};;;`,
        `FN:${vcardEscape(f.prenom)} ${vcardEscape(f.nom)}`,
        projetNom ? `ORG:${vcardEscape(projetNom)}` : null,
        f.telephone ? `TEL;TYPE=CELL:${vcardEscape(f.telephone)}` : null,
        f.email ? `EMAIL:${vcardEscape(f.email)}` : null,
        noteParts.length > 0 ? `NOTE:${vcardEscape(noteParts.join(" — "))}` : null,
        "END:VCARD",
      ].filter((l): l is string => !!l);
      return lines.join("\r\n");
    });

  const body = cards.join("\r\n") + (cards.length > 0 ? "\r\n" : "");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="booking-${date}.vcf"`,
    },
  });
}
