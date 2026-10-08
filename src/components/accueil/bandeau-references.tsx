import Image from "next/image";
import { referenceTypeLabel, type Reference } from "@/lib/references/types";

function Affiche({ reference }: { reference: Reference }) {
  return (
    <figure className="flex w-36 shrink-0 flex-col gap-2 sm:w-40">
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-border bg-ink-raised-2 shadow-sm">
        {reference.afficheUrl ? (
          <Image src={reference.afficheUrl} alt={`Affiche de ${reference.titre}`} fill sizes="160px" className="object-cover" />
        ) : (
          // Sans affiche : le titre en grand, pour garder le rythme du bandeau.
          <div className="flex h-full items-center justify-center p-3 text-center text-base font-semibold leading-tight [text-wrap:balance]">
            {reference.titre}
          </div>
        )}
      </div>
      <figcaption className="flex flex-col">
        <span className="truncate text-sm font-medium">{reference.titre}</span>
        <span className="truncate text-xs text-text-muted">
          {[referenceTypeLabel(reference.type), reference.annee].filter(Boolean).join(" · ")}
        </span>
      </figcaption>
    </figure>
  );
}

// Films et séries de l'équipe (Admin → Références). Défile en boucle dès
// qu'il y a de quoi remplir la largeur ; sinon simple rangée.
export function BandeauReferences({ references }: { references: Reference[] }) {
  if (references.length === 0) return null;
  const defile = references.length >= 5;

  return (
    <section className="flex flex-col gap-4" aria-labelledby="titre-references">
      <h2 id="titre-references" className="text-lg font-semibold">
        Ils nous ont fait confiance
      </h2>
      {defile ? (
        <div className="-mx-6 overflow-x-auto px-6 [mask-image:linear-gradient(to_right,transparent,black_4%,black_96%,transparent)]">
          <div
            className="defilement-references flex w-max gap-5"
            style={{ ["--duree-defilement" as string]: `${references.length * 5}s` }}
          >
            {[...references, ...references].map((r, i) => (
              <div key={`${r.id}-${i}`} aria-hidden={i >= references.length || undefined}>
                <Affiche reference={r} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex gap-5 overflow-x-auto">
          {references.map((r) => (
            <Affiche key={r.id} reference={r} />
          ))}
        </div>
      )}
    </section>
  );
}
