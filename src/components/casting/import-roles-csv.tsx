"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apercuImportRoles, importerRoles } from "@/lib/casting/import-actions";
import type { LigneImport } from "@/lib/casting/import-roles";
import { CATEGORIE_CACHET_LABELS } from "@/lib/casting/types";

const ETAT_LIBELLE: Record<LigneImport["etat"], string> = {
  ok: "Sera créé",
  doublon_fichier: "Doublon dans le fichier",
  doublon_projet: "Existe déjà",
  ignoree: "Ignoré",
};

// Un fichier Excel français enregistré en « CSV » peut être en Windows-1252
// plutôt qu'en UTF-8 : on essaie l'UTF-8 strict, sinon on relit autrement.
async function lireFichierTexte(file: File): Promise<string> {
  const octets = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(octets);
  } catch {
    return new TextDecoder("windows-1252").decode(octets);
  }
}

export function ImportRolesCsv({ projetId }: { projetId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState<string | null>(null);
  const [nomFichier, setNomFichier] = useState("");
  const [lignes, setLignes] = useState<LigneImport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultat, setResultat] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reinitialiser() {
    setCsv(null);
    setNomFichier("");
    setLignes(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function fermer() {
    reinitialiser();
    setResultat(null);
    setOpen(false);
  }

  async function choisirFichier(file: File | undefined) {
    setError(null);
    setResultat(null);
    setLignes(null);
    if (!file) return;
    const texte = await lireFichierTexte(file);
    setCsv(texte);
    setNomFichier(file.name);
    startTransition(async () => {
      const res = await apercuImportRoles(projetId, texte);
      if (res.error) setError(res.error);
      else setLignes(res.lignes);
    });
  }

  function creer() {
    if (!csv) return;
    startTransition(async () => {
      const res = await importerRoles(projetId, csv);
      if (res.error) {
        setError(res.error);
        return;
      }
      reinitialiser();
      setResultat(
        `${res.crees ?? 0} rôle${(res.crees ?? 0) > 1 ? "s" : ""} créé${(res.crees ?? 0) > 1 ? "s" : ""}` +
          ((res.ignorees ?? 0) > 0 ? `, ${res.ignorees} ligne${res.ignorees! > 1 ? "s" : ""} écartée${res.ignorees! > 1 ? "s" : ""}.` : ".")
      );
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Importer des rôles (CSV)
      </Button>
    );
  }

  const aCreer = lignes?.filter((l) => l.etat === "ok").length ?? 0;
  const ecartees = (lignes?.length ?? 0) - aCreer;

  return (
    <Card className="flex w-full flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Importer des rôles (CSV)</h2>
        <Button type="button" variant="ghost" onClick={fermer}>
          Fermer
        </Button>
      </div>
      <p className="text-sm text-text-muted">
        Une ligne du fichier = un rôle. Le nom du rôle est « Épisode · Rôle », la catégorie vient de la colonne
        « Catégorie » (Petit rôle et Voix : Rôle ; Silhouette parlante et Silhouette : Silhouette) et le message
        d&apos;invitation reprend « Profil » et « Texte d&apos;essai ». Rien n&apos;est créé avant ta confirmation.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => choisirFichier(e.target.files?.[0])}
        className="w-full rounded-lg border border-border bg-ink px-3 py-1.5 text-sm outline-none file:mr-3 file:rounded-full file:border-0 file:bg-ink-raised-2 file:px-3 file:py-1 file:text-xs file:font-medium"
      />

      {resultat && <p className="text-sm font-medium text-turquoise">{resultat}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      {pending && !lignes && <p className="text-sm text-text-muted">Lecture du fichier…</p>}

      {lignes && (
        <>
          <p className="text-sm">
            <strong>{nomFichier}</strong> : {aCreer} rôle{aCreer > 1 ? "s" : ""} à créer
            {ecartees > 0 && (
              <>
                , <span className="font-semibold text-danger">{ecartees} ligne{ecartees > 1 ? "s" : ""} écartée{ecartees > 1 ? "s" : ""}</span>{" "}
                (doublon ou ligne incomplète : elles ne seront pas créées, le reste l&apos;est normalement)
              </>
            )}
            .
          </p>
          <div className="max-h-96 overflow-auto rounded-lg border border-border">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-ink-raised-2 text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-3 py-2">Ligne</th>
                  <th className="px-3 py-2">Nom du rôle</th>
                  <th className="px-3 py-2">Catégorie</th>
                  <th className="px-3 py-2">État</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((l) => (
                  <tr key={l.ligne} className="border-t border-border align-top">
                    <td className="px-3 py-2 tabular-nums text-text-muted">{l.ligne}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{l.nom}</div>
                      {l.messageCorps && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs text-text-muted">Voir le message d&apos;invitation</summary>
                          <pre className="mt-1 max-w-xl whitespace-pre-wrap rounded-lg bg-ink px-3 py-2 font-sans text-xs">
                            {l.messageCorps}
                          </pre>
                        </details>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {l.categorie ? CATEGORIE_CACHET_LABELS[l.categorie] : <span className="text-text-muted">{l.categorieSource || "—"}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={l.etat === "ok" ? "turquoise" : "danger"}>{ETAT_LIBELLE[l.etat]}</Badge>
                      {l.raison && <div className="mt-1 text-xs text-text-muted">{l.raison}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={creer} disabled={pending || aCreer === 0}>
              {pending ? "Création…" : `Créer ${aCreer} rôle${aCreer > 1 ? "s" : ""}`}
            </Button>
            <Button type="button" variant="ghost" onClick={reinitialiser} disabled={pending}>
              Choisir un autre fichier
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
