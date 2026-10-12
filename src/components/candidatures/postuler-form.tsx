"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useId, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { DateNaissanceField } from "@/components/ui/date-naissance-field";
import { postulerAnnonce } from "@/lib/candidatures/actions";
import { inscrireCandidat } from "@/lib/candidats/inscription";
import { ACCEPT_IMAGES, prepareImage } from "@/lib/media/compress-image";
import { formatDateShort } from "@/lib/format-date";
import { CONTACT_RGPD_EMAIL } from "@/lib/legal/contact";
import { GENRES, PRONOMS } from "@/lib/figurants/types";
import type { AnnonceQuestion } from "@/lib/annonces/questions";
import type { AnnonceDate } from "@/lib/annonces/dates";

const REQUIRED_PHOTO_SLOTS = [
  { name: "photo_portrait", label: "Portrait" },
  { name: "photo_pied", label: "Photo en pied" },
  { name: "photo_selfie", label: "Selfie récent" },
] as const;

const MAX_EXTRA_PHOTOS = 4; // 3 obligatoires + 4 = 7 photos maximum

// Les photos ne passent pas par l'<input> au moment de l'envoi : chaque
// emplacement prépare sa photo (réduite, HEIC converti) et la confie au
// formulaire, qui l'ajoute lui-même aux données envoyées. Remplacer le
// fichier de l'input (DataTransfer) ne marche pas sur tous les navigateurs,
// et une photo non réduite dépassait la limite d'envoi de 4,5 Mo.
type Emplacement = {
  name: string;
  label: string;
  required: boolean;
  file: File | null;
  // Photo déjà sur le compte, choisie à la place d'un nouveau fichier.
  existante: string | null;
  busy: boolean;
  el: HTMLElement | null;
};
export type PhotoDuCompte = { id: string; type: string; url: string };
const PhotosContext = createContext<{
  maj: (key: string, patch: Partial<Emplacement>) => void;
  retirer: (key: string) => void;
  mesPhotos: PhotoDuCompte[];
} | null>(null);

const TYPE_PHOTO_LABEL: Record<string, string> = {
  portrait: "Portrait",
  pied: "En pied",
  selfie: "Selfie",
  vehicule: "Véhicule",
  tenue: "Tenue",
  autre: "Autre",
};

