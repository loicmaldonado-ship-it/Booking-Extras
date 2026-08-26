"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function AcceptInviteForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    async function establishSession() {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const invalidLinkMessage =
        "Lien d'invitation invalide ou expiré. Demande une nouvelle invitation au·à la chef·fe de casting.";

      if (!accessToken || !refreshToken) {
        setError(invalidLinkMessage);
        return;
      }

      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        setError(invalidLinkMessage);
      } else {
        setReady(true);
      }
    }

    establishSession();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setPending(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (error) {
    return (
      <Card>
        <p className="text-sm text-danger">{error}</p>
      </Card>
    );
  }

  if (!ready) {
    return (
      <Card>
        <p className="text-sm text-text-muted">Vérification de l&apos;invitation...</p>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-text-muted">Choisis ton mot de passe pour accéder à Booking Extras.</p>
        <Field label="Mot de passe" required>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={6}
            required
            autoFocus
          />
        </Field>
        <Button type="submit" disabled={pending || password.length < 6} className="mt-2">
          {pending ? "..." : "Créer mon accès"}
        </Button>
      </form>
    </Card>
  );
}
