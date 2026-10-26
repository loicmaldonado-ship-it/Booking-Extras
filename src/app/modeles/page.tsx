import { getModelesEquipe } from "@/lib/templates/equipe";
import { Card } from "@/components/ui/card";
import { TemplateForm } from "@/components/templates/template-form";
import { TemplatesList, ModelesDeBaseList } from "@/components/templates/templates-list";
import { Mail } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ModelesPage() {
  const templates = await getModelesEquipe();
  const mesModeles = templates.filter((t) => t.equipe_id);
  const modelesDeBase = templates.filter((t) => !t.equipe_id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold"><Mail size={28} strokeWidth={1.75} />Modèles de messages</h1>
        <p className="mt-1 text-text-muted">
          Prépare des messages type (relance, annulation, infos pratiques...) à envoyer en un clic depuis
          l&apos;onglet Message d&apos;une journée. Utilise <code className="text-coral">{"{prenom}"}</code> dans le
          sujet ou le corps pour qu&apos;il soit remplacé par le vrai prénom à l&apos;envoi.
        </p>
      </div>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">Nouveau modèle</h2>
        <TemplateForm />
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Mes modèles</h2>
        <TemplatesList templates={mesModeles} />
      </div>

      {modelesDeBase.length > 0 && (
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-lg font-semibold">⭐ Prêts à l&apos;emploi</h2>
            <p className="text-sm text-text-muted">
              Communs à toutes les équipes et disponibles partout où tu envoies un message. Copie-les dans tes
              modèles pour ajouter ta signature, tes horaires ou tes infos pratiques. Les passages entre [crochets]
              sont à compléter.
            </p>
          </div>
          <ModelesDeBaseList templates={modelesDeBase} />
        </div>
      )}
    </div>
  );
}
