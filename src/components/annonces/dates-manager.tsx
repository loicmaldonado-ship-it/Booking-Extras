"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { addAnnonceDate, removeAnnonceDate, ajouterPeriodeAnnonce, setDisposParCalendrier } from "@/lib/annonces/dates";
import type { AnnonceDate } from "@/lib/annonces/dates";
import { formatDateShort } from "@/lib/format-date";

export function DatesManager({
  annonceId,
  dates,
  disposParCalendrier,
}: {
  annonceId: string;
  dates: AnnonceDate[];
  disposParCalendrier: boolean;
}) {
  const router = useRouter();
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [periodeMessage, setPeriodeMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [periodePending, demarrer] = useTransition();

  function ajouterPeriode() {
    setPeriodeMessage(null);
    demarrer(async () => {
      const res = await ajouterPeriodeAnnonce(annonceId, debut, fin);
      if (res.error) {
        setPeriodeMessage({ ok: false, texte: res.error });
        return;
      }
      setPeriodeMessage({
        ok: true,
        texte: `${res.ajoutes} jour${(res.ajoutes ?? 0) > 1 ? "s" : ""} ajouté${(res.ajoutes ?? 0) > 1 ? "s" : ""}. Retire avec × les jours sans tournage.`,
      });
      setDebut("");
      setFin("");
      router.refresh();
    });
  }

  function basculerCalendrier(actif: boolean) {
    demarrer(async () => {
      await setDisposParCalendrier(annonceId, actif);
      router.refresh();
    });
  }
  const [state, formAction, pending] = useActionState(addAnnonceDate.bind(null, annonceId), undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [hasDate, setHasDate] = useState(false);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  function remove(id: string) {
    removeAnnonceDate(id, annonceId).then(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-3">
      {dates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {dates.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-2 rounded-full border border-border bg-ink px-3 py-1.5 text-sm"
            >
              <span>{formatDateShort(d.date)}</span>
              <button
                type="button"
                onClick={() => remove(d.id)}
                className="text-text-muted hover:text-coral"
                title="Supprimer cette date"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-ink p-3">
        <span className="w-full text-sm font-medium">Période de tournage</span>
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          Du
          <input
            type="date"
            value={debut}
            onChange={(e) => setDebut(e.target.value)}
            disabled={periodePending}
            className="rounded-lg border border-border bg-ink px-3 py-2 text-sm text-text outline-none focus:border-coral disabled:opacity-60"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-text-muted">
          Au
          <input
            type="date"
            value={fin}
            min={debut || undefined}
            onChange={(e) => setFin(e.target.value)}
            disabled={periodePending}
            className="rounded-lg border border-border bg-ink px-3 py-2 text-sm text-text outline-none focus:border-coral disabled:opacity-60"
          />
        </label>
        <Button type="button" variant="secondary" disabled={periodePending || !debut || !fin} onClick={ajouterPeriode}>
          {periodePending ? "Ajout..." : "Ajouter la période"}
        </Button>
        {periodeMessage && (
          <p className={periodeMessage.ok ? "w-full text-sm text-turquoise" : "w-full text-sm text-danger"}>
            {periodeMessage.texte}
          </p>
        )}
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={disposParCalendrier}
          onChange={(e) => basculerCalendrier(e.target.checked)}
          disabled={periodePending}
          className="mt-0.5 accent-coral"
        />
        <span>
          Les candidat·es cochent seulement leurs <strong>indispos</strong> sur un calendrier
          <span className="block text-xs text-text-muted">
            Pratique pour une période : sinon, ils répondent « dispo / pas dispo » à chaque date.
          </span>
        </span>
      </label>

      <form
        ref={formRef}
        action={formAction}
        onReset={() => setHasDate(false)}
        className="flex gap-3"
      >
        <input
          type="date"
          name="date"
          onChange={(e) => setHasDate(!!e.target.value)}
          disabled={pending}
          className="rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral disabled:opacity-60"
        />
        <Button type="submit" variant="secondary" disabled={pending || !hasDate}>
          {pending ? "Ajout..." : "Ajouter"}
        </Button>
      </form>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
    </div>
  );
}
