export function DocumentLetterhead({
  societe,
  filmNom,
  dateLabel,
  realisateur,
}: {
  societe: string | null;
  filmNom: string;
  dateLabel: string;
  realisateur?: string | null;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="text-xs font-semibold uppercase text-gray-700">{societe}</div>
      <div className="text-center">
        <h2 className="text-lg font-bold uppercase">{filmNom}</h2>
        <p className="text-sm text-gray-600">{dateLabel}</p>
      </div>
      <div className="text-right text-xs text-gray-700">
        <div className="font-semibold uppercase">{filmNom}</div>
        {realisateur && <div>Réal. : {realisateur}</div>}
      </div>
    </div>
  );
}
