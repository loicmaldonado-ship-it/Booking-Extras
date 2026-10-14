"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { addBesoin, deleteBesoin, updateBesoin } from "@/lib/bookings/besoins-actions";
import { updateTotalJournee } from "@/lib/bookings/actions";
import type { JourneeBesoin } from "@/lib/bookings/besoins";
import type { Row } from "@/components/bookings/bookings-table";

const STATUTS_EXCLUS = new Set(["annulé", "indisponible", "a_rebooker"]);

function normalize(s: string) {
  return s.trim().toLowerCase();
}

function TotalJourneeField({
  journeeId,
  totalRequis,
  totalBooked,
}: {
  journeeId: string;
  totalRequis: number | null;
  totalBooked: number;
}) {
  const [editing, setEditing] = useState(totalRequis === null);
  const [state, formAction, pending] = useActionState(updateTotalJournee.bind(null, journeeId), undefined);

  if (!editing) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-text-muted">
        Total journée
        <Badge tone={totalBooked >= (totalRequis ?? 0) ? "turquoise" : "yellow"}>
          {totalBooked}/{totalRequis}
        </Badge>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-text-muted hover:text-coral"
          title="Modifier le total journée"
        >
          ✎
        </button>
      </span>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2 text-xs">
      <span className="text-text-muted">Total journée requis :</span>
      <input
        name="total_requis"
        type="number"
        min={1}
        defaultValue={totalRequis ?? ""}
        placeholder="150"
        disabled={pending}
        className="w-20 rounded-lg border border-border bg-ink px-2 py-1 text-sm outline-none focus:border-coral disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-coral px-3 py-1 font-medium text-ink hover:bg-coral-hover disabled:opacity-40"
      >
        {pending ? "..." : "OK"}
      </button>
      {totalRequis !== null && (
        <button type="button" onClick={() => setEditing(false)} className="text-text-muted hover:text-coral">
          Annuler
        </button>
      )}
      {state?.error && <span className="text-danger">{state.error}</span>}
    </form>
  );
}

// Une fonction créée : pastille, et formulaire en place pour la modifier.
function BesoinPastille({ besoin, count }: { besoin: JourneeBesoin; count: number }) {
  const router = useRouter();
  const [edition, setEdition] = useState(false);
  const [fonction, setFonction] = useState(besoin.fonction);
  const [quantite, setQuantite] = useState(String(besoin.quantite));
  const [renommerBookings, setRenommerBookings] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [pending, demarrer] = useTransition();
  const complet = count >= besoin.quantite;
  const renomme = normalize(fonction) !== normalize(besoin.fonction) && fonction.trim() !== "";

  function ouvrir() {
    setFonction(besoin.fonction);
    setQuantite(String(besoin.quantite));
    setRenommerBookings(true);
    setErreur(null);
    setEdition(true);
  }

  function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    demarrer(async () => {
      const res = await updateBesoin(besoin.id, fonction, Number(quantite), renommerBookings);
      if (res.error) {
        setErreur(res.error);
        return;
      }
      setEdition(false);
      router.refresh();
    });
  }

  if (edition) {
    return (
      <form
        onSubmit={enregistrer}
        className="flex flex-wrap items-center gap-2 rounded-2xl border border-coral/60 bg-ink px-3 py-2 text-sm"
      >
        <input
          value={fonction}
          onChange={(e) => setFonction(e.target.value)}
          list="fonctions-suggestions"
          aria-label="Fonction"
          required
          disabled={pending}
          autoFocus
          className="w-48 rounded-lg border border-border bg-ink px-2 py-1 outline-none focus:border-coral disabled:opacity-60"
        />
        <input
          value={quantite}
          onChange={(e) => setQuantite(e.target.value)}
          type="number"
          min={1}
          aria-label="Quantité"
          required
          disabled={pending}
          className="w-20 rounded-lg border border-border bg-ink px-2 py-1 outline-none focus:border-coral disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-coral px-3 py-1 text-xs font-medium text-ink hover:bg-coral-hover disabled:opacity-40"
        >
          {pending ? "..." : "OK"}
        </button>
        <button type="button" onClick={() => setEdition(false)} className="text-xs text-text-muted hover:text-coral">
          Annuler
        </button>
        {renomme && count > 0 && (
          <label className="flex w-full items-center gap-2 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={renommerBookings}
              onChange={(e) => setRenommerBookings(e.target.checked)}
              disabled={pending}
            />
            Renommer aussi la fonction des {count} profil{count > 1 ? "s" : ""} de la journée
          </label>
        )}
        {erreur && <p className="w-full text-xs text-danger">{erreur}</p>}
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-ink px-4 py-2 text-sm">
      <span className="font-medium">{besoin.fonction}</span>
      <Badge tone={complet ? "turquoise" : "yellow"}>
        {count}/{besoin.quantite}
      </Badge>
      <button type="button" onClick={ouvrir} className="text-text-muted hover:text-coral" title="Modifier cette fonction">
        ✎
      </button>
      <form action={deleteBesoin.bind(null, besoin.id)}>
        <button type="submit" className="text-text-muted hover:text-coral" title="Supprimer ce besoin">
          ×
        </button>
      </form>
    </div>
  );
}

export function BesoinsPanel({
  besoins,
  bookings,
  journeeId,
  totalRequis,
}: {
  besoins: JourneeBesoin[];
  bookings: Row[];
  journeeId: string;
  totalRequis: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(addBesoin.bind(null, journeeId), undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  const bookingsActifs = useMemo(() => bookings.filter((b) => !STATUTS_EXCLUS.has(b.statut)), [bookings]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of bookingsActifs) {
      if (!b.fonction) continue;
      const key = normalize(b.fonction);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [bookingsActifs]);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="text-sm font-semibold text-text-muted">Besoins de la journée</h2>
          <TotalJourneeField
            key={totalRequis ?? "unset"}
            journeeId={journeeId}
            totalRequis={totalRequis}
            totalBooked={bookingsActifs.length}
          />
        </div>
        {!open && (
          <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
            + Ajouter une fonction
          </Button>
        )}
      </div>

      {besoins.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {besoins.map((b) => (
            <BesoinPastille key={b.id} besoin={b} count={counts.get(normalize(b.fonction)) ?? 0} />
          ))}
        </div>
      ) : (
        !open && <p className="text-sm text-text-muted">Aucun détail par fonction pour cette journée.</p>
      )}

      {open && (
        <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">Fonction</label>
            <input
              name="fonction"
              list="fonctions-suggestions"
              placeholder="Passant, Silhouette videur..."
              required
              disabled={pending}
              className="w-56 rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral disabled:opacity-60"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-text-muted">Quantité</label>
            <input
              name="quantite"
              type="number"
              min={1}
              placeholder="15"
              required
              disabled={pending}
              className="w-24 rounded-lg border border-border bg-ink px-3 py-2 text-sm outline-none focus:border-coral disabled:opacity-60"
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Ajout..." : "Ajouter"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          {state?.error && <p className="w-full text-sm text-danger">{state.error}</p>}
        </form>
      )}
    </Card>
  );
}
