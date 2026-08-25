"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AvatarPresence } from "@/components/equipe/avatar-presence";
import { updateMyAvatar } from "@/lib/auth/avatar-actions";
import type { CurrentProfile } from "@/lib/auth/session";

export function MyAvatarMenu({ profile }: { profile: CurrentProfile }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState(updateMyAvatar, undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.success) router.refresh();
  }, [state, router]);

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Ma photo">
        <AvatarPresence avatarUrl={preview ?? profile.avatarUrl} nom={profile.nom} email={profile.email} online={false} size={36} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 flex w-56 flex-col gap-2 rounded-xl border border-border bg-ink-raised-2 p-3 shadow-xl">
            <p className="text-xs text-text-muted">Ta photo de profil</p>
            {state?.error && <p className="text-xs text-danger">{state.error}</p>}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:border-coral/60"
              disabled={pending}
            >
              {pending ? "Envoi..." : "Changer ma photo"}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setPreview(URL.createObjectURL(file));
                setOpen(false);
                const fd = new FormData();
                fd.set("avatar", file);
                formAction(fd);
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
