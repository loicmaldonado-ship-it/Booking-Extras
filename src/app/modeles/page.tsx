import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { TemplateForm } from "@/components/templates/template-form";
import { TemplatesList } from "@/components/templates/templates-list";
import type { MessageTemplate } from "@/lib/templates/types";
import { Mail } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ModelesPage() {
  const supabase = createAdminClient();
  const { data: templates } = await supabase
    .from("message_templates")
    .select("*")
    .order("nom")
    .returns<MessageTemplate[]>();

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

      <TemplatesList templates={templates ?? []} />
    </div>
  );
}
