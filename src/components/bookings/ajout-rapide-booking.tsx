"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Modale } from "@/components/ui/modale";
import { FonctionsDatalist } from "@/components/projets/fonctions-datalist";
import { ACCEPT_IMAGES, prepareImage } from "@/lib/media/compress-image";
import { ajoutRapideBooking, type ResultatAjoutRapide } from "@/lib/bookings/ajout-rapide-actions";
import { CACHETS, type Cachet } from "@/lib/candidatures/types";

type Ajoute = { nom: string; detail: string };

function detailAjout(res: ResultatAjoutRapide): string {
  const fiche = res.existant ? "fiche déjà dans la base" : "nouvelle fiche";
  const mail =
    res.mail === "envoye"
      ? "mail « crée ton compte » envoyé"
      : res.mail === "compte_existant"
        ? "a déjà son compte"
        : res.mail === "pas_email"
          ? "pas d'email : pas de mail envoyé"
          : `mail non envoyé (${res.mailErreur ?? "erreur"})`;
  return `${fiche}, ${mail}`;
}

// Ajout express de personnes dans une journée de booking (photo, identité,
// contact), à enchaîner. Fonction et cachet sont choisis une fois pour la
// série. Les nouvelles fiches vont dans la Base Profils, sans compte, et
// reçoivent un mail pour créer leur compte.
export function AjoutRapideBooking({ projetId, date }: { projetId: string; date: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [ouvert, setOuvert] = useState(false);
  const [fonction, setFonction] = useState("");
  const [cachet, setCachet] = useState<Cachet | "">("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ajoutes, setAjoutes] = useState<Ajoute[]>([]);
  const [pending, demarrer] = useTransition();

  async function choisirPhoto(file: File | undefined) {
    setErreur(null);
    if (!file) return;
    const res = await prepareImage(file);
    if ("error" in res) {
      setErreur(res.error);
      return;
    }
    setPhoto(res.file);
    setApercu((ancien) => {
      if (ancien) URL.revokeObjectURL(ancien);
      return URL.createObjectURL(res.file);
    });
  }

  function reinitialiser() {
    formRef.current?.reset();
    setPhoto(null);
    setApercu((ancien) => {
      if (ancien) URL.revokeObjectURL(ancien);
      return null;
    });
  }

  function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!fonction.trim() || !cachet) {
      setErreur("Choisis la fonction et le cachet.");
      return;
    }
    const fd = new FormData(e.currentTarget);
    fd.delete("photo_brute");
    fd.delete("fonction");
    if (photo) fd.set("photo", photo);
    setErreur(null);
    demarrer(async () => {
      const res = await ajoutRapideBooking(projetId, date, fonction, cachet, fd);
      if (res.error) {
        setErreur(res.error);
        return;
      }
      setAjoutes((l) => [...l, { nom: res.nom ?? "", detail: detailAjout(res) }]);
      reinitialiser();
      formRef.current?.querySelector<HTMLInputElement>("input[name=prenom]")?.focus();
      router.refresh();
    });
  }

  function fermer() {
    if (pending) return;
    setOuvert(false);
    setAjoutes([]);
    setErreur(null);
    reinitialiser();
  }

  const champClasse =
    "w-full rounded-lg border border-border-strong bg-ink px-3 py-2 text-sm outline-none focus:border-coral disabled:opacity-60";

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOuvert(true)}>
        ⚡ Ajout rapide
      </Button>
      {ouvert && (
        <Modale
          titre="⚡ Ajout rapide dans la journée"
          sousTitre="Pour quelqu'un qui n'est pas encore dans la base : sa fiche est créée sans compte, et un mail lui propose de créer son compte (il en aura besoin pour postuler)."
          onClose={fermer}
          bloquee={pending}
        >
          <form ref={formRef} onSubmit={envoyer} className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-2 rounded-xl border border-border bg-ink-raised p-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-text-muted">
                <span>
                  Fonction <span className="text-danger">*</span>
                </span>
                <FonctionsDatalist id="fonctions-ajout-rapide" projetId={projetId} />
                <input
                  name="fonction"
                  list="fonctions-ajout-rapide"
                  value={fonction}
                  onChange={(e) => setFonction(e.target.value)}
                  placeholder="Passant, Silhouette videur…"
                  disabled={pending}
                  className={champClasse}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-text-muted">
                <span>
                  Cachet <span className="text-danger">*</span>
                </span>
                <select
                  value={cachet}
                  onChange={(e) => setCachet(e.target.value as Cachet | "")}
                  disabled={pending}
                  className={champClasse}
                >
                  <option value="" disabled>
                    Choisir…
                  </option>
                  {CACHETS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-text-muted sm:col-span-2">Gardés pour toutes les personnes de la série.</p>
            </div>

            <div className="flex items-center gap-3">
              <label className="relative flex h-24 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-border-strong bg-ink text-center text-xs text-text hover:border-coral/60">
                {apercu ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={apercu} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span>+ Photo</span>
                )}
                <input
                  type="file"
                  name="photo_brute"
                  accept={ACCEPT_IMAGES}
                  className="sr-only"
                  disabled={pending}
                  onChange={(e) => choisirPhoto(e.target.files?.[0])}
                />
              </label>
              <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                <Input name="prenom" placeholder="Prénom *" required disabled={pending} aria-label="Prénom" />
                <Input name="nom" placeholder="Nom *" required disabled={pending} aria-label="Nom" />
                <Input name="email" type="email" placeholder="Email" disabled={pending} aria-label="Email" />
                <Input name="telephone" type="tel" placeholder="Téléphone" disabled={pending} aria-label="Téléphone" />
              </div>
            </div>

            {erreur && <p className="text-sm text-danger">{erreur}</p>}

            {ajoutes.length > 0 && (
              <ul className="flex flex-col gap-1 rounded-xl border border-turquoise/40 bg-turquoise/10 px-3 py-2 text-sm">
                {ajoutes.map((a, i) => (
                  <li key={i}>
                    ✅ <strong>{a.nom}</strong> <span className="text-text-muted">· {a.detail}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <span className="text-xs text-text-muted">Email ou téléphone : au moins l&apos;un des deux.</span>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={fermer} disabled={pending}>
                  {ajoutes.length > 0 ? "Terminé" : "Annuler"}
                </Button>
                <Button type="submit" disabled={pending || !fonction.trim() || !cachet}>
                  {pending ? "Ajout…" : "Ajouter à la journée"}
                </Button>
              </div>
            </div>
          </form>
        </Modale>
      )}
    </>
  );
}
