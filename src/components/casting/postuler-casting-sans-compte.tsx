"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { GENRES } from "@/lib/figurants/types";
import { postulerCastingSansCompte } from "@/lib/casting/rejoindre-actions";

// Identité minimale pour répondre à un casting sans créer de compte ; la
// suite (photos / vidéos) se fait sur la page d'envoi du rôle.
export function PostulerCastingSansCompte({ token }: { token: string }) {
  const [state, action, pending] = useActionState(postulerCastingSansCompte.bind(null, token), undefined);
  const champ = "flex flex-col gap-1 text-sm font-medium";
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={champ}>
          Prénom *
          <Input name="prenom" required autoComplete="given-name" disabled={pending} />
        </label>
        <label className={champ}>
          Nom *
          <Input name="nom" required autoComplete="family-name" disabled={pending} />
        </label>
        <label className={champ}>
          Email *
          <Input name="email" type="email" required autoComplete="email" disabled={pending} />
        </label>
        <label className={champ}>
          Téléphone *
          <Input name="telephone" type="tel" required autoComplete="tel" disabled={pending} />
        </label>
        <label className={champ}>
          Genre
          <Select name="genre" defaultValue="" disabled={pending}>
            <option value="">—</option>
            {GENRES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
        </label>
      </div>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Un instant…" : "Continuer : envoyer mes photos et vidéos →"}
      </Button>
    </form>
  );
}
