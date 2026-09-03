import Link from "next/link";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { PrintSheet } from "@/components/documents/print-sheet";
import { PrintButton } from "@/components/documents/print-button";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { BackLink } from "@/components/ui/back-link";
import { ButtonLink } from "@/components/ui/button";
import { getPhotosByFigurantId, pickPortrait } from "@/lib/documents/data";
import { formatDateLong } from "@/lib/format-date";
import { cn } from "@/lib/cn";
import { requireProjetAccess } from "@/lib/auth/session";
import type { Creneau } from "@/components/essayages/creneaux-panel";

export const dynamic = "force-dynamic";

type EntryRow = {
  id: string;
  creneau_id: string | null;
  statut: string;
  figurant_id: string;
  figurants: { prenom: string; nom: string; telephone: string | null } | null;
  casting_roles: { nom: string } | null;
};

function heureLabel(h: string) {
  return h.slice(0, 5);
}

export default async function CastingPresentielPlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ projet_id?: string; date?: string; vue?: string }>;
}) {
  const { projet_id, date, vue } = await searchParams;
  if (!projet_id || !date) {
    return <p className="text-text-muted">Choisis un projet et une date.</p>;
  }
  await requireProjetAccess(projet_id);
  const isTrombi = vue === "trombi";

  const supabase = createAdminClient();
  const [{ data: projet }, { data: journee }] = await Promise.all([
    supabase.from("projets").select("nom").eq("id", projet_id).single(),
    supabase.from("casting_presentiel_journees").select("id, lieu").eq("projet_id", projet_id).eq("date", date).single(),
  ]);

  if (!journee) {
    return <p className="text-text-muted">Cette journée n&apos;existe pas.</p>;
  }

  const [{ data: entries }, { data: creneaux }] = await Promise.all([
    supabase
      .from("casting_presentiel_entries")
      .select("id, creneau_id, statut, figurant_id, figurants(prenom, nom, telephone), casting_roles(nom)")
      .eq("journee_id", journee.id)
      .returns<EntryRow[]>(),
    supabase
      .from("casting_presentiel_creneaux")
      .select("id, heure_debut, heure_fin, capacite")
      .eq("journee_id", journee.id)
      .order("heure_debut")
      .returns<Creneau[]>(),
  ]);

  const rows = entries ?? [];
  const sansCreneau = rows.filter((r) => !r.creneau_id);
  const photosByFigurant = await getPhotosByFigurantId(rows.map((r) => r.figurant_id));
  const portraitUrl = (figurantId: string) => pickPortrait(photosByFigurant.get(figurantId), projet_id)?.url ?? null;

  const baseUrl = `/casting/presentiel/journee/planning?projet_id=${projet_id}&date=${date}`;

  function TrombiCard({ r }: { r: EntryRow }) {
    return (
      <div className="flex w-24 flex-col items-center gap-0.5 text-center">
        <div className="relative h-32 w-24 overflow-hidden rounded bg-gray-100">
          {portraitUrl(r.figurant_id) && (
            <Image src={portraitUrl(r.figurant_id)!} alt="" fill className="object-cover" />
          )}
        </div>
        <span className="block w-24 truncate text-[10px] font-medium leading-tight">
          {r.figurants ? `${r.figurants.prenom} ${r.figurants.nom}` : "—"}
        </span>
        {r.casting_roles?.nom && (
          <span className="block w-24 truncate text-[8px] leading-tight text-gray-500">{r.casting_roles.nom}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="print-hide flex items-center justify-between gap-3">
        <BackLink href={`/casting/presentiel/journee?projet_id=${projet_id}&date=${date}`} label="Retour à la journée" />
        <ButtonLink href="/casting" variant="ghost">
          🎬 Casting
        </ButtonLink>
      </div>

      <div className="print-hide flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Planning — Casting présentiel</h1>
        <div className="flex items-center gap-3">
          <div className="flex gap-2">
            <Link
              href={baseUrl}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                !isTrombi ? "border-coral bg-coral/15 text-coral" : "border-border text-text-muted hover:text-text"
              )}
            >
              Liste
            </Link>
            <Link
              href={`${baseUrl}&vue=trombi`}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                isTrombi ? "border-coral bg-coral/15 text-coral" : "border-border text-text-muted hover:text-text"
              )}
            >
              Trombi
            </Link>
          </div>
          <DownloadPdfButton filename={`casting-presentiel-${date}${isTrombi ? "-trombi" : ""}.pdf`} />
          <PrintButton />
        </div>
      </div>

      <PrintSheet>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1 border-b border-gray-200 pb-4">
            <h2 className="text-xl font-semibold">{projet?.nom}</h2>
            <p className="text-sm text-gray-600">Casting présentiel — {formatDateLong(date)}</p>
            {journee.lieu && <p className="text-sm text-gray-600">Lieu : {journee.lieu}</p>}
          </div>

          {creneaux && creneaux.length > 0 ? (
            <div className="flex flex-col gap-4">
              {creneaux.map((c) => {
                const assigned = rows.filter((r) => r.creneau_id === c.id);
                return (
                  <div key={c.id} className="flex flex-col gap-1.5">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {heureLabel(c.heure_debut)}–{heureLabel(c.heure_fin)} ({assigned.length}/{c.capacite})
                    </h3>
                    {assigned.length === 0 ? (
                      <p className="pl-3 text-xs text-gray-400">—</p>
                    ) : isTrombi ? (
                      <div className="flex flex-wrap gap-x-3 gap-y-2 pl-1">
                        {assigned.map((r) => (
                          <TrombiCard key={r.id} r={r} />
                        ))}
                      </div>
                    ) : (
                      <table className="w-full text-sm">
                        <tbody>
                          {assigned.map((r) => (
                            <tr key={r.id} className="border-b border-gray-100">
                              <td className="w-10 py-1">
                                <div className="relative h-8 w-8 overflow-hidden rounded-full bg-gray-100">
                                  {portraitUrl(r.figurant_id) && (
                                    <Image src={portraitUrl(r.figurant_id)!} alt="" fill className="object-cover" />
                                  )}
                                </div>
                              </td>
                              <td className="py-1 pr-3 font-medium text-gray-900">
                                {r.figurants ? `${r.figurants.prenom} ${r.figurants.nom}` : "—"}
                              </td>
                              <td className="py-1 pr-3 text-gray-600">{r.casting_roles?.nom ?? ""}</td>
                              <td className="py-1 pr-3 text-gray-600">{r.figurants?.telephone ?? ""}</td>
                              <td className="py-1 text-gray-600">{r.statut}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Aucun créneau calibré pour cette journée.</p>
          )}

          {sansCreneau.length > 0 && (
            <div className="flex flex-col gap-1.5 border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-900">Sans créneau ({sansCreneau.length})</h3>
              {isTrombi ? (
                <div className="flex flex-wrap gap-x-3 gap-y-2 pl-1">
                  {sansCreneau.map((r) => (
                    <TrombiCard key={r.id} r={r} />
                  ))}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {sansCreneau.map((r) => (
                      <tr key={r.id} className="border-b border-gray-100">
                        <td className="w-10 py-1">
                          <div className="relative h-8 w-8 overflow-hidden rounded-full bg-gray-100">
                            {portraitUrl(r.figurant_id) && (
                              <Image src={portraitUrl(r.figurant_id)!} alt="" fill className="object-cover" />
                            )}
                          </div>
                        </td>
                        <td className="py-1 pr-3 font-medium text-gray-900">
                          {r.figurants ? `${r.figurants.prenom} ${r.figurants.nom}` : "—"}
                        </td>
                        <td className="py-1 pr-3 text-gray-600">{r.casting_roles?.nom ?? ""}</td>
                        <td className="py-1 pr-3 text-gray-600">{r.figurants?.telephone ?? ""}</td>
                        <td className="py-1 text-gray-600">{r.statut}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </PrintSheet>
    </div>
  );
}
