"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { AvatarPresence } from "@/components/equipe/avatar-presence";
import { updateMyAvatar } from "@/lib/auth/avatar-actions";
import { updateMyProfile } from "@/lib/auth/profile-actions";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { CurrentProfile } from "@/lib/auth/session";

function ChangePasswordCard() {
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(false);

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password });

    setPending(false);
    if (error) {
      setError(error.message);
      return;
    }
    setPassword("");
    setSuccess(true);
  }

  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Mot de passe</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Nouveau mot de passe">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={6}
          />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        {success && <p className="text-sm text-turquoise">Mot de passe changé.</p>}
        <Button type="submit" disabled={pending || password.length < 6} className="w-full sm:w-auto">
          {pending ? "..." : "Changer mon mot de passe"}
        </Button>
      </form>
    </Card>
  );
}

export function MyProfileForm({ profile, gate }: { profile: CurrentProfile; gate?: boolean }) {
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);
  const [avatarState, avatarAction, avatarPending] = useActionState(updateMyAvatar, undefined);
  const [profileState, profileAction, profilePending] = useActionState(updateMyProfile, undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (avatarState?.success || profileState?.success) router.refresh();
  }, [avatarState, profileState, router]);

  function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    const fd = new FormData();
    fd.set("avatar", file);
    avatarAction(fd);
  }

  return (
    <div className="flex flex-col gap-6">
      {gate && (
        <Card className="border-coral/40 bg-coral/10">
          <p className="text-sm">
            Avant de continuer, complète ta fiche membre — photo, nom, prénom et téléphone sont obligatoires pour
            les chef·fes de casting.
          </p>
        </Card>
      )}

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Ta photo</h2>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => inputRef.current?.click()}>
            <AvatarPresence
              avatarUrl={preview ?? profile.avatarUrl}
              nom={profile.nom}
              email={profile.email}
              online={false}
              size={64}
              previewIsLocal={!!preview}
            />
          </button>
          <div className="flex flex-col gap-1">
            <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()} disabled={avatarPending}>
              {avatarPending ? "Envoi..." : "Changer ma photo"}
            </Button>
            {avatarState?.error && <p className="text-xs text-danger">{avatarState.error}</p>}
          </div>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Tes infos</h2>
        <form action={profileAction} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Prénom" required>
              <Input name="prenom" required defaultValue={profile.prenom ?? ""} />
            </Field>
            <Field label="Nom" required>
              <Input name="nom" required defaultValue={profile.nom ?? ""} />
            </Field>
            <Field label="Téléphone" required>
              <Input type="tel" name="telephone" required defaultValue={profile.telephone ?? ""} />
            </Field>
            <Field label="Email">
              <Input value={profile.email ?? ""} disabled />
            </Field>
          </div>
          {profileState?.error && <p className="text-sm text-danger">{profileState.error}</p>}
          {profileState?.success && <p className="text-sm text-turquoise">Enregistré.</p>}
          <Button type="submit" disabled={profilePending} className="w-full sm:w-auto">
            {profilePending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </form>
      </Card>

      <ChangePasswordCard />
    </div>
  );
}
