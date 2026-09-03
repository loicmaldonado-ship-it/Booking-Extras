import Image from "next/image";
import type { ListeArtistiqueItem } from "@/lib/casting/liste-artistique";
import type { CastingEntry } from "@/lib/casting/types";

export function comedienLines(entry: CastingEntry): string[] {
  const f = entry.figurants;
  if (!f) return ["—"];
  const lines = [`${f.prenom} ${f.nom}`];
  const contact = [f.telephone, f.email].filter(Boolean).join(" · ");
  if (contact) lines.push(contact);
  return lines;
}

export function agentLines(entry: CastingEntry): string[] {
  const f = entry.figurants;
  if (!f || (!f.agent_nom && !f.agent_agence && !f.agent_email && !f.agent_telephone)) return ["Sans agent"];
  const lines: string[] = [];
  const nomAgence = [f.agent_nom, f.agent_agence].filter(Boolean).join(" — ");
  if (nomAgence) lines.push(nomAgence);
  const contact = [f.agent_telephone, f.agent_email].filter(Boolean).join(" · ");
  if (contact) lines.push(contact);
  return lines.length > 0 ? lines : ["Sans agent"];
}

export function ListeArtistiqueSheet({
  items,
  portraitByFigurant,
}: {
  items: ListeArtistiqueItem[];
  portraitByFigurant: Map<string, string | null>;
}) {
  return (
    <table className="w-full table-fixed border-collapse text-xs">
      <colgroup>
        <col className="w-8" />
        <col className="w-14" />
        <col className="w-1/5" />
        <col className="w-[35%]" />
        <col className="w-[35%]" />
      </colgroup>
      <thead>
        <tr className="border-b-2 border-gray-400 text-left text-[11px] uppercase tracking-wide text-gray-600">
          <th className="py-1.5 pr-1">N°</th>
          <th className="py-1.5 pr-2"></th>
          <th className="py-1.5 pr-2">Rôle</th>
          <th className="py-1.5 pr-2">Comédien·ne</th>
          <th className="py-1.5">Agent</th>
        </tr>
      </thead>
      <tbody>
        {items.map(({ numero, role, entry }) => {
          const portraitUrl = portraitByFigurant.get(entry.figurant_id) ?? null;
          return (
            <tr key={role.id} className="border-b border-gray-300 bg-emerald-100 align-top">
              <td className="py-2 pr-1 font-semibold">{numero}</td>
              <td className="py-1.5 pr-2">
                <div className="relative h-10 w-10 overflow-hidden rounded bg-gray-200">
                  {portraitUrl && <Image src={portraitUrl} alt="" fill className="object-cover" />}
                </div>
              </td>
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
          );
        })}
      </tbody>
    </table>
  );
}
