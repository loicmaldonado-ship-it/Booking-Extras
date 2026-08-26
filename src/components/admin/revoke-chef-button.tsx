"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { revokeChefAccess, restoreChefAccess } from "@/lib/admin/actions";

export function RevokeChefButton({ chefId, revoked }: { chefId: string; revoked: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    if (!revoked && !confirm("Révoquer l'accès de cette cheffe ? Elle ne pourra plus se connecter.")) return;
    startTransition(async () => {
      if (revoked) await restoreChefAccess(chefId);
      else await revokeChefAccess(chefId);
      router.refresh();
    });
  }

  return (
    <Button type="button" variant={revoked ? "secondary" : "ghost"} disabled={pending} onClick={toggle}>
      {pending ? "..." : revoked ? "Réactiver l'accès" : "Révoquer l'accès"}
    </Button>
  );
}
