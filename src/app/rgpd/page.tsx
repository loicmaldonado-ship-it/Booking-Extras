import { nomComplet } from "@/lib/noms";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { getFigurantsInactifs } from "@/lib/rgpd/data";
import { formatDateShort } from "@/lib/format-date";
import { AnonymiserButton } from "@/components/rgpd/anonymiser-button";
import { ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

const SEUILS = [1, 2, 3, 5, 10];

export default async function RgpdPage({
  searchParams,
}: {
  searchParams: Promise<{ seuil?: string }>;
}) {
  const { seuil } = await searchParams;
  const seuilAns = Number(seuil) > 0 ? Number(seuil) : 3;
  const figurants = await getFigurantsInactifs(seuilAns);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold"><ShieldCheck size={28} strokeWidth={1.75} />RGPD — Rétention des profils</h1>
        <p className="mt-1 text-text-muted">
          Aucune suppression n&apos;est automatique. Cette page liste les profils sans activité récente
          (booking, candidature, mise à jour) et permet d&apos;anonymiser manuellement ceux qui n&apos;ont plus
          vocation à être conservés.
        </p>
      </div>

      <Card>
        <form className="flex flex-wrap items-center gap-3" method="get">
          <span className="text-sm text-text-muted">Inactifs depuis plus de :</span>
          <Select name="seuil" defaultValue={String(seuilAns)} className="w-40">
            {SEUILS.map((s) => (
              <option key={s} value={s}>
                {s} an{s > 1 ? "s" : ""}
              </option>
            ))}
          </Select>
          <button
            type="submit"
            className="rounded-full bg-ink-raised-2 px-5 py-2 text-sm font-medium hover:border hover:border-coral/60"
          >
            Filtrer
          </button>
        </form>
      </Card>

      <section className="grid gap-3 md:hidden" aria-label="Profils inactifs">
        {figurants.map((f) => (
          <Card key={f.id} className="flex flex-col gap-3">
            <h2 className="break-words font-semibold">{f.prenom} {f.nom}</h2>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
              <dt className="text-text-muted">Email</dt>
              <dd className="min-w-0 break-all">{f.email ?? "—"}</dd>
              <dt className="text-text-muted">Dernière activité</dt>
              <dd>{f.derniereActivite ? formatDateShort(f.derniereActivite) : "—"}</dd>
            </dl>
            <div className="flex flex-wrap items-center gap-2">
              <AnonymiserButton figurantId={f.id} nom={f.prenom + " " + f.nom} />
            </div>
          </Card>
        ))}
        {figurants.length === 0 && (
          <Card className="py-8 text-center text-sm text-text-muted">
            Aucun profil inactif depuis plus de {seuilAns} an{seuilAns > 1 ? "s" : ""}.
          </Card>
        )}
      </section>

      <Card className="hidden overflow-x-auto p-0 md:block">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-text-muted">
              <th className="px-6 py-3 font-medium">Profil</th>
              <th className="px-6 py-3 font-medium">Email</th>
              <th className="px-6 py-3 font-medium">Dernière activité</th>
              <th className="px-6 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {figurants.map((f) => (
              <tr key={f.id} className="border-b border-border last:border-0">
                <td className="px-6 py-3 font-medium">
                  {nomComplet(f)}
                </td>
                <td className="px-6 py-3 text-text-muted">{f.email ?? "—"}</td>
                <td className="px-6 py-3 text-text-muted">
                  {f.derniereActivite ? formatDateShort(f.derniereActivite) : "—"}
                </td>
                <td className="px-6 py-3">
                  <AnonymiserButton figurantId={f.id} nom={nomComplet(f)} />
                </td>
              </tr>
            ))}
            {figurants.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-text-muted">
                  Aucun profil inactif depuis plus de {seuilAns} an{seuilAns > 1 ? "s" : ""}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
