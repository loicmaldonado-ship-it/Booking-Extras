"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { bulkUpdateBookings, recordCovoiturageMessage } from "@/lib/bookings/actions";
import { buildChauffeurMessage, buildPassagerMessage, contactHref, openHref } from "@/lib/bookings/covoiturage-messages";
import { cn } from "@/lib/cn";

export type CovoiturageRow = {
  id: string;
  figurant_id: string;
  covoiturage_role: "conducteur" | "passager" | null;
  covoiturage_lieu_depart: string | null;
  covoiturage_places_disponibles: number | null;
  covoiturage_conducteur_id: string | null;
  figurants: { prenom: string; nom: string; telephone: string | null; email: string | null } | null;
  portraitUrl: string | null;
};

const fieldClass =
  "w-full rounded-lg border border-border bg-ink px-2 py-1.5 text-xs outline-none focus:border-coral disabled:opacity-60";

export function CovoiturageBoard({
  rows,
  date,
  projetId,
}: {
  rows: CovoiturageRow[];
  date: string;
  projetId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [viewMode, setViewMode] = useState<"trombi" | "liste">("trombi");
  const [dragOverZone, setDragOverZone] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [sendError, setSendError] = useState<string | null>(null);

  const conducteurs = useMemo(
    () => rows.filter((r) => r.covoiturage_role === "conducteur"),
    [rows]
  );

  function update(id: string, changes: Parameters<typeof bulkUpdateBookings>[1]) {
    startTransition(async () => {
      await bulkUpdateBookings([id], changes);
      router.refresh();
    });
  }

  function setRole(r: CovoiturageRow, role: "conducteur" | "passager" | "") {
    update(r.id, {
      covoiturage_role: role || null,
      ...(role !== "conducteur" ? { covoiturage_lieu_depart: null, covoiturage_places_disponibles: null } : {}),
      ...(role !== "passager" ? { covoiturage_conducteur_id: null } : {}),
    });
  }

  function demote(r: CovoiturageRow) {
    if (r.covoiturage_role === "conducteur") {
      const passagerIds = rows
        .filter((p) => p.covoiturage_conducteur_id === r.figurant_id)
        .map((p) => p.id);
      startTransition(async () => {
        if (passagerIds.length > 0) {
          await bulkUpdateBookings(passagerIds, { covoiturage_role: null, covoiturage_conducteur_id: null });
        }
        await bulkUpdateBookings([r.id], {
          covoiturage_role: null,
          covoiturage_lieu_depart: null,
          covoiturage_places_disponibles: null,
        });
        router.refresh();
      });
      return;
    }
    setRole(r, "");
  }

  function assignToConducteur(figurantId: string, conducteurFigurantId: string) {
    const row = rows.find((r) => r.figurant_id === figurantId);
    if (!row || figurantId === conducteurFigurantId) return;
    update(row.id, { covoiturage_role: "passager", covoiturage_conducteur_id: conducteurFigurantId });
  }

  function promoteToConducteur(figurantId: string) {
    const row = rows.find((r) => r.figurant_id === figurantId);
    if (!row) return;
    setRole(row, "conducteur");
  }

  function unassign(figurantId: string) {
    const row = rows.find((r) => r.figurant_id === figurantId);
    if (!row) return;
    demote(row);
  }

  function sendCovoiturageMessage(r: CovoiturageRow) {
    if (!r.figurants) return;
    let body: string | null = null;
    const subject = `Covoiturage – ${date}`;

    if (r.covoiturage_role === "conducteur") {
      const passagers = rows
        .filter((p) => p.covoiturage_conducteur_id === r.figurant_id)
        .map((p) => ({ prenom: p.figurants?.prenom ?? "", nom: p.figurants?.nom ?? "", telephone: p.figurants?.telephone ?? null, email: p.figurants?.email ?? null }));
      body = buildChauffeurMessage({
        prenom: r.figurants.prenom,
        lieu: r.covoiturage_lieu_depart,
        date,
        heure: null,
        passagers,
      });
    } else if (r.covoiturage_role === "passager" && r.covoiturage_conducteur_id) {
      const chauffeur = conducteurs.find((c) => c.figurant_id === r.covoiturage_conducteur_id);
      if (!chauffeur?.figurants) return;
      body = buildPassagerMessage({
        prenom: r.figurants.prenom,
        lieu: chauffeur.covoiturage_lieu_depart,
        date,
        heure: null,
        chauffeur: {
          prenom: chauffeur.figurants.prenom,
          nom: chauffeur.figurants.nom,
          telephone: chauffeur.figurants.telephone,
          email: chauffeur.figurants.email,
        },
      });
    }

    if (!body) return;
    const target = contactHref(
      { prenom: r.figurants.prenom, nom: r.figurants.nom, telephone: r.figurants.telephone, email: r.figurants.email },
      body,
      subject
    );
    if (!target) return;
    if (target.kind === "sms") {
      openHref(target.href);
      startTransition(async () => {
        await recordCovoiturageMessage(r.figurant_id, body!, null, undefined, projetId);
      });
      setSentIds((prev) => new Set([...prev, r.id]));
      return;
    }
    setSendError(null);
    startTransition(async () => {
      const result = await recordCovoiturageMessage(r.figurant_id, body!, r.figurants!.email, subject, projetId);
      if (result?.error) setSendError(`Échec de l'envoi à ${r.figurants!.prenom} : ${result.error}`);
      else setSentIds((prev) => new Set([...prev, r.id]));
    });
  }

  const eligibles = rows.filter(
    (r) => r.covoiturage_role === "conducteur" || (r.covoiturage_role === "passager" && r.covoiturage_conducteur_id)
  );

  const groups: { label: string; rows: CovoiturageRow[] }[] = [
    { label: "Conducteurs", rows: conducteurs },
    { label: "Passagers", rows: rows.filter((r) => r.covoiturage_role === "passager") },
    { label: "Sans covoiturage", rows: rows.filter((r) => !r.covoiturage_role) },
  ];

  function TrombiCard({ r, onRemove, onMessage }: { r: CovoiturageRow; onRemove?: () => void; onMessage?: () => void }) {
    return (
      <div
        draggable
        onDragStart={(e) => e.dataTransfer.setData("text/figurant-id", r.figurant_id)}
        className="group relative flex w-24 shrink-0 cursor-grab flex-col items-center gap-1 rounded-xl border border-border bg-ink p-2 text-center active:cursor-grabbing"
      >
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="absolute right-1 top-1 z-10 hidden h-4 w-4 items-center justify-center rounded-full bg-ink-raised-2 text-[10px] text-text-muted hover:bg-danger hover:text-ink group-hover:flex"
            title="Retirer"
          >
            ×
          </button>
        )}
        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-ink-raised-2">
          {r.portraitUrl && <Image src={r.portraitUrl} alt="" fill className="object-cover" unoptimized />}
        </div>
        <span className="truncate text-xs font-medium">
          {r.figurants ? `${r.figurants.prenom} ${r.figurants.nom}` : "—"}
        </span>
        {onMessage && (r.figurants?.telephone || r.figurants?.email) && (
          <button
            type="button"
            onClick={onMessage}
            className="w-full truncate rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium text-text-muted hover:border-coral/60 hover:text-text"
          >
            {r.figurants?.telephone ? "Texto" : "Email"}
          </button>
        )}
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className="text-sm text-text-muted">Aucun booking pour cette journée.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {sendError && (
        <div className="rounded-xl border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger">{sendError}</div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-text-muted">Vue :</span>
        {[
          { value: "trombi" as const, label: "Trombinoscope" },
          { value: "liste" as const, label: "Liste" },
        ].map((v) => (
          <button
            key={v.value}
            type="button"
            onClick={() => setViewMode(v.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              viewMode === v.value
                ? "border-coral bg-coral/15 text-coral"
                : "border-border text-text-muted hover:text-text"
            )}
          >
            {v.label}
          </button>
        ))}
        {eligibles.length > 0 && (
          <Button
            type="button"
            variant="secondary"
            className="ml-auto"
            onClick={() => setBulkOpen((v) => !v)}
          >
            Envoyer à tous les covoiturés ({eligibles.length})
          </Button>
        )}
        {pending && <span className="text-xs text-text-muted">Mise à jour...</span>}
      </div>

      {bulkOpen && (
        <div className="flex flex-col gap-2 rounded-xl border border-coral/40 bg-coral/10 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Envoyer le texto/email de covoiturage à chacun ({sentIds.size}/{eligibles.length} envoyés)
            </span>
            <button type="button" onClick={() => setBulkOpen(false)} className="text-text-muted hover:text-coral">
              Fermer
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {eligibles.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {r.figurants ? `${r.figurants.prenom} ${r.figurants.nom}` : "—"}
                  <span className="ml-2 text-xs text-text-muted">
                    {r.covoiturage_role === "conducteur" ? "Chauffeur" : "Passager"}
                  </span>
                  {!r.figurants?.telephone && !r.figurants?.email && (
                    <span className="ml-2 text-xs text-danger">Pas de contact</span>
                  )}
                </span>
                <Button
                  type="button"
                  variant={sentIds.has(r.id) ? "ghost" : "secondary"}
                  disabled={!r.figurants?.telephone && !r.figurants?.email}
                  onClick={() => sendCovoiturageMessage(r)}
                >
                  {sentIds.has(r.id) ? "Envoyé" : r.figurants?.telephone ? "Texto" : "Email"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === "trombi" && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-text-muted">
            Glisse un profil sur un chauffeur pour l&apos;ajouter comme passager, ou sur « + Nouveau chauffeur »
            pour le promouvoir.
          </p>

          <div className="flex flex-wrap items-start gap-4">
            {conducteurs.map((c) => {
              const passagers = rows.filter((r) => r.covoiturage_conducteur_id === c.figurant_id);
              const zoneKey = `conducteur-${c.figurant_id}`;
              return (
                <div
                  key={c.figurant_id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverZone(zoneKey);
                  }}
                  onDragLeave={() => setDragOverZone((z) => (z === zoneKey ? null : z))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverZone(null);
                    const figurantId = e.dataTransfer.getData("text/figurant-id");
                    if (figurantId) assignToConducteur(figurantId, c.figurant_id);
                  }}
                  className={cn(
                    "flex w-64 shrink-0 flex-col gap-3 rounded-2xl border p-3 transition-colors",
                    dragOverZone === zoneKey ? "border-coral bg-coral/10" : "border-border bg-ink-raised"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <TrombiCard r={c} onRemove={() => demote(c)} onMessage={() => sendCovoiturageMessage(c)} />
                    <div className="flex flex-1 flex-col gap-1">
                      <input
                        defaultValue={c.covoiturage_lieu_depart ?? ""}
                        placeholder="Lieu de départ"
                        disabled={pending}
                        className={fieldClass}
                        onBlur={(e) => {
                          const value = e.target.value.trim() || null;
                          if (value !== c.covoiturage_lieu_depart) update(c.id, { covoiturage_lieu_depart: value });
                        }}
                      />
                      <input
                        type="number"
                        min={0}
                        defaultValue={c.covoiturage_places_disponibles ?? ""}
                        placeholder="Places"
                        disabled={pending}
                        className={fieldClass}
                        onBlur={(e) => {
                          const value = e.target.value ? Number(e.target.value) : null;
                          if (value !== c.covoiturage_places_disponibles)
                            update(c.id, { covoiturage_places_disponibles: value });
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {passagers.map((p) => (
                      <TrombiCard
                        key={p.id}
                        r={p}
                        onRemove={() => unassign(p.figurant_id)}
                        onMessage={() => sendCovoiturageMessage(p)}
                      />
                    ))}
                    {passagers.length === 0 && (
                      <p className="w-full rounded-lg border border-dashed border-border px-2 py-3 text-center text-[11px] text-text-muted">
                        Glisser ici
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverZone("nouveau-conducteur");
              }}
              onDragLeave={() => setDragOverZone((z) => (z === "nouveau-conducteur" ? null : z))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverZone(null);
                const figurantId = e.dataTransfer.getData("text/figurant-id");
                if (figurantId) promoteToConducteur(figurantId);
              }}
              className={cn(
                "flex w-40 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed p-4 text-center text-xs text-text-muted transition-colors",
                dragOverZone === "nouveau-conducteur" ? "border-coral bg-coral/10 text-coral" : "border-border"
              )}
            >
              + Nouveau chauffeur
            </div>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverZone("sans-covoiturage");
            }}
            onDragLeave={() => setDragOverZone((z) => (z === "sans-covoiturage" ? null : z))}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverZone(null);
              const figurantId = e.dataTransfer.getData("text/figurant-id");
              if (figurantId) unassign(figurantId);
            }}
            className={cn(
              "flex flex-col gap-2 rounded-2xl border p-3 transition-colors",
              dragOverZone === "sans-covoiturage" ? "border-coral bg-coral/10" : "border-border bg-ink-raised"
            )}
          >
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Sans covoiturage ({rows.filter((r) => !r.covoiturage_role).length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {rows
                .filter((r) => !r.covoiturage_role)
                .map((r) => (
                  <TrombiCard key={r.id} r={r} />
                ))}
              {rows.filter((r) => !r.covoiturage_role).length === 0 && (
                <p className="text-xs text-text-muted">Tout le monde a un covoiturage.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {viewMode === "liste" && (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <div key={g.label} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-text-muted">
                {g.label} ({g.rows.length})
              </h3>
              {g.rows.length === 0 ? (
                <p className="text-sm text-text-muted">—</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {g.rows.map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-ink-raised px-4 py-3"
                    >
                      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-ink-raised-2">
                        {r.portraitUrl && (
                          <Image src={r.portraitUrl} alt="" fill className="object-cover" unoptimized />
                        )}
                      </div>
                      <span className="w-36 shrink-0 font-medium">
                        {r.figurants ? `${r.figurants.prenom} ${r.figurants.nom}` : "—"}
                      </span>

                      <select
                        value={r.covoiturage_role ?? ""}
                        disabled={pending}
                        onChange={(e) => setRole(r, e.target.value as "conducteur" | "passager" | "")}
                        className={`${fieldClass} w-36`}
                      >
                        <option value="">Aucun</option>
                        <option value="conducteur">Conducteur</option>
                        <option value="passager">Passager</option>
                      </select>

                      {r.covoiturage_role === "conducteur" && (
                        <>
                          <input
                            defaultValue={r.covoiturage_lieu_depart ?? ""}
                            placeholder="Lieu de départ"
                            disabled={pending}
                            className={`${fieldClass} w-48`}
                            onBlur={(e) => {
                              const value = e.target.value.trim() || null;
                              if (value !== r.covoiturage_lieu_depart)
                                update(r.id, { covoiturage_lieu_depart: value });
                            }}
                          />
                          <input
                            type="number"
                            min={0}
                            defaultValue={r.covoiturage_places_disponibles ?? ""}
                            placeholder="Places"
                            disabled={pending}
                            className={`${fieldClass} w-24`}
                            onBlur={(e) => {
                              const value = e.target.value ? Number(e.target.value) : null;
                              if (value !== r.covoiturage_places_disponibles)
                                update(r.id, { covoiturage_places_disponibles: value });
                            }}
                          />
                        </>
                      )}

                      {r.covoiturage_role === "passager" && (
                        <select
                          value={r.covoiturage_conducteur_id ?? ""}
                          disabled={pending}
                          onChange={(e) => update(r.id, { covoiturage_conducteur_id: e.target.value || null })}
                          className={`${fieldClass} w-48`}
                        >
                          <option value="">Choisir un conducteur</option>
                          {conducteurs
                            .filter((c) => c.figurant_id !== r.figurant_id)
                            .map((c) => (
                              <option key={c.figurant_id} value={c.figurant_id}>
                                {c.figurants ? `${c.figurants.prenom} ${c.figurants.nom}` : "—"}
                                {c.covoiturage_lieu_depart ? ` · ${c.covoiturage_lieu_depart}` : ""}
                              </option>
                            ))}
                        </select>
                      )}

                      {(r.covoiturage_role === "conducteur" ||
                        (r.covoiturage_role === "passager" && r.covoiturage_conducteur_id)) && (
                        <button
                          type="button"
                          onClick={() => sendCovoiturageMessage(r)}
                          disabled={!r.figurants?.telephone && !r.figurants?.email}
                          className="rounded-full border border-border px-3 py-1 text-xs font-medium text-text-muted hover:border-coral/60 hover:text-text disabled:opacity-30"
                        >
                          {r.figurants?.telephone ? "Texto" : r.figurants?.email ? "Email" : "Pas de contact"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
