import { DOCUMENT_FIELDS, type DocumentField } from "@/lib/documents/fields";
import { t, DEFAULT_LANG, type Lang, type DictKey } from "@/lib/i18n/partage";

const FIELD_DICT_KEY: Record<DocumentField, DictKey> = {
  fonction: "champ_fonction",
  telephone: "champ_telephone",
  email: "champ_email",
  age: "champ_age",
  ville: "champ_ville",
  sexe: "champ_genre",
};

export function FieldsToggle({
  projetId,
  date,
  selected,
  excludeFields,
  extraHidden,
  lang = DEFAULT_LANG,
}: {
  projetId: string;
  date: string;
  selected: Set<DocumentField>;
  excludeFields?: DocumentField[];
  extraHidden?: Record<string, string | string[] | undefined>;
  lang?: Lang;
}) {
  const visibleFields = excludeFields
    ? DOCUMENT_FIELDS.filter((f) => !excludeFields.includes(f.key))
    : DOCUMENT_FIELDS;
  return (
    <form
      method="get"
      className="print-hide flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-ink-raised px-4 py-3 text-sm"
    >
      <input type="hidden" name="projet_id" value={projetId} />
      <input type="hidden" name="date" value={date} />
      {lang !== DEFAULT_LANG && <input type="hidden" name="lang" value={lang} />}
      {Object.entries(extraHidden ?? {}).flatMap(([key, value]) => {
        if (value === undefined) return [];
        const values = Array.isArray(value) ? value : [value];
        return values.map((v, i) => <input key={`${key}-${i}`} type="hidden" name={key} value={v} />);
      })}
      <span className="text-text-muted">{t(lang, "champs_a_afficher")}</span>
      {visibleFields.map((f) => (
        <label key={f.key} className="flex items-center gap-1.5">
          <input
            type="checkbox"
            name="fields"
            value={f.key}
            defaultChecked={selected.has(f.key)}
            className="h-4 w-4 rounded border-border accent-coral"
          />
          {t(lang, FIELD_DICT_KEY[f.key])}
        </label>
      ))}
      <button
        type="submit"
        className="rounded-full bg-ink-raised-2 px-4 py-1.5 text-sm font-medium hover:border hover:border-coral/60"
      >
        {t(lang, "appliquer")}
      </button>
    </form>
  );
}
