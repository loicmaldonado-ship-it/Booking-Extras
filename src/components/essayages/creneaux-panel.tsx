"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Card, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Genre } from "@/lib/figurants/types";

type CreneauActionState = { error?: string; success?: boolean; count?: number } | undefined;
type CreneauAction = (prevState: CreneauActionState, formData: FormData) => Promise<CreneauActionState>;

export type Creneau = {
  id: string;
  heure_debut: string;
  heure_fin: string;
  capacite: number;
};

export type CreneauAssignment = { creneau_id: string | null; genre: Genre | null };

function heureLabel(h: string) {
  return h.slice(0, 5);
}

export function CreneauxPanel({
  creneaux,
  assignments,
  generateCreneaux,
  addCreneau,
  removeCreneau,
}: {
  creneaux: Creneau[];
  assignments: CreneauAssignment[];
  generateCreneaux: CreneauAction;
  addCreneau: CreneauAction;
  removeCreneau: (creneauId: string) => void | Promise<void>;
}) {
  const [mode, setMode] = useState<"none" | "generate" | "manual">("none");

  const [genState, genAction, genPending] = useActionState(generateCreneaux, undefined);
  const genFormRef = useRef<HTMLFormElement>(null);

  const [addState, addAction, addPending] = useActionState(addCreneau, undefined);
  const addFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (genState?.success) genFormRef.current?.reset();
  }, [genState]);

  useEffect(() => {
    if (addState?.success) addFormRef.current?.reset();
  }, [addState]);

  function countsFor(creneauId: string) {
    const list = assignments.filter((a) => a.creneau_id === creneauId);
    return {
      total: list.length,
      femmes: list.filter((a) => a.genre === "Femme").length,
      hommes: list.filter((a) => a.genre === "Homme").length,
      nb: list.filter((a) => a.genre === "Non-binaire").length,
    };
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-text-muted">Créneaux horaires</h2>
        {mode === "none" && (
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setMode("generate")}>
              Générer les créneaux de la journée
            </Button>
            <Button type="button" variant="ghost" onClick={() => setMode("manual")}>
              + Ajouter un créneau
            </Button>
          </div>
        )}
      </div>

      {creneaux.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {[...creneaux]
            .sort((a, b) => a.heure_debut.localeCompare(b.heure_debut))
            .map((c) => {
              const counts = countsFor(c.id);
              const complet = counts.total >= c.capacite;
              return (
                <div
                  key={c.id}
                  className="flex items-center gap-2 rounded-full border border-border bg-ink px-4 py-2 text-sm"
                >
                  <span className="font-medium">
                    {heureLabel(c.heure_debut)}–{heureLabel(c.heure_fin)}
                  </span>
                  <Badge tone={complet ? "turquoise" : "yellow"}>
                    {counts.total}/{c.capacite}
                  </Badge>
                  <span className="text-xs text-text-muted">
                    {counts.femmes}F · {counts.hommes}H · {counts.nb}NB
                  </span>
                  <form action={() => removeCreneau(c.id)}>
                    <button type="submit" className="text-text-muted hover:text-coral" title="Supprimer ce créneau">
                      ×
                    </button>
                  </form>
                </div>
              );
            })}
        </div>
      ) : (
        mode === "none" && <p className="text-sm text-text-muted">Aucun créneau pour cette journée.</p>
      )}

      {mode === "generate" && (
        <form ref={genFormRef} action={genAction} className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">Début de journée</label>
            <input
              name="heure_debut"
              type="time"
              defaultValue="09:00"
              required
              disabled={genPending}
              className="w-28 rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral disabled:opacity-60"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">Fin de journée</label>
            <input
              name="heure_fin"
              type="time"
              defaultValue="17:00"
              required
              disabled={genPending}
              className="w-28 rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral disabled:opacity-60"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">Durée par créneau (min)</label>
            <input
              name="duree_minutes"
              type="number"
              min={5}
              step={5}
              defaultValue={60}
              required
              disabled={genPending}
              className="w-24 rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral disabled:opacity-60"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">Personnes par créneau</label>
            <input
              name="capacite"
              type="number"
              min={1}
              defaultValue={3}
              required
              disabled={genPending}
              className="w-24 rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral disabled:opacity-60"
            />
          </div>
          <Button type="submit" disabled={genPending}>
            {genPending ? "Génération..." : "Générer"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setMode("none")}>
            Fermer
          </Button>
          {genState?.error && <p className="w-full text-sm text-danger">{genState.error}</p>}
          {genState?.success && (
            <p className="w-full text-sm text-turquoise">{genState.count} créneau(x) créé(s).</p>
          )}
        </form>
      )}

      {mode === "manual" && (
        <form ref={addFormRef} action={addAction} className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">Début</label>
            <input
              name="heure_debut"
              type="time"
              required
              disabled={addPending}
              className="w-28 rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral disabled:opacity-60"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">Fin</label>
            <input
              name="heure_fin"
              type="time"
              required
              disabled={addPending}
              className="w-28 rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral disabled:opacity-60"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">Capacité</label>
            <input
              name="capacite"
              type="number"
              min={1}
              defaultValue={3}
              required
              disabled={addPending}
              className="w-20 rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral disabled:opacity-60"
            />
          </div>
          <Button type="submit" disabled={addPending}>
            {addPending ? "Ajout..." : "Ajouter"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setMode("none")}>
            Fermer
          </Button>
          {addState?.error && <p className="w-full text-sm text-danger">{addState.error}</p>}
        </form>
      )}
    </Card>
  );
}
