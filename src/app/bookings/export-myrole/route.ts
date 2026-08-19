import { createAdminClient } from "@/lib/supabase/admin";
import { buildMyroleCsv } from "@/lib/export/myrole";
import type { Figurant } from "@/lib/figurants/types";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projetId = url.searchParams.get("projet_id");
  const date = url.searchParams.get("date");
  const format = url.searchParams.get("format") ?? "csv";

  if (!projetId || !date) {
    return new Response("Choisis un projet et une date pour exporter la journée.", {
      status: 400,
    });
  }

  const supabase = createAdminClient();

  // Export Myrole : uniquement les bookings confirmés de cette journée —
  // les gens pas encore confirmés ne doivent jamais apparaître ici.
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("figurants!bookings_figurant_id_fkey(*)")
    .eq("projet_id", projetId)
    .eq("date", date)
    .eq("statut", "confirmé")
    .returns<{ figurants: Figurant | null }[]>();

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  const figurants = (bookings ?? [])
    .map((b) => b.figurants)
    .filter((f): f is Figurant => !!f);

  if (format === "emails") {
    const emails = figurants.map((f) => f.email).filter((e): e is string => !!e);
    return new Response(emails.join(" ; "), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const csv = buildMyroleCsv(figurants);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="myrole-${date}.csv"`,
    },
  });
}
