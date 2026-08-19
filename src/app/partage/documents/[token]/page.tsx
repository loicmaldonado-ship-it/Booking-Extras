import Link from "next/link";
import { Card, Badge } from "@/components/ui/card";
import { resolveDocumentsShareToken } from "@/lib/partage/data";
import { getJournees } from "@/lib/bookings/journees";
import { formatDateShort } from "@/lib/format-date";
import { projetNomPublic } from "@/lib/projets/types";

export const dynamic = "force-dynamic";

export default async function PartageDocumentsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const share = await resolveDocumentsShareToken(token);

  if (!share) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Lien introuvable</h1>
        <p className="text-text-muted">Ce lien de partage n&apos;est plus valide.</p>
      </div>
    );
  }

  const { projet, dateLock } = share;
  const journees = dateLock ? [] : await getJournees(projet.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="font-display text-lg font-semibold">
          Booking<span className="text-coral">Extras</span>
        </span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">{projetNomPublic(projet)}</h1>
        <p className="mt-1 text-text-muted">
          {dateLock
            ? `Trombis et fiches mensuration du ${formatDateShort(dateLock)} — lecture seule.`
            : "Trombis et fiches mensuration par journée — lecture seule."}
        </p>
      </div>

      {dateLock && (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-medium">{formatDateShort(dateLock)}</p>
          <div className="flex gap-3">
            <Link
              href={`/partage/documents/${token}/trombis?date=${dateLock}`}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-coral/60 hover:text-text"
            >
              Trombis
            </Link>
            <Link
              href={`/partage/documents/${token}/fiches?date=${dateLock}`}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-coral/60 hover:text-text"
            >
              Fiches mensuration
            </Link>
          </div>
        </Card>
      )}

      {!dateLock && (
        <div className="flex flex-col gap-3">
          {journees.map((j) => (
            <Card key={j.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{formatDateShort(j.date)}</p>
                <div className="mt-1 flex gap-2">
                  <Badge tone="turquoise">{j.confirmes} confirmé{j.confirmes > 1 ? "s" : ""}</Badge>
                  <Badge>{j.total} au total</Badge>
                </div>
              </div>
              <div className="flex gap-3">
                <Link
                  href={`/partage/documents/${token}/trombis?date=${j.date}`}
                  className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-coral/60 hover:text-text"
                >
                  Trombis
                </Link>
                <Link
                  href={`/partage/documents/${token}/fiches?date=${j.date}`}
                  className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-coral/60 hover:text-text"
                >
                  Fiches mensuration
                </Link>
              </div>
            </Card>
          ))}
          {journees.length === 0 && (
            <p className="text-sm text-text-muted">Aucune journée pour l&apos;instant.</p>
          )}
        </div>
      )}
    </div>
  );
}
