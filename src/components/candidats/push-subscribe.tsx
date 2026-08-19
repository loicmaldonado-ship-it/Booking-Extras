"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { subscribeToPush, unsubscribeFromPush } from "@/lib/candidats/actions";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

type Status = "unsupported" | "denied" | "unsubscribed" | "subscribed" | "loading";

export function PushSubscribe() {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setStatus("denied");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (!cancelled) setStatus(existing ? "subscribed" : "unsubscribed");
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  async function subscribe() {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) return;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setStatus("denied");
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

    await subscribeToPush({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
    });
    setStatus("subscribed");
  }

  async function unsubscribe() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await unsubscribeFromPush(subscription.endpoint);
      await subscription.unsubscribe();
    }
    setStatus("unsubscribed");
  }

  if (status === "loading" || status === "unsupported") return null;

  if (status === "denied") {
    return (
      <p className="text-xs text-text-muted">
        Notifications bloquées par votre navigateur. Autorisez-les dans les réglages du site pour être alerté·e
        des nouveaux messages.
      </p>
    );
  }

  if (status === "subscribed") {
    return (
      <div className="flex items-center justify-between gap-2 text-xs text-text-muted">
        <span>🔔 Notifications activées sur cet appareil.</span>
        <button type="button" onClick={unsubscribe} className="text-coral hover:underline">
          Désactiver
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-ink-raised px-4 py-3">
      <p className="text-sm text-text-muted">Recevez une notification sur ce téléphone dès qu&apos;on vous écrit.</p>
      <Button type="button" variant="secondary" onClick={subscribe}>
        Activer
      </Button>
    </div>
  );
}
