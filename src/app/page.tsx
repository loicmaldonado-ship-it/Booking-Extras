import { Card, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LayoutDashboard } from "lucide-react";

export default function Home() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold text-text"><LayoutDashboard size={28} strokeWidth={1.75} />Tableau de bord</h1>
        <p className="mt-2 text-text-muted">
          Bienvenue sur Booking Extras. On construit l&apos;application section par
          section — la prochaine étape est la gestion des figurants.
        </p>
      </div>

      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Badge tone="coral">Étape 1</Badge>
          <h2 className="text-lg font-semibold">Base du projet</h2>
        </div>
        <p className="text-sm text-text-muted">
          Next.js, Tailwind et la palette de marque sont en place. Prochaine
          étape : brancher Supabase en local et construire la fiche Figurant.
        </p>
        <div className="flex gap-3">
          <Badge tone="turquoise">Turquoise</Badge>
          <Badge tone="yellow">Jaune</Badge>
          <Badge tone="coral">Corail</Badge>
          <Badge>Neutre</Badge>
        </div>
        <div className="flex gap-3 pt-2">
          <Button variant="primary">Bouton principal</Button>
          <Button variant="secondary">Secondaire</Button>
          <Button variant="turquoise">Turquoise</Button>
        </div>
      </Card>
    </div>
  );
}
