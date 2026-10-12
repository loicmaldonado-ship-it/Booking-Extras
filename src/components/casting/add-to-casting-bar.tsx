"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { addFigurantsToCastingRole, listCastingRolesForProjet } from "@/lib/casting/actions";
import { CATEGORIE_CACHET_LABELS, type CategorieCachet } from "@/lib/casting/types";

type RoleOption = { id: string; nom: string; categorie_cachet: CategorieCachet };
type RolesLoad = { projetId: string; roles: RoleOption[]; error?: string };

export function AddToCastingBar({
  figurantIds,
  projets,
  onDone,
}: {
  figurantIds: string[];
  projets: { id: string; nom: string }[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const [projetId, setProjetId] = useState(projets[0]?.id ?? "");
  // Conserve l'identifiant du projet associé au dernier chargement pour
  // éviter d'afficher les rôles d'un autre projet pendant une requête.
  const [rolesData, setRolesData] = useState<RolesLoad | null>(null);
  const [roleId, setRoleId] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: number; deja: number; echecs: number } | string | null>(null);
  const roles = rolesData?.projetId === projetId ? rolesData.roles : [];
  const rolesLoading = Boolean(projetId) && rolesData?.projetId !== projetId;
  const rolesError = rolesData?.projetId === projetId ? rolesData.error : null;

  useEffect(() => {
    if (!projetId) return;
    let active = true;
    listCastingRolesForProjet(projetId)
      .then((res) => {
        if (active) setRolesData({ projetId, roles: res.roles ?? [] });
      })
      .catch(() => {
        if (active) setRolesData({ projetId, roles: [], error: "Impossible de charger les rôles." });
      });
    // Ignore les réponses qui arrivent après un changement de projet.
    return () => { active = false; };
  }, [projetId]);

  function submit() {
    if (!roleId || figurantIds.length === 0) return;
    setResult(null);
    startTransition(async () => {
      const res = await addFigurantsToCastingRole(figurantIds, roleId);
      if (res.error) {
        setResult(res.error);
        return;
      }
      setResult({ ok: res.ok ?? 0, deja: res.deja ?? 0, echecs: res.echecs ?? 0 });
      router.refresh();
      onDone?.();
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-turquoise/40 bg-turquoise/10 px-4 py-3">
      <span className="text-sm font-medium">
        {figurantIds.length} sélectionné·e{figurantIds.length > 1 ? "s" : ""}
      </span>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-text-muted">Projet</label>
        <select
          value={projetId}
          onChange={(e) => {
            setProjetId(e.target.value);
            setRoleId("");
            setResult(null);
          }}
          disabled={pending}
          className="rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral disabled:opacity-60"
        >
          <option value="" disabled>
            Choisir un projet
          </option>
          {projets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nom}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-text-muted">Rôle</label>
        <select
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          disabled={pending || rolesLoading || roles.length === 0}
          className="w-48 rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral disabled:opacity-60"
        >
          <option value="" disabled>
            {rolesLoading ? "Chargement..." : rolesError ? "Chargement impossible" : roles.length === 0 ? "Aucun rôle sur ce projet" : "Choisir un rôle"}
          </option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nom} ({CATEGORIE_CACHET_LABELS[r.categorie_cachet]})
            </option>
          ))}
        </select>
      </div>
      <Button type="button" disabled={pending || rolesLoading || !roleId} onClick={submit}>
        {pending ? "Envoi..." : "Ajouter au casting"}
      </Button>
      {!rolesLoading && projetId && roles.length === 0 && !rolesError && (
        <span className="text-xs text-text-muted">
          Crée d&apos;abord un rôle depuis la page Casting de ce projet.
        </span>
      )}
      {rolesError && <span className="text-xs text-danger">{rolesError}</span>}
      {result && typeof result === "string" && <span className="text-xs text-danger">{result}</span>}
      {result && typeof result === "object" && (
        <span className="text-xs text-text-muted">
          {result.ok} ajouté{result.ok > 1 ? "s" : ""}
          {result.deja > 0 ? ` · ${result.deja} déjà dans ce rôle` : ""}
          {result.echecs > 0 ? ` · ${result.echecs} échec(s) (email manquant ?)` : ""}
        </span>
      )}
    </div>
  );
}
