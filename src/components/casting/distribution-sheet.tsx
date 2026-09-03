import Image from "next/image";
import type { ListeArtistiqueItem } from "@/lib/casting/liste-artistique";
import { computeAge } from "@/lib/documents/fields";

// Une carte par rôle validé — inspiré d'une liste de distribution vue par
// Loïc dans un autre outil (Filmmakers/pretage.io) : photo plus visible que
// dans la liste artistique (tableau compact), avec le contact direct du
// comédien·ne toujours affiché, et l'agent en plus quand il y en a un.
export function DistributionSheet({
  items,
  portraitByFigurant,
}: {
  items: ListeArtistiqueItem[];
  portraitByFigurant: Map<string, string | null>;
}) {
  return (
    <div className="flex flex-col gap-4">
      {items.map(({ role, entry }) => {
        const f = entry.figurants;
        const portraitUrl = portraitByFigurant.get(entry.figurant_id) ?? null;
        const age = computeAge(f?.date_naissance ?? null);
        const genre = f?.genre ?? null;
        const hasAgent = f?.agent_nom || f?.agent_agence || f?.agent_email || f?.agent_telephone;

        return (
          <div key={role.id} className="flex gap-4 border-b border-gray-300 pb-4 last:border-b-0">
            <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-lg bg-gray-100">
              {portraitUrl && <Image src={portraitUrl} alt="" fill className="object-cover" />}
            </div>

            <div className="flex flex-1 flex-col gap-1.5 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {role.nom}
                  {(genre || age !== null) && (
                    <span className="normal-case text-gray-400">
                      {" "}
                      ({[genre, age !== null ? `${age} ans` : null].filter(Boolean).join(" / ")})
                    </span>
                  )}
                </p>
                <p className="text-lg font-bold text-gray-900">
                  {f?.prenom} {f?.nom}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Contact perso</p>
                  {f?.telephone && <p className="text-gray-700">{f.telephone}</p>}
                  {f?.email && <p className="text-gray-700">{f.email}</p>}
                  {!f?.telephone && !f?.email && <p className="text-gray-400">—</p>}
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Agent</p>
                  {hasAgent ? (
                    <>
                      {(f?.agent_nom || f?.agent_agence) && (
                        <p className="font-medium text-gray-900">
                          {[f?.agent_nom, f?.agent_agence].filter(Boolean).join(" — ")}
                        </p>
                      )}
                      {f?.agent_telephone && <p className="text-gray-700">{f.agent_telephone}</p>}
                      {f?.agent_email && <p className="text-gray-700">{f.agent_email}</p>}
                    </>
                  ) : (
                    <p className="text-gray-400">Sans agent</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
