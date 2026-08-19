import { Card } from "@/components/ui/card";

export default function OfflinePage() {
  return (
    <div className="flex max-w-md flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">Pas de connexion</h1>
        <p className="text-sm text-text-muted">
          Cette page n&apos;a pas encore été consultée avec une connexion
          active, donc elle n&apos;est pas disponible hors ligne pour
          l&apos;instant. Reconnecte-toi puis réessaie.
        </p>
      </Card>
    </div>
  );
}
