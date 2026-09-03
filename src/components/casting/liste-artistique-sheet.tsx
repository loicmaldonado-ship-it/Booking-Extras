import type { CastingRole, CastingEntry } from "@/lib/casting/types";

export type ListeArtistiqueItem = {
  numero: number;
  role: CastingRole;
  entry: CastingEntry | null;
};

// Statut du rôle simplifié à 3 couleurs (vert/jaune/gris) — le modèle fourni
// distingue 6 cas (validé, en attente, call-back, à contacter directement,
// stand-by, figuration) mais seuls "validé" et "annulé" existent réellement
// dans nos données ; le reste (en cours, pas encore de candidat) tombe en
// jaune ou gris plutôt que d'inventer des statuts qu'on ne peut pas tenir à
// jour de façon fiable.
function rowTone(entry: CastingEntry | null): "vert" | "jaune" | "gris" {
  if (!entry) return "gris";
  if (entry.statut === "valide" || entry.statut === "confirmé") return "vert";
  if (entry.statut === "annulé" || entry.statut === "indisponible") return "gris";
  return "jaune";
}

const TONE_CLASSES: Record<"vert" | "jaune" | "gris", string> = {
  vert: "bg-emerald-100",
  jaune: "bg-amber-100",
  gris: "bg-gray-100",
};

function comedienLines(entry: CastingEntry | null): string[] {
  const f = entry?.figurants;
  if (!f) return ["—"];
  const lines = [`${f.prenom} ${f.nom}`];
  const adresse = [f.telephone, f.email].filter(Boolean).join(" · ");
  if (adresse) lines.push(adresse);
  return lines;
}

function agentLines(entry: CastingEntry | null): string[] {
  const f = entry?.figurants;
  if (!f || (!f.agent_nom && !f.agent_agence && !f.agent_email && !f.agent_telephone)) return ["Sans agent"];
  const lines: string[] = [];
  const nomAgence = [f.agent_nom, f.agent_agence].filter(Boolean).join(" — ");
  if (nomAgence) lines.push(nomAgence);
  const contact = [f.agent_telephone, f.agent_email].filter(Boolean).join(" · ");
  if (contact) lines.push(contact);
  return lines.length > 0 ? lines : ["Sans agent"];
}

export function ListeArtistiqueSheet({ items }: { items: ListeArtistiqueItem[] }) {
  return (
    <table className="w-full table-fixed border-collapse text-xs">
      <colgroup>
        <col className="w-10" />
        <col className="w-1/5" />
        <col className="w-2/5" />
        <col className="w-2/5" />
      </colgroup>
      <thead>
        <tr className="border-b-2 border-gray-400 text-left text-[11px] uppercase tracking-wide text-gray-600">
          <th className="py-1.5 pr-2">N°</th>
          <th className="py-1.5 pr-2">Rôle</th>
          <th className="py-1.5 pr-2">Comédien·ne</th>
          <th className="py-1.5">Agent</th>
        </tr>
      </thead>
      <tbody>
        {items.map(({ numero, role, entry }) => (
          <tr key={role.id} className={`border-b border-gray-300 align-top ${TONE_CLASSES[rowTone(entry)]}`}>
            <td className="py-2 pr-2 font-semibold">{numero}</td>
            <td className="py-2 pr-2 font-semibold uppercase">{role.nom}</td>
            <td className="py-2 pr-2">
              {comedienLines(entry).map((line, i) => (
                <div key={i} className={i === 0 ? "font-medium" : "text-gray-600"}>
                  {line}
                </div>
              ))}
            </td>
            <td className="py-2">
              {agentLines(entry).map((line, i) => (
                <div key={i} className={i === 0 ? "font-medium" : "text-gray-600"}>
                  {line}
                </div>
              ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