// Fenêtre « Mes photos » : les photos déjà sur le compte, la plus récente
// d'abord ; un clic la choisit pour l'emplacement.
function ChoixMesPhotos({
  photos,
  titre,
  onChoisir,
  onFermer,
}: {
  photos: PhotoDuCompte[];
  titre: string;
  onChoisir: (p: PhotoDuCompte) => void;
  onFermer: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Mes photos — ${titre}`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-4 sm:items-center"
      onClick={onFermer}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-2xl border border-border bg-ink-raised p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold">Mes photos — {titre}</h3>
          <button type="button" onClick={onFermer} className="text-sm text-text-muted hover:text-text">
            Fermer
          </button>
        </div>
        <p className="text-xs text-text-muted">
          Choisis une photo qui correspond à cette annonce (tenue, coupe de cheveux, barbe…).
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onChoisir(p)}
              className="flex flex-col gap-1 rounded-xl border border-border p-1 text-xs text-text-muted hover:border-coral"
            >
              <span className="relative block aspect-square w-full overflow-hidden rounded-lg bg-ink-raised-2">
                <Image src={p.url} alt="" fill sizes="120px" className="object-cover" unoptimized />
              </span>
              {TYPE_PHOTO_LABEL[p.type] ?? p.type}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PhotoSlot({
  name,
  label,
  required,
}: {
  name: string;
  label: string;
  required?: boolean;
}) {
  const key = useId();
  const photos = useContext(PhotosContext);
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [preparation, setPreparation] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [choixOuvert, setChoixOuvert] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mesPhotos = photos?.mesPhotos ?? [];

  // Retiré au démontage (photo du véhicule quand on répond « non »).
  useEffect(() => {
    photos?.maj(key, { name, label, required: !!required, el: wrapperRef.current });
    return () => photos?.retirer(key);
  }, [photos, key, name, label, required]);

  return (
    <div className="flex flex-col gap-1.5" ref={wrapperRef}>
      <div
        onClick={() => inputRef.current?.click()}
        className={
          "relative aspect-square cursor-pointer overflow-hidden rounded-xl border-2 border-dashed bg-ink-raised-2 transition-colors hover:border-coral/60 " +
          (erreur ? "border-danger" : "border-border")
        }
      >
        {preview ? (
          <Image src={preview} alt={label} fill className="object-cover" unoptimized />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-xs text-text-muted">
            <span className="text-lg">{preparation ? "…" : "+"}</span>
            <span>{preparation ? "Préparation" : "Ajouter"}</span>
          </div>
        )}
        {preview && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPreview(null);
              photos?.maj(key, { file: null, existante: null });
              if (inputRef.current) inputRef.current.value = "";
            }}
            className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink/80 text-sm text-text hover:bg-danger hover:text-ink"
          >
            ×
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_IMAGES}
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setErreur(null);
            setPreparation(true);
            photos?.maj(key, { busy: true });
            // 1400 px : jusqu'à 8 photos doivent tenir sous la limite d'envoi.
            const res = await prepareImage(file, { maxDimension: 1400 });
            setPreparation(false);
            if ("error" in res) {
              setErreur(res.error);
              setPreview(null);
              photos?.maj(key, { busy: false, file: null });
              e.target.value = "";
              return;
            }
            setPreview(URL.createObjectURL(res.file));
            photos?.maj(key, { busy: false, file: res.file, existante: null });
          }}
        />
      </div>
      <span className="text-center text-xs text-text-muted">
        {label}
        {required ? " *" : ""}
      </span>
      {mesPhotos.length > 0 && (
        <button
          type="button"
          onClick={() => setChoixOuvert(true)}
          className="text-center text-xs font-medium text-coral hover:underline"
        >
          Mes photos
        </button>
      )}
      {erreur && <span className="text-center text-xs text-danger">{erreur}</span>}
      {choixOuvert && (
        <ChoixMesPhotos
          photos={mesPhotos}
          titre={label}
          onFermer={() => setChoixOuvert(false)}
          onChoisir={(p) => {
            setErreur(null);
            setPreview(p.url);
            if (inputRef.current) inputRef.current.value = "";
            photos?.maj(key, { file: null, existante: p.id });
            setChoixOuvert(false);
          }}
        />
      )}
    </div>
  );
}

// Nom lisible d'un champ invalide : le libellé (Field, question, date)
// est le premier enfant d'un des ancêtres proches.
function nomDuChamp(el: Element): string {
  let n: Element | null = el.parentElement;
  for (let i = 0; i < 5 && n; i++, n = n.parentElement) {
    const premier = n.firstElementChild;
    if (premier && premier !== el && !premier.contains(el) && (premier.tagName === "LABEL" || premier.tagName === "SPAN")) {
      const t = premier.textContent?.replace(/\*/g, "").trim();
      if (t) return t;
    }
  }
  return "un champ obligatoire";
}

// Limite Vercel 4,5 Mo pour tout l'envoi : marge pour le texte du formulaire.
const TAILLE_MAX_ENVOI = 4 * 1024 * 1024;

// Même formulaire pour postuler à une annonce et pour créer son compte
// sans annonce (mode « inscription » : pas de message ni de questions /
// disponibilités, mot de passe en plus).
export function PostulerForm({
  mode = "candidature",
  publicToken = "",
  connecte = false,
  mesPhotos = [],
  questions,
  dates,
  prefill,
  bandeDemoObligatoire = false,
  showAgent = false,
}: {
  mode?: "candidature" | "inscription";
  publicToken?: string;
  connecte?: boolean;
  mesPhotos?: PhotoDuCompte[];
  questions: AnnonceQuestion[];
  dates: AnnonceDate[];
  prefill?: {
    prenom: string;
    nom: string;
    email: string;
    telephone: string | null;
    ville: string | null;
    adresse: string | null;
    code_postal: string | null;
    commune_naissance: string | null;
    date_naissance: string | null;
    lien_bande_demo?: string | null;
    taille_cm?: number | null;
    poids_kg?: number | null;
    pointure?: number | null;
    veste?: string | null;
    pantalon?: string | null;
    genre?: string | null;
    pronom?: string | null;
    agent_nom?: string | null;
    agent_email?: string | null;
    agent_telephone?: string | null;
    agent_agence?: string | null;
  };
  bandeDemoObligatoire?: boolean;
  showAgent?: boolean;
}) {
  const inscription = mode === "inscription";
  // Compte obligatoire pour postuler : sans connexion, le mot de passe se
  // crée en validant la candidature.
  const creationCompte = inscription || !connecte;
  const lienConnexion = inscription ? "/compte/connexion" : `/compte/connexion?retour=/postuler/${publicToken}`;
  const [state, formAction, pending] = useActionState<
    { error?: string; success?: boolean; compteExistant?: boolean; compteCree?: boolean } | undefined,
    FormData
  >(inscription ? inscrireCandidat : postulerAnnonce.bind(null, publicToken), undefined);
  const [aVehicule, setAVehicule] = useState<boolean | null>(null);
  const [sansAgent, setSansAgent] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const emplacements = useRef(new Map<string, Emplacement>());
  // Une erreur renvoyée par le serveur s'affiche en haut du formulaire : on
  // y emmène la personne, qui vient de cliquer tout en bas.
  const erreurServeurRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state?.error) erreurServeurRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state]);
  const [photosEnPreparation, setPhotosEnPreparation] = useState(0);
  const [aCorriger, setACorriger] = useState<string[] | null>(null);
  const [photosContexte] = useState(() => ({
    maj: (key: string, patch: Partial<Emplacement>) => {
      const actuel = emplacements.current.get(key) ?? {
        name: "",
        label: "",
        required: false,
        file: null,
        existante: null,
        busy: false,
        el: null,
      };
      emplacements.current.set(key, { ...actuel, ...patch });
      if (patch.busy !== undefined) {
        setPhotosEnPreparation(Array.from(emplacements.current.values()).filter((e) => e.busy).length);
      }
    },
    retirer: (key: string) => {
      emplacements.current.delete(key);
      setPhotosEnPreparation(Array.from(emplacements.current.values()).filter((e) => e.busy).length);
    },
    mesPhotos,
  }));

  // Validation maison plutôt que celle du navigateur : les emplacements
  // photo sont des champs cachés, et un champ obligatoire caché bloquait
  // l'envoi sans aucun message (« impossible de valider »).
  function envoyer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const manquants: string[] = [];
    let premier: HTMLElement | null = null;
    const groupesVus = new Set<string>();
    for (const el of Array.from(form.elements)) {
      if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) continue;
      if (el.disabled || el.type === "file" || el.checkValidity()) continue;
      // Un groupe Oui/Non n'est signalé qu'une fois (sur son premier bouton).
      if (el instanceof HTMLInputElement && el.type === "radio") {
        if (groupesVus.has(el.name)) continue;
        groupesVus.add(el.name);
      }
      const nom = nomDuChamp(el);
      if (!manquants.includes(nom)) manquants.push(nom);
      premier ??= el;
    }
    const slots = Array.from(emplacements.current.values());
    for (const slot of slots) {
      if (slot.required && !slot.file && !slot.existante) {
        manquants.push(`Photo : ${slot.label}`);
        premier ??= slot.el;
      }
    }
    if (creationCompte) {
      const mdp = form.elements.namedItem("password") as HTMLInputElement | null;
      const confirmation = form.elements.namedItem("password_confirmation") as HTMLInputElement | null;
      if (mdp?.value && confirmation?.value && mdp.value !== confirmation.value) {
        manquants.push("Les deux mots de passe ne sont pas identiques");
        premier ??= confirmation;
      }
    }
    if (photosEnPreparation > 0) {
      setACorriger(["Les photos sont encore en préparation : réessaie dans quelques secondes."]);
      return;
    }
    if (manquants.length > 0) {
      setACorriger(manquants);
      premier?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (premier instanceof HTMLInputElement || premier instanceof HTMLSelectElement || premier instanceof HTMLTextAreaElement) {
        premier.focus({ preventScroll: true });
      }
      return;
    }

    const fd = new FormData(form);
    let total = 0;
    for (const slot of slots) {
      if (slot.existante) fd.append(`${slot.name}__existante`, slot.existante);
      if (!slot.file) continue;
      fd.append(slot.name, slot.file);
      total += slot.file.size;
    }
    if (total > TAILLE_MAX_ENVOI) {
      setACorriger([
        `Tes photos sont trop lourdes au total (${(total / 1048576).toFixed(1)} Mo, 4 Mo maximum) : retire une photo optionnelle.`,
      ]);
      return;
    }
    setACorriger(null);
    startTransition(() => formAction(fd));
  }

  if (state?.success) {
    return (
      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-turquoise">Candidature envoyée</h2>
        <p className="text-sm text-text-muted">
          Merci ! Ta candidature a bien été enregistrée. On te recontacte si ton profil correspond.
        </p>
        {state.compteCree && (
          <p className="text-sm">
            <strong>Ton compte est créé.</strong> La prochaine fois, connecte-toi avec ton email et ton mot de passe :
            tes infos seront déjà remplies, il ne restera que les photos de l&apos;annonce.
          </p>
        )}
        <Link href="/compte" className="text-sm font-medium text-coral hover:underline">
          Aller à mon espace →
        </Link>
      </Card>
    );
  }

  return (
    <PhotosContext.Provider value={photosContexte}>
    <form noValidate onSubmit={envoyer} className="flex flex-col gap-4">
      {state?.error && (
        <div ref={erreurServeurRef} className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {state.error}
          {state.compteExistant && (
            <Link href={lienConnexion} className="mt-2 block font-medium underline">
              Me connecter →
            </Link>
          )}
        </div>
      )}
      {!inscription && !connecte && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-ink-raised px-4 py-3 text-sm">
          <span>Déjà un compte ? Connecte-toi : tes infos seront remplies automatiquement.</span>
          <Link href={lienConnexion} className="font-medium text-coral hover:underline">
            Me connecter →
          </Link>
        </div>
      )}
      {prefill && (
        <div className="rounded-xl border border-turquoise/40 bg-turquoise/10 px-4 py-3 text-sm text-turquoise">
          Vos infos sont pré-remplies depuis votre espace. Vérifiez-les et modifiez-les si besoin.
        </div>
      )}
      <Card className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Prénom" required>
            <Input name="prenom" required defaultValue={prefill?.prenom} />
          </Field>
          <Field label="Nom" required>
            <Input name="nom" required defaultValue={prefill?.nom} />
          </Field>
          <Field label="Email" required>
            <Input
              type="email"
              name="email"
              required
              defaultValue={prefill?.email}
              readOnly={connecte}
              className={connecte ? "opacity-70" : undefined}
            />
          </Field>
          <Field label="Téléphone" required>
            <Input type="tel" name="telephone" required defaultValue={prefill?.telephone ?? undefined} />
          </Field>
          <DateNaissanceField name="date_naissance" required defaultValue={prefill?.date_naissance} />
          <Field label="Commune de naissance" required>
            <Input name="commune_naissance" required defaultValue={prefill?.commune_naissance ?? undefined} />
          </Field>
          <Field label="Genre" required>
            <Select name="genre" required defaultValue={prefill?.genre ?? ""}>
              <option value="" disabled></option>
              {GENRES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Pronom" required>
            <Select name="pronom" required defaultValue={prefill?.pronom ?? ""}>
              <option value="" disabled></option>
              {PRONOMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-text-muted">Adresse de résidence</span>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Rue et numéro" required>
              <Input name="adresse" required defaultValue={prefill?.adresse ?? undefined} />
            </Field>
            <Field label="Code postal" required>
              <Input name="code_postal" required defaultValue={prefill?.code_postal ?? undefined} />
            </Field>
            <Field label="Ville" required>
              <Input name="ville" required defaultValue={prefill?.ville ?? undefined} />
            </Field>
          </div>
        </div>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-text-muted">Mensurations</span>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Taille (cm)" required>
              <Input type="number" name="taille_cm" required min={0} defaultValue={prefill?.taille_cm ?? undefined} />
            </Field>
            <Field label="Poids (kg)" required>
              <Input type="number" name="poids_kg" required min={0} defaultValue={prefill?.poids_kg ?? undefined} />
            </Field>
            <Field label="Pointure" required>
              <Input
                type="number"
                name="pointure"
                required
                min={15}
                max={60}
                step={0.5}
                defaultValue={prefill?.pointure ?? undefined}
              />
            </Field>
            <Field label="Taille de veste" required>
              <Input name="veste" placeholder="Ex. 48/50" required defaultValue={prefill?.veste ?? undefined} />
            </Field>
            <Field label="Taille de pantalon" required>
              <Input name="pantalon" placeholder="Ex. 42" required defaultValue={prefill?.pantalon ?? undefined} />
            </Field>
          </div>
        </div>
        {!inscription && (
          <label className="flex items-start gap-2.5 rounded-xl border border-border bg-ink px-3 py-2.5 text-sm">
            <input type="checkbox" name="temporaire" className="mt-0.5 h-4 w-4 rounded border-border accent-coral" />
            <span>
              Je ne fais de la figuration que pour ce tournage.
              <span className="mt-0.5 block text-xs text-text-muted">
                Ton profil sera automatiquement supprimé une fois ce projet terminé et archivé.
              </span>
            </span>
          </label>
        )}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-text-muted">As-tu un véhicule ? *</span>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="a_vehicule"
                value="oui"
                required
                onChange={() => setAVehicule(true)}
                className="accent-coral"
              />
              Oui
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="a_vehicule"
                value="non"
                required
                onChange={() => setAVehicule(false)}
                className="accent-coral"
              />
              Non
            </label>
          </div>
          {aVehicule && (
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-ink px-3 py-3">
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" name="vehicule_voiture" className="h-4 w-4 rounded border-border accent-coral" />
                  Voiture
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" name="vehicule_velo" className="h-4 w-4 rounded border-border accent-coral" />
                  Vélo
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="checkbox" name="vehicule_moto" className="h-4 w-4 rounded border-border accent-coral" />
                  Moto
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    name="vehicule_scooter"
                    className="h-4 w-4 rounded border-border accent-coral"
                  />
                  Scooter
                </label>
              </div>
              <Field label="Marque du véhicule" required>
                <Input name="vehicule_marque" required />
              </Field>
              <div className="w-24">
                <PhotoSlot name="photo_vehicule" label="Photo du véhicule" />
              </div>
            </div>
          )}
        </div>

        {!inscription && (
          <Field label="Message" required>
            <Textarea name="message" required placeholder="Disponibilités, motivation, précisions..." />
          </Field>
        )}
        <Field label={`Lien bande démo${bandeDemoObligatoire ? "" : " (optionnel)"}`} required={bandeDemoObligatoire}>
          <Input
            type="url"
            name="lien_bande_demo"
            required={bandeDemoObligatoire}
            placeholder="https://..."
            defaultValue={prefill?.lien_bande_demo ?? undefined}
          />
        </Field>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-text-muted">
            Photos — 3 obligatoires, jusqu&apos;à 7 au total
          </span>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {REQUIRED_PHOTO_SLOTS.map((slot) => (
              <PhotoSlot key={slot.name} name={slot.name} label={slot.label} required />
            ))}
            {Array.from({ length: MAX_EXTRA_PHOTOS }).map((_, i) => (
              <PhotoSlot key={`extra-${i}`} name="photo_extra" label="Autre (optionnel)" />
            ))}
          </div>
          <div className="mt-3">
            <Field label="Date du selfie" required>
              <Input type="date" name="selfie_date" required max={today} defaultValue={today} />
            </Field>
          </div>
        </div>
      </Card>

      {showAgent && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Agent</h2>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="sans_agent"
              checked={sansAgent}
              onChange={(e) => setSansAgent(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-coral"
            />
            Je n&apos;ai pas d&apos;agent
          </label>
          {!sansAgent && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nom de l'agent" required>
                <Input name="agent_nom" required={!sansAgent} defaultValue={prefill?.agent_nom ?? undefined} />
              </Field>
              <Field label="Agence">
                <Input name="agent_agence" defaultValue={prefill?.agent_agence ?? undefined} />
              </Field>
              <Field label="Email de l'agent">
                <Input type="email" name="agent_email" defaultValue={prefill?.agent_email ?? undefined} />
              </Field>
              <Field label="Téléphone de l'agent">
                <Input type="tel" name="agent_telephone" defaultValue={prefill?.agent_telephone ?? undefined} />
              </Field>
            </div>
          )}
        </Card>
      )}

      {questions.length > 0 && (
        <Card className="flex flex-col gap-4">
          {questions.map((q) => (
            <div key={q.id} className="flex flex-col gap-2">
              <span className="text-sm font-medium">{q.label}</span>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="radio" name={`question_${q.id}`} value="oui" required className="accent-coral" />
                  Oui
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="radio" name={`question_${q.id}`} value="non" required className="accent-coral" />
                  Non
                </label>
              </div>
            </div>
          ))}
        </Card>
      )}

      {dates.length > 0 && (
        <Card className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-text-muted">Disponibilités</h2>
          {dates.map((d) => (
            <div key={d.id} className="flex flex-col gap-2">
              <span className="text-sm font-medium">{formatDateShort(d.date)}</span>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="radio" name={`date_${d.id}`} value="oui" required className="accent-turquoise" />
                  Disponible
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <input type="radio" name={`date_${d.id}`} value="non" required className="accent-coral" />
                  Pas disponible
                </label>
              </div>
            </div>
          ))}
        </Card>
      )}

      {creationCompte && (
        <Card className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold">
              {inscription ? "Ton compte" : "Crée ton compte pour valider ta candidature"}
            </h2>
            <p className="text-sm text-text-muted">
              {inscription
                ? "Tu te connecteras avec ton email et ce mot de passe pour postuler aux annonces : tes infos seront déjà remplies."
                : "C'est gratuit. La prochaine fois, tout sera pré-rempli sauf les photos, qui doivent correspondre à chaque annonce."}
            </p>
            {!inscription && (
              <p className="mt-1 text-sm text-text-muted">
                Déjà un compte ?{" "}
                <Link href={lienConnexion} className="font-medium text-coral hover:underline">
                  Me connecter
                </Link>
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Mot de passe (8 caractères minimum)" required>
              <Input type="password" name="password" required minLength={8} autoComplete="new-password" />
            </Field>
            <Field label="Confirme le mot de passe" required>
              <Input type="password" name="password_confirmation" required minLength={8} autoComplete="new-password" />
            </Field>
          </div>
        </Card>
      )}

      {aCorriger && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          <p className="font-medium">
            {aCorriger.length === 1 && aCorriger[0].endsWith(".") ? aCorriger[0] : "Il reste à compléter ou corriger :"}
          </p>
          {!(aCorriger.length === 1 && aCorriger[0].endsWith(".")) && (
            <ul className="mt-1 list-disc pl-5">
              {aCorriger.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Button type="submit" disabled={pending || photosEnPreparation > 0}>
        {pending
          ? "Envoi..."
          : photosEnPreparation > 0
            ? "Préparation des photos…"
            : inscription
              ? "Créer mon compte"
              : connecte
                ? "Postuler"
                : "Créer mon compte et postuler"}
      </Button>

      <p className="text-center text-xs text-text-muted">
        {inscription ? "Créer un compte et candidater est" : "Candidater est"} gratuit — aucune somme d&apos;argent ni
        aucun document de paie ne vous sera jamais demandé sur Booking Extras.
      </p>

      <p className="text-center text-xs text-text-muted">
        Les informations de ce formulaire (dont vos photos) sont destinées à l&apos;équipe de casting Booking Extras
        pour étudier votre candidature et vous recontacter si votre profil correspond à un tournage. Elles sont
        conservées 2 ans maximum sans nouveau contact, puis supprimées. Vous pouvez à tout moment demander à les
        consulter, les corriger ou les supprimer en écrivant à {CONTACT_RGPD_EMAIL}.{" "}
        <Link href="/confidentialite" target="_blank" className="text-coral hover:underline">
          En savoir plus →
        </Link>
      </p>
    </form>
    </PhotosContext.Provider>
  );
}
