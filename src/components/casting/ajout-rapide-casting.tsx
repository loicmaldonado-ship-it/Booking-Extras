"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Modale } from "@/components/ui/modale";
import { ACCEPT_IMAGES, prepareImage } from "@/lib/media/compress-image";
import { ajoutRapideCasting } from "@/lib/casting/ajout-rapide-actions";

// Ajout express d'un profil dans un rôle (photo + identité + contact), à
// enchaîner pour plusieurs personnes. La suite (mensurations…) est
// complétée par la personne avec son lien d'envoi.
export function AjoutRapideCasting({ roleId }: { roleId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [ouvert, setOuvert] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ajoutes, setAjoutes] = useState<string[]>([]);
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
    const fd = new FormData(e.currentTarget);
    fd.delete("photo_brute");
    if (photo) fd.set("photo", photo);
    setErreur(null);
    demarrer(async () => {
      const res = await ajoutRapideCasting(roleId, undefined, fd);
      if (res.error) {
        setErreur(res.error);
        return;
      }
      setAjoutes((l) => [...l, res.nom ?? ""]);
      reinitialiser();
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

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOuvert(true)}>
        ⚡ Ajout rapide
      </Button>
      {ouvert && (
        <Modale
          titre="⚡ Ajout rapide dans le rôle"
          sousTitre="Photo, nom et contact suffisent : la personne complétera sa fiche (naissance, mensurations…) en envoyant ses photos et vidéos."
          onClose={fermer}
          bloquee={pending}
        >
          <form ref={formRef} onSubmit={envoyer} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <label className="relative flex h-24 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-ink text-center text-xs text-text-muted hover:border-coral/60">
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
              <div className="grid flex-1 grid-cols-2 gap-2">
                <Input name="prenom" placeholder="Prénom *" required disabled={pending} aria-label="Prénom" />
                <Input name="nom" placeholder="Nom *" required disabled={pending} aria-label="Nom" />
                <Input name="email" type="email" placeholder="Email" disabled={pending} aria-label="Email" />
                <Input name="telephone" type="tel" placeholder="Téléphone" disabled={pending} aria-label="Téléphone" />
              </div>
            </div>
            {erreur && <p className="text-sm text-danger">{erreur}</p>}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <span className="text-xs text-text-muted">
                {ajoutes.length > 0
                  ? `✅ Ajouté${ajoutes.length > 1 ? "s" : ""} : ${ajoutes.join(", ")}`
                  : "Email ou téléphone : au moins l'un des deux."}
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={fermer} disabled={pending}>
                  {ajoutes.length > 0 ? "Terminé" : "Annuler"}
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Ajout…" : "Ajouter au rôle"}
                </Button>
              </div>
            </div>
          </form>
        </Modale>
      )}
    </>
  );
}
