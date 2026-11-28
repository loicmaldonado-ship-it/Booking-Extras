"use client";
import { useActionState, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { GuardianFields } from "./guardian-fields";
import type { GuardiansData } from "@/lib/minors/model";
import type { MinorDossier, MinorDocument, MinorRequirement } from "@/lib/minors/dossiers";
import { createMinorDossier, saveMinorDates, saveMinorGuardians, addMinorRequirement, createMinorLink, revokeMinorLinks, reviewMinorDocument, deleteMinorDocument, deactivateMinorRequirement, uploadMinorDocument, type MinorResult } from "@/lib/minors/actions";

function ActionForm({ action, label, children }: { action: (prev: unknown, fd: FormData) => Promise<MinorResult>; label: string; children: ReactNode }) {
  const [state, submit, pending] = useActionState(action, {} as MinorResult);
  return <form action={submit} className="flex flex-col gap-3">{children}
    <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : label}</Button>
    {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
    {state.success && <p role="status" className="text-sm">{state.success}</p>}
    {state.url && <div className="break-all rounded border border-border p-3 text-sm"><a className="text-coral underline" href={state.url}>{state.url}</a><p>Copier ce lien privé vers le destinataire prévu. Ne pas le publier.</p></div>}
  </form>;
}
export function MinorActionButton({ action, children }: { action: () => Promise<MinorResult>; children: ReactNode }) {
  const [state, setState] = useState<MinorResult>({}); const [pending, start] = useTransition();
  return <div><Button variant="secondary" disabled={pending} onClick={() => start(async () => { try { setState(await action()); } catch { setState({ error: "Opération interrompue. Recharge puis réessaie." }); } })}>{pending ? "En cours…" : children}</Button>{(state.error || state.success) && <p role={state.error ? "alert" : "status"} className="mt-2 text-sm">{state.error ?? state.success}</p>}</div>;
}
export function CreateMinorDossierForm({ project, profiles }: { project: string; profiles: { id: string; label: string }[] }) {
  return <ActionForm action={createMinorDossier.bind(null, project)} label="Ouvrir le dossier"><Field label="Enfant" required><Select name="figurant_id" required defaultValue=""><option value="" disabled>Choisir un profil mineur</option>{profiles.map(child => <option key={child.id} value={child.id}>{child.label}</option>)}</Select></Field></ActionForm>;
}
export function MinorDatesForm({ dossier }: { dossier: MinorDossier }) {
  return <ActionForm action={saveMinorDates.bind(null, dossier.id)} label="Enregistrer les dates"><div className="grid gap-3 sm:grid-cols-3">
    <Field label="Début du tournage"><Input type="date" name="tournage_debut" defaultValue={dossier.tournage_debut ?? ""} /></Field>
    <Field label="Fin du tournage"><Input type="date" name="tournage_fin" defaultValue={dossier.tournage_fin ?? ""} /></Field>
    <Field label="Commission DRIEETS"><Input type="date" name="commission_date" defaultValue={dossier.commission_date ?? ""} /></Field>
  </div><Field label="Fonction ou rôle prévu"><Input name="role_label" maxLength={200} defaultValue={dossier.role_label ?? ""} /></Field><Field label="Cachet et conditions de rémunération prévus"><Input name="cachet_info" maxLength={400} defaultValue={dossier.cachet_info ?? ""} /></Field></ActionForm>;
}
export function MinorGuardiansForm({ dossierId, birth, initial }: { dossierId: string; birth: string; initial?: GuardiansData }) {
  return <ActionForm action={saveMinorGuardians.bind(null, dossierId)} label="Enregistrer les représentants"><GuardianFields birth={birth} initial={initial} /></ActionForm>;
}
export function MinorRequirementForm({ project }: { project: string }) {
  return <ActionForm action={addMinorRequirement.bind(null, project)} label="Ajouter une pièce pour ce projet"><Field label="Intitulé de la pièce" required><Input name="label" required maxLength={200} placeholder="Ex. certificat demandé par la commission" /></Field><label className="flex gap-2 text-sm"><input type="checkbox" name="required" defaultChecked />Obligatoire pour compléter les dossiers de ce projet</label></ActionForm>;
}
export function RemoveMinorRequirement({ project, id }: { project: string; id: string }) { return <MinorActionButton action={deactivateMinorRequirement.bind(null, project, id)}>Retirer cette exigence</MinorActionButton>; }
export function MinorLinkForm({ dossierId }: { dossierId: string }) {
  return <div className="flex flex-col gap-4"><ActionForm action={createMinorLink.bind(null, dossierId)} label="Créer le lien privé"><Field label="Destinataire"><Select name="kind"><option value="guardian_1">Représentant 1 — dépôt</option><option value="guardian_2">Représentant 2 — dépôt</option><option value="production">Production — téléchargement des pièces validées</option></Select></Field></ActionForm><MinorActionButton action={revokeMinorLinks.bind(null, dossierId)}>Révoquer tous les liens de ce dossier</MinorActionButton></div>;
}
export function MinorReviewForm({ document, dossierId }: { document: MinorDocument; dossierId: string }) {
  return <div className="flex flex-col gap-3"><ActionForm action={reviewMinorDocument.bind(null, dossierId, document.id, document.storage_path, document.current_guardian_fingerprint ?? null)} label="Enregistrer la vérification"><Field label="Commentaire interne (non partagé)"><Input name="internal_note" maxLength={2000} defaultValue={document.internal_note ?? ""} /></Field><Field label="Résultat de la vérification"><Select name="state" defaultValue={document.state === "requested" ? "received" : document.state}><option value="received">Reçue, à vérifier</option><option value="validated">Validée après lecture et vérification de la signature</option><option value="refused">Refusée</option></Select></Field><Field label="Valable jusqu’au (si la pièce expire)"><Input type="date" name="valid_until" defaultValue={document.valid_until ?? ""} /></Field></ActionForm><MinorActionButton action={deleteMinorDocument.bind(null, dossierId, document.id)}>Supprimer le fichier et annuler sa validation</MinorActionButton></div>;
}
export function MinorUploadForm({ token, kind, requirements }: { token: string; kind: string; requirements: MinorRequirement[] }) {
  return <ActionForm action={uploadMinorDocument.bind(null, token)} label="Déposer le fichier"><Field label="Pièce à déposer" required><Select name="source_key" defaultValue={kind}><option value={kind}>Autorisation signée du représentant {kind === "guardian_1" ? "1" : "2"}</option>{requirements.map(r => <option key={r.id} value={`extra_${r.id}`}>{r.label}{r.required ? " — obligatoire" : " — facultative"}</option>)}</Select></Field><Field label="Fichier PDF ou photo (10 Mo maximum)" required><Input name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required /></Field><p className="text-sm text-text-muted">Un nouveau dépôt remplace la pièce précédente et annule sa validation. Aucun fichier n’est visible publiquement.</p></ActionForm>;
}
