"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { createBookingFromDrop, removeBooking } from "@/lib/bookings/actions";
import { setCurrentProjet } from "@/lib/projet-context";
import { formatDateShort } from "@/lib/format-date";

type Figurant = { id: string; prenom: string; nom: string; portraitUrl: string | null };
type BookingCard = {
  id: string;
  date: string;
  fonction: string | null;
  statut: string;
  figurant: Figurant | null;
};

function toLocalISODate(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function eachDate(start: string, end: string) {
  const dates: string[] = [];
  const d = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (d <= last) {
    dates.push(toLocalISODate(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

export function PlanningBoard({
  projets,
  projetId,
  dateDebut,
  dateFin,
  figurants,
  bookings,
  query,
}: {
  projets: { id: string; nom: string }[];
  projetId: string;
  dateDebut: string | null;
  dateFin: string | null;
  figurants: Figurant[];
  bookings: BookingCard[];
  query: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [extraDates, setExtraDates] = useState<string[]>([]);
  const [newDate, setNewDate] = useState("");
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const dates = useMemo(() => {
    const base =
      dateDebut && dateFin
        ? eachDate(dateDebut, dateFin)
        : Array.from(new Set(bookings.map((b) => b.date))).sort();
    return Array.from(new Set([...base, ...extraDates])).sort();
  }, [dateDebut, dateFin, bookings, extraDates]);

  const bookingsByDate = useMemo(() => {
    const map = new Map<string, BookingCard[]>();
    for (const b of bookings) {
      const list = map.get(b.date) ?? [];
      list.push(b);
      map.set(b.date, list);
    }
    return map;
  }, [bookings]);

  function handleDrop(date: string, figurantId: string) {
    setDragOverDate(null);
    startTransition(async () => {
      await createBookingFromDrop(figurantId, projetId, date);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-center gap-3">
        <Select
          value={projetId}
          onChange={(e) =>
            startTransition(() =>
              setCurrentProjet(e.target.value, `/bookings/planning?projet_id=${e.target.value}`)
            )
          }
          className="w-auto"
        >
          {projets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nom}
            </option>
          ))}
        </Select>
        <Input
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          className="w-auto"
        />
        <button
          type="button"
          className="rounded-full bg-ink-raised-2 px-4 py-2 text-sm font-medium hover:border hover:border-coral/60"
          onClick={() => {
            if (newDate && !dates.includes(newDate)) {
              setExtraDates((d) => [...d, newDate]);
              setNewDate("");
            }
          }}
        >
          + Ajouter une journée
        </button>
        {pending && <span className="text-xs text-text-muted">Mise à jour...</span>}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        <Card className="flex h-fit flex-col gap-3">
          <h2 className="text-sm font-semibold text-text-muted">Figurants</h2>
          <form method="get" className="flex gap-2">
            <input type="hidden" name="projet_id" value={projetId} />
            <Input name="q" placeholder="Rechercher..." defaultValue={query} className="text-sm" />
          </form>
          <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto">
            {figurants.map((f) => (
              <div
                key={f.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/figurant-id", f.id)}
                className="flex cursor-grab items-center gap-3 rounded-xl border border-border bg-ink px-3 py-2 active:cursor-grabbing"
              >
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-ink-raised-2">
                  {f.portraitUrl && (
                    <Image src={f.portraitUrl} alt="" fill className="object-cover" unoptimized />
                  )}
                </div>
                <span className="text-sm">
                  {f.prenom} {f.nom}
                </span>
              </div>
            ))}
            {figurants.length === 0 && (
              <p className="text-sm text-text-muted">Aucun·e figurant·e trouvé·e.</p>
            )}
          </div>
        </Card>

        <div className="flex gap-4 overflow-x-auto pb-2">
          {dates.map((date) => (
            <div
              key={date}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverDate(date);
              }}
              onDragLeave={() => setDragOverDate((d) => (d === date ? null : d))}
              onDrop={(e) => {
                e.preventDefault();
                const figurantId = e.dataTransfer.getData("text/figurant-id");
                if (figurantId) handleDrop(date, figurantId);
              }}
              className={`flex w-60 shrink-0 flex-col gap-2 rounded-2xl border p-3 transition-colors ${
                dragOverDate === date
                  ? "border-coral bg-coral/10"
                  : "border-border bg-ink-raised"
              }`}
            >
              <h3 className="text-sm font-semibold">
                {new Date(date + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short" })} {formatDateShort(date)}
              </h3>
              <div className="flex flex-col gap-2">
                {(bookingsByDate.get(date) ?? []).map((b) => (
                  <div
                    key={b.id}
                    className="group flex items-center gap-2 rounded-xl border border-border bg-ink px-2 py-2"
                  >
                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-ink-raised-2">
                      {b.figurant?.portraitUrl && (
                        <Image
                          src={b.figurant.portraitUrl}
                          alt=""
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <a
                        href={`/bookings/${b.id}`}
                        className="block truncate text-xs font-medium hover:text-coral"
                      >
                        {b.figurant ? `${b.figurant.prenom} ${b.figurant.nom}` : "—"}
                      </a>
                      {b.fonction && (
                        <span className="text-[10px] text-text-muted">{b.fonction}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="hidden text-text-muted hover:text-coral group-hover:block"
                      onClick={() =>
                        startTransition(async () => {
                          await removeBooking(b.id);
                          router.refresh();
                        })
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
                {(bookingsByDate.get(date) ?? []).length === 0 && (
                  <p className="rounded-xl border border-dashed border-border px-2 py-4 text-center text-[11px] text-text-muted">
                    Glisser ici
                  </p>
                )}
              </div>
            </div>
          ))}
          {dates.length === 0 && (
            <p className="text-sm text-text-muted">
              Ajoute une journée ou renseigne les dates de tournage du projet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
