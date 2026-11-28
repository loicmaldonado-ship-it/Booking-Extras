import { createAdminClient } from "@/lib/supabase/admin";
import { getConfirmedBookings } from "@/lib/documents/data";
import { getPhotosProjet } from "@/lib/documents/photos-projet";
import { BackToJournee } from "@/components/documents/back-to-journee";
import { StatutChips } from "@/components/documents/statut-chips";
import { ApercuPhotosDocs, type ApercuPersonne } from "@/components/documents/apercu-photos-docs";
import { parseDocStatut } from "@/lib/documents/statuts";
import { requireProjetAccess } from "@/lib/auth/session";
import { nomComplet } from "@/lib/noms";
import { formatDateLong } from "@/lib/format-date";

export const dynamic = "force-dynamic";

// Aperçu des photos qui sortent dans les trombis et les fiches mensuration d'une
// journée : pour chaque personne, ses 3 photos retenues (la 1re est la photo du
// trombi) et toutes les autres (essayage, candidature, compte), à échanger d'un clic.
export default async function ApercuPhotosDocsPage({
  searchParams,
}: {
  searchParams: Promise<{ projet_id?: string; date?: string; statut?: string }>;
}) {
  const { projet_id, date, statut } = await searchParams;
  await requireProjetAccess(projet_id);
  if (!projet_id || !date) return <p className="text-text-muted">Choisis un projet et une date.</p>;

  const docStatut = parseDocStatut(statut, false);
  const supabase = createAdminClient();
  const [{ data: projet }, bookings] = await Promise.all([
    supabase.from("projets").select("nom").eq("id", projet_id).single(),
    getConfirmedBookings(projet_id, date, docStatut.statuts),
  ]);
  const detail = await getPhotosProjet(projet_id, bookings.map((b) => b.figurant.id));

  const versPhoto = (p: { id: string; url: string | null; type: string }) => ({ id: p.id, url: p.url ?? "", type: p.type });
  const personnes: ApercuPersonne[] = bookings.map((b) => {
    const d = detail.get(b.figurant.id);
    return {
      figurantId: b.figurant.id,
      nom: nomComplet(b.figurant),
      fonction: b.fonction,
      manuel: d?.manuel ?? false,
      selection: (d?.selection ?? []).map(versPhoto),
      groupes: [
        { titre: "Essayage sur ce projet", photos: (d?.essayage ?? []).map(versPhoto) },
        { titre: "Photos de sa candidature", photos: (d?.candidature ?? []).map(versPhoto) },
        { titre: "Photos de son profil", photos: (d?.compte ?? []).map(versPhoto) },
      ].filter((g) => g.photos.length > 0),
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <BackToJournee projetId={projet_id} date={date} />
      <div>
        <h1 className="text-2xl font-semibold">Aperçu des photos — trombis et fiches mensuration</h1>
        <p className="mt-1 text-text-muted">
          {projet?.nom} · {formatDateLong(date)} — voilà les photos qui sortent pour chaque personne : la 1<sup>re</sup> sur le trombi, les
          trois sur la fiche mensuration. Glisse une photo (de son profil, de sa candidature ou de l&apos;essayage) sur une case, ou réordonne les cases : c&apos;est enregistré pour tout le projet.
        </p>
      </div>
      <StatutChips baseParams={{ projet_id, date }} current={docStatut.key} />
      <ApercuPhotosDocs projetId={projet_id} personnes={personnes} libelleQui={docStatut.label.toLowerCase()} />
    </div>
  );
}
