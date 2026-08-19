"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { addAnnonceQuestion, removeAnnonceQuestion } from "@/lib/annonces/questions";
import type { AnnonceQuestion, QuestionTemplate } from "@/lib/annonces/questions";

export function QuestionsManager({
  annonceId,
  questions,
  templates,
}: {
  annonceId: string;
  questions: AnnonceQuestion[];
  templates: QuestionTemplate[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(addAnnonceQuestion.bind(null, annonceId), undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [hasLabel, setHasLabel] = useState(false);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  const usedLabels = new Set(questions.map((q) => q.label));
  const availableTemplates = templates.filter((t) => !usedLabels.has(t.label));

  function quickAdd(templateLabel: string) {
    if (inputRef.current) {
      inputRef.current.value = templateLabel;
      inputRef.current.focus();
    }
    setHasLabel(true);
  }

  function removeQuestion(id: string) {
    removeAnnonceQuestion(id, annonceId).then(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-3">
      {questions.length > 0 && (
        <div className="flex flex-col gap-2">
          {questions.map((q) => (
            <div
              key={q.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-ink px-3 py-2 text-sm"
            >
              <span>{q.label}</span>
              <button
                type="button"
                onClick={() => removeQuestion(q.id)}
                className="text-text-muted hover:text-coral"
                title="Supprimer cette question"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {availableTemplates.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-text-muted">Modèles :</span>
          {availableTemplates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => quickAdd(t.label)}
              className="rounded-full border border-border px-3 py-1 text-xs font-medium text-text-muted hover:border-coral/60 hover:text-text"
            >
              + {t.label}
            </button>
          ))}
        </div>
      )}

      <form
        ref={formRef}
        action={formAction}
        onReset={() => setHasLabel(false)}
        className="flex gap-3"
      >
        <input
          ref={inputRef}
          name="label"
          onInput={(e) => setHasLabel(e.currentTarget.value.trim().length > 0)}
          placeholder="Ex. Possédez-vous un vélo ?"
          disabled={pending}
          className="flex-1 rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral disabled:opacity-60"
        />
        <Button type="submit" variant="secondary" disabled={pending || !hasLabel}>
          {pending ? "Ajout..." : "Ajouter"}
        </Button>
      </form>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
    </div>
  );
}
