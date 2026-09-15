"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

// La session (issue du lien reçu par email) est déjà établie côté serveur
// avant même que cette page ne s'affiche — voir src/app/auth/confirm/route.ts
// et reset-password/page.tsx. Ce formulaire n'a donc qu'à changer le mot de
// passe sur la session déjà active, rien à échanger ici.
export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <p className="text-sm text-text-muted">Choisis ton nouveau mot de passe.</p>
        <Field label="Nouveau mot de passe" required>
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
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={pending || password.length < 6} className="mt-2">
          {pending ? "..." : "Changer mon mot de passe"}
        </Button>
      </form>
    </Card>
  );
}
