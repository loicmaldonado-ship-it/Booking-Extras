"use client";

import { useActionState, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import { createCastingRole, updateCastingRoleCalibration } from "@/lib/casting/actions";
import { CATEGORIE_CACHET_LABELS, CASTING_MODE_LABELS, type CastingRole, type CategorieCachet } from "@/lib/casting/types";

const DEFAULT_LABELS = ["Portrait", "Pied", "Autre"];

export function CastingRoleForm({
  projetId,
  role,
  categorieParDefaut = "role",
  onDone,
}: {
  projetId: string;
  role?: CastingRole;
  // Catégorie proposée pour un nouveau casting (celle de l'onglet ouvert).
  categorieParDefaut?: CategorieCachet;
  onDone?: () => void;
}) {
  const action = role ? updateCastingRoleCalibration.bind(null, role.id) : createCastingRole.bind(null, projetId);
  const [state, formAction, pending] = useActionState(action, undefined);
  const [labels, setLabels] = useState<string[]>(role?.photo_labels ?? DEFAULT_LABELS);
  const [labelInput, setLabelInput] = useState("");
  const router = useRouter();
  const [pdfUploading, setPdfUploading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const pendingPdfRef = useRef<File | null>(null);
  const completedRoleRef = useRef<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (state?.error && !role) {
      Promise.resolve().then(() => setPdfUploading(false));
      return;
    }
    if (!state?.success || role) return;
    const roleId = state.roleId;
    if (!roleId || completedRoleRef.current === roleId) return;
    completedRoleRef.current = roleId;
    const pdf = pendingPdfRef.current;
    if (!pdf) {
      onDone?.();
      router.refresh();
      return;
    }
    const body = new FormData();
    body.set("pdf", pdf);
    fetch(`/casting/roles/${roleId}/pdf`, { method: "POST", body })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error ?? "Envoi du PDF impossible.");
        onDone?.();
      })
      .catch((error: unknown) => {
        setPdfError(
          `Le rôle a été créé, mais le PDF n'a pas été enregistré : ${error instanceof Error ? error.message : "erreur inconnue"}. ` +
          "Tu peux joindre le PDF depuis « Calibrer » sur le rôle créé ci-dessous."
        );
      })
      .finally(() => {
        pendingPdfRef.current = null;
        setPdfUploading(false);
        router.refresh();
      });
  }, [state, role, onDone, router]);

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    if (role) return;
    const data = new FormData(event.currentTarget);
    const pdf = data.get("pdf");
    // Always use the separate upload endpoint for create; never send the PDF
    // in the same multipart Server Action as the new role.
    event.preventDefault();
    setPdfError(null);
    const attachment = pdf instanceof File && pdf.size > 0 ? pdf : null;
    if (attachment && attachment.size > 20 * 1024 * 1024) {
      setPdfError("PDF trop volumineux (20 Mo maximum).");
      return;
    }
    pendingPdfRef.current = attachment;
    setPdfUploading(Boolean(attachment));
    data.delete("pdf");
    startTransition(() => formAction(data));
  }

  function addLabel() {
    const v = labelInput.trim();
    if (!v || labels.includes(v)) return;
    setLabels((prev) => [...prev, v]);
    setLabelInput("");
  }

  function removeLabel(l: string) {
    setLabels((prev) => prev.filter((x) => x !== l));
  }

  return (
    <form action={formAction} onSubmit={handleCreateSubmit} className="flex flex-col gap-3">
      {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      {pdfError && <p role="alert" className="text-sm text-danger">{pdfError}</p>}
      {state?.success && role && <p className="text-sm text-turquoise">Rôle mis à jour.</p>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Nom du rôle" required>
          <Input name="nom" required defaultValue={role?.nom} placeholder="Boulanger, Silhouettes marché..." />
        </Field>
        <Field label="Date de tournage (optionnel)">
          <Input type="date" name="date_tournage" defaultValue={role?.date_tournage ?? ""} />
        </Field>
        <Field label="Jusqu'au (optionnel, si période ou plusieurs dates)">
          <Input type="date" name="date_tournage_fin" defaultValue={role?.date_tournage_fin ?? ""} />
        </Field>
      </div>

      <Field label="Date limite d'envoi des selftapes (optionnel)">
        <Input type="date" name="date_limite_envoi" defaultValue={role?.date_limite_envoi ?? ""} />
      </Field>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Catégorie de cachet" required>
          <Select name="categorie_cachet" required defaultValue={role?.categorie_cachet ?? categorieParDefaut}>
            {Object.entries(CATEGORIE_CACHET_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Mode de casting" required>
          <Select name="mode" required defaultValue={role?.mode ?? "selftape"}>
            {Object.entries(CASTING_MODE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <p className="-mt-2 text-xs text-text-muted">
        Indicatif — l&apos;envoi du lien selftape et l&apos;ajout au planning présentiel restent tous les deux
        disponibles quel que soit le mode choisi (pratique si une personne prévue en présentiel ne peut pas se
        déplacer).
      </p>

      <Field label="Nombre de vidéos demandées">
        <Input type="number" name="nb_videos" min={0} defaultValue={role?.nb_videos ?? 1} className="w-24" />
      </Field>

      <Field label="Questions (oui / non) — une par ligne">
        <Textarea
          name="questions"
          rows={3}
          placeholder={"Parlez-vous anglais ?\nAvez-vous le permis de conduire ?"}
          defaultValue={(role?.questions ?? []).join("\n")}
        />
      </Field>
      <p className="-mt-2 text-xs text-text-muted">
        Posées sur la page d&apos;envoi des photos / vidéos (réponse oui / non, précision facultative). Les réponses
        sont visibles dans le rôle et sur le lien réal.
      </p>

      <Field label="Photos demandées (nom du matériau)">
        <div className="flex flex-col gap-2">
          {labels.map((l) => (
            <div key={l} className="flex items-center gap-2">
              <input type="hidden" name="photo_label" value={l} />
              <span className="flex-1 rounded-lg border border-border bg-ink px-3 py-1.5 text-sm">{l}</span>
              <button
                type="button"
                onClick={() => removeLabel(l)}
                className="text-xs text-text hover:text-danger"
              >
                Retirer
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              placeholder="Ex. Photo pied"
              className="flex-1 rounded-lg border border-border bg-ink px-3 py-1.5 text-sm outline-none focus:border-coral"
            />
            <Button type="button" variant="ghost" onClick={addLabel} disabled={!labelInput.trim()}>
              + Ajouter
            </Button>
          </div>
        </div>
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="demande_bande_demo" defaultChecked={role?.demande_bande_demo} className="accent-coral" />
        Demander un lien de bande démo
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="visible_partage"
          defaultChecked={role?.visible_partage ?? true}
          className="accent-coral"
        />
        Visible sur le lien de partage réal
      </label>

      <Field label="Document PDF du rôle (optionnel)">
        <p className="mb-1 text-xs text-text-muted">Extrait de texte ou consignes de casting. Tu pourras aussi l&apos;ajouter plus tard via « Calibrer ». 20 Mo maximum.</p>
        <div className="flex flex-col gap-1.5">
          {role?.pdf_filename && role.pdf_storage_path && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <a
                href={`/casting/roles/${role.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-coral underline underline-offset-2 hover:opacity-80"
              >
                Ouvrir le PDF « {role.pdf_filename} » (nouvel onglet)
              </a>
              <label className="flex items-center gap-2 text-text-muted">
                <input type="checkbox" name="remove_pdf" className="accent-coral" />
                Retirer le PDF
              </label>
            </div>
          )}
          <input
            type="file"
            name="pdf"
            accept="application/pdf"
            className="w-full rounded-lg border border-border bg-ink px-3 py-1.5 text-sm outline-none file:mr-3 file:rounded-full file:border-0 file:bg-ink-raised-2 file:px-3 file:py-1 file:text-xs file:font-medium"
          />
        </div>
      </Field>

      <Field label="Corps du mail d'invitation (optionnel)">
        <textarea
          name="message_corps"
          defaultValue={role?.message_corps ?? ""}
          rows={5}
          placeholder={
            "Vide = message généré automatiquement. Sinon, utilise {prenom}, {role}, {projet}, {date} " +
            "(devient « le 12 septembre 2026 » ou « entre le 12/09/2026 et le 15/09/2026 » si tu as mis une " +
            "date de fin — pense à retirer le « le » avant si tu l'as écrit toi-même) et " +
            "{lien} (obligatoire, c'est le lien d'envoi) — ex. « Bonjour {prenom}, le rôle {role} vous intéresse ? " +
            "Envoyez-nous ça via {lien} »"
          }
          className="w-full rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral"
        />
      </Field>

      <Button type="submit" disabled={pending || pdfUploading || !!(pdfError && state?.success)}>
        {pending || pdfUploading ? "Enregistrement..." : role ? "Enregistrer" : "Créer le rôle"}
      </Button>
    </form>
  );
}
