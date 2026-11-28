"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Field } from "@/components/ui/field";
import { ACCEPT_IMAGES, prepareImage } from "@/lib/media/compress-image";
import { creerProposition, ajouterPhotoProposition } from "@/lib/casting/agents-public-actions";
import { cn } from "@/lib/cn";

const MAX_PHOTOS = 8;

type PhotoChoisie = { cle: string; fichier: File; apercu: string };

// Proposer un profil pour un rôle : photos glissées (ou choisies), infos, liens.
export function ProposerProfilAgent({ token, roleId, roleNom }: { token: string; roleId: string; roleNom: string }) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [photos, setPhotos] = useState<PhotoChoisie[]>([]);
  const [survol, setSurvol] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoye, setEnvoye] = useState<string | null>(null);
  const [etape, setEtape] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function ajouterFichiers(liste: FileList | File[]) {
    const images = Array.from(liste).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    setPhotos((prev) =>
      [...prev, ...images.map((f) => ({ cle: crypto.randomUUID(), fichier: f, apercu: URL.createObjectURL(f) }))].slice(0, MAX_PHOTOS)
    );
  }

  function retirer(cle: string) {
    setPhotos((prev) => prev.filter((p) => p.cle !== cle));
  }

  function envoyer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setErreur(null);
    setEnvoye(null);
    startTransition(async () => {
      setEtape("Envoi des informations…");
      const res = await creerProposition(token, roleId, fd);
      if (res.error || !res.id) {
        setErreur(res.error ?? "Envoi impossible.");
        setEtape(null);
        return;
      }
      // Photos une par une (réduites avant l'envoi) : aucune limite de taille atteinte.
      let echecs = 0;
      for (let i = 0; i < photos.length; i++) {
        setEtape(`Photo ${i + 1} sur ${photos.length}…`);
        const prepare = await prepareImage(photos[i].fichier);
        if ("error" in prepare) {
          echecs++;
          continue;
        }
        const pf = new FormData();
        pf.set("photo", prepare.file);
        const r = await ajouterPhotoProposition(token, res.id, pf);
        if (r.error) echecs++;
      }
      setEtape(null);
      const nom = `${String(fd.get("prenom") ?? "").trim()} ${String(fd.get("nom") ?? "").trim()}`.trim();
      setEnvoye(
        echecs > 0
          ? `${nom} est proposé·e, mais ${echecs} photo${echecs > 1 ? "s n'ont" : " n'a"} pas pu être envoyée${echecs > 1 ? "s" : ""}.`
          : `${nom} est proposé·e pour « ${roleNom} ». Merci !`
      );
      formRef.current?.reset();
      photos.forEach((p) => URL.revokeObjectURL(p.apercu));
      setPhotos([]);
      router.refresh();
    });
  }

  if (!ouvert) {
    return (
      <div className="flex flex-col gap-2">
        {envoye && <p className="text-sm font-medium text-turquoise">{envoye}</p>}
        <div>
          <Button type="button" variant="secondary" onClick={() => setOuvert(true)}>
            Proposer un profil
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={envoyer} className="flex flex-col gap-3 rounded-xl border border-border-strong bg-ink p-3">
      <h4 className="text-sm font-semibold">Proposer un profil pour « {roleNom} »</h4>
      {envoye && <p className="text-sm font-medium text-turquoise">{envoye}</p>}
      {erreur && <p className="text-sm text-danger">{erreur}</p>}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setSurvol(true);
        }}
        onDragLeave={() => setSurvol(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSurvol(false);
          ajouterFichiers(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-4 text-center text-sm",
          survol ? "border-coral bg-coral/10" : "border-border-strong"
        )}
      >
        <p className="font-medium">Glisse les photos ici</p>
        <p className="text-xs text-text-muted">jusqu&apos;à {MAX_PHOTOS} photos (portrait, en pied…)</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-full border-2 border-border-strong px-4 py-1.5 text-xs font-semibold hover:border-coral"
        >
          ou choisir sur l&apos;appareil
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_IMAGES}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) ajouterFichiers(e.target.files);
            e.target.value = "";
          }}
        />
        {photos.length > 0 && (
          <div className="mt-1 flex flex-wrap justify-center gap-2">
            {photos.map((p) => (
              <div key={p.cle} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local */}
                <img src={p.apercu} alt="" className="h-24 w-20 rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => retirer(p.cle)}
                  aria-label="Retirer cette photo"
                  className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-text text-xs text-ink"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Prénom" required>
          <Input name="prenom" required maxLength={60} autoComplete="off" />
        </Field>
        <Field label="Nom" required>
          <Input name="nom" required maxLength={60} autoComplete="off" />
        </Field>
        <Field label="Âge">
          <Input name="age" maxLength={30} inputMode="numeric" autoComplete="off" />
        </Field>
        <Field label="Taille (cm)">
          <Input name="taille" maxLength={30} inputMode="numeric" autoComplete="off" />
        </Field>
      </div>
      <Field label="Lien vers sa page de comédien·ne">
        <Input name="lien_page" type="text" inputMode="url" placeholder="https://…" maxLength={400} autoComplete="off" />
      </Field>
      <Field label="Lien vers sa bande démo">
        <Input name="lien_bande_demo" type="text" inputMode="url" placeholder="https://…" maxLength={400} autoComplete="off" />
      </Field>
      <Field label="Un mot sur ce profil (facultatif)">
        <Textarea name="note" rows={3} maxLength={1500} />
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? (etape ?? "Envoi…") : "Envoyer la proposition"}
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={() => setOuvert(false)}>
          Fermer
        </Button>
      </div>
    </form>
  );
}
