import Image from "next/image";
import type { CastingRole, CastingEntry } from "@/lib/casting/types";

export function FicheRoleValideSheet({
  role,
  entry,
  portraitUrl,
  hideContact,
}: {
  role: CastingRole;
  entry: CastingEntry;
  portraitUrl: string | null;
  // Masque téléphone/email (comédien·ne et agent) — pour le lien réal
  // quand le staff préfère que tout contact passe par lui plutôt que
  // directement par le·la réalisateur·ice.
  hideContact?: boolean;
}) {
  const f = entry.figurants;
  const adresse = [f?.adresse, [f?.code_postal, f?.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const hasAgent = f?.agent_nom || f?.agent_agence || f?.agent_email || f?.agent_telephone;

  return (
    <div className="flex h-full flex-col gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Rôle</p>
        <h2 className="text-2xl font-bold uppercase text-gray-900">{role.nom}</h2>
      </div>

      <div className="relative w-full flex-1 overflow-hidden rounded-lg bg-gray-100">
        {portraitUrl && <Image src={portraitUrl} alt="" fill className="object-contain" />}
      </div>

      <div className="grid grid-cols-2 gap-6 text-sm">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Comédien·ne</p>
          <p className="text-lg font-semibold text-gray-900">
            {f?.prenom} {f?.nom}
          </p>
          {!hideContact && (
            <>
              {f?.telephone && <p className="text-gray-700">{f.telephone}</p>}
              {f?.email && <p className="text-gray-700">{f.email}</p>}
              {adresse && <p className="text-gray-700">{adresse}</p>}
            </>
          )}
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Agent</p>
          {hasAgent ? (
            <>
              {(f?.agent_nom || f?.agent_agence) && (
                <p className="text-lg font-semibold text-gray-900">
                  {[f?.agent_nom, f?.agent_agence].filter(Boolean).join(" — ")}
                </p>
              )}
              {!hideContact && (
                <>
                  {f?.agent_telephone && <p className="text-gray-700">{f.agent_telephone}</p>}
                  {f?.agent_email && <p className="text-gray-700">{f.agent_email}</p>}
                </>
              )}
            </>
          ) : (
            <p className="text-gray-500">Sans agent</p>
          )}
        </div>
      </div>
    </div>
  );
}
