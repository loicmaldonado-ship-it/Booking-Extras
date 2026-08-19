import { ProjetForm } from "@/components/projets/projet-form";
import { BackLink } from "@/components/ui/back-link";
import { createProjet } from "@/lib/projets/actions";

export default function NouveauProjetPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <BackLink href="/projets" label="Projets" />

      <div>
        <h1 className="text-3xl font-semibold">Nouveau projet</h1>
        <p className="mt-1 text-text-muted">
          Crée un projet pour y rattacher des annonces et des bookings.
        </p>
      </div>
      <ProjetForm action={createProjet} />
    </div>
  );
}
