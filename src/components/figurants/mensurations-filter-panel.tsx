import { Input } from "@/components/ui/field";
import {
  MENSURATION_RANGE_FIELDS,
  MENSURATION_TEXT_FIELDS,
  hasActiveMensurationFilters,
  type MensurationFilters,
} from "@/lib/figurants/mensuration-filters";

// <details> reste un simple élément HTML : replié, son contenu ne
// s'affiche pas mais participe quand même à la soumission du <form> GET
// qui l'englobe — pas besoin de JS pour garder les filtres actifs visibles
// sans imposer la liste complète des mensurations à l'écran en permanence.
export function MensurationsFilterPanel({ defaultValues }: { defaultValues: MensurationFilters }) {
  return (
    <details
      className="col-span-2 rounded-xl border border-border p-3 md:col-span-4"
      open={hasActiveMensurationFilters(defaultValues)}
    >
      <summary className="cursor-pointer text-sm font-medium text-text-muted">
        Code postal &amp; mensurations
      </summary>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Input name="code_postal" placeholder="Code postal" defaultValue={defaultValues.code_postal ?? ""} />
        {MENSURATION_RANGE_FIELDS.map((f) => (
          <div key={f.key} className="col-span-2 flex gap-1.5 md:col-span-1">
            <Input
              type="number"
              name={`${f.key}_min`}
              placeholder={`${f.label} min`}
              defaultValue={defaultValues[`${f.key}_min`] ?? ""}
            />
            <Input
              type="number"
              name={`${f.key}_max`}
              placeholder={`${f.label} max`}
              defaultValue={defaultValues[`${f.key}_max`] ?? ""}
            />
          </div>
        ))}
        {MENSURATION_TEXT_FIELDS.map((f) => (
          <Input key={f.key} name={f.key} placeholder={f.label} defaultValue={defaultValues[f.key] ?? ""} />
        ))}
      </div>
    </details>
  );
}
