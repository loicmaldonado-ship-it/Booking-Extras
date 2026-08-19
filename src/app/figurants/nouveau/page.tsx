import { FigurantForm } from "@/components/figurants/figurant-form";
import { BackLink } from "@/components/ui/back-link";
import { createFigurant } from "@/lib/figurants/actions";

export default function NouveauFigurantPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <BackLink href="/figurants" label="Base Profils" />

      <div>
        <h1 className="text-3xl font-semibold">Nouveau figurant</h1>
        <p className="mt-1 text-text-muted">
          Crée un profil réutilisable pour tous les projets.
        </p>
      </div>
      <FigurantForm action={createFigurant} />
    </div>
  );
}
