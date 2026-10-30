import "server-only";
import { communicationsDesactivees } from "@/lib/communications-test";
import nodemailer from "nodemailer";

// Un transporteur par adresse d'expédition — la globale par défaut, plus une
// par projet ayant configuré sa propre boîte Gmail (voir projets/email.ts).
const transporters = new Map<string, ReturnType<typeof nodemailer.createTransport>>();

// COM-01 (30/10/2026) : en mode test, les emails peuvent être CAPTURÉS par une boîte locale (Mailpit, fournie par
// `supabase start`) au lieu d'être jetés, pour relire leur contenu sans aucun secret de production. N'accepte qu'un
// hôte local ou privé : impossible d'envoyer vers un vrai serveur depuis le mode test.
function transporteurCapture(user?: string | null) {
  const url = process.env.BOOKING_TEST_SMTP_URL;
  if (!url) return null;
  let host: string;
  try { host = new URL(url).hostname; } catch { return null; }
  if (!/^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+)$/.test(host)) return null;
  const cached = transporters.get(`capture\u0000${url}`);
  const transporter = cached ?? nodemailer.createTransport({ url, ignoreTLS: true, connectionTimeout: 5_000 });
  transporters.set(`capture\u0000${url}`, transporter);
  return { transporter, user: user || process.env.GMAIL_SMTP_USER || "booking-test@example.test" };
}

function getTransporter(user?: string | null, pass?: string | null) {
  if (communicationsDesactivees()) return transporteurCapture(user);
  const resolvedUser = user || process.env.GMAIL_SMTP_USER;
  const resolvedPass = pass || process.env.GMAIL_SMTP_APP_PASSWORD;
  if (!resolvedUser || !resolvedPass) return null;

  // Clé = adresse + mot de passe : après un changement de mot de passe, une
  // fonction encore « chaude » ne doit pas réutiliser l'ancien.
  const cle = `${resolvedUser}\u0000${resolvedPass}`;
  const cached = transporters.get(cle);
  if (cached) return { transporter: cached, user: resolvedUser };

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: resolvedUser, pass: resolvedPass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  transporters.set(cle, transporter);
  return { transporter, user: resolvedUser };
}

export async function sendEmail(
  to: string,
  subject: string,
  text: string,
  credentials?: { user: string; pass: string } | null,
  options?: {
    cc?: string | null;
    attachments?: { filename: string; content: Buffer }[];
    html?: string;
  }
): Promise<{ error?: string }> {
  const resolved = getTransporter(credentials?.user, credentials?.pass);
  if (!resolved) return { error: "Envoi automatique non configuré." };

  try {
    await resolved.transporter.sendMail({
      from: resolved.user,
      to,
      cc: options?.cc || undefined,
      subject,
      text,
      html: options?.html,
      attachments: options?.attachments,
    });
    return {};
  } catch (error) {
    console.error(`[sendEmail] échec depuis ${resolved.user} :`, error instanceof Error ? error.message : error);
    return { error: messageErreurSmtp(error, resolved.user) };
  }
}

// Gmail refuse l'identification (535 / 534) : mot de passe d'application
// faux, révoqué (changement du mot de passe Google) ou validation en 2
// étapes désactivée.
function messageErreurSmtp(error: unknown, user: string) {
  const e = error as { code?: string; responseCode?: number; message?: string } | null;
  if (e?.code === "EAUTH" || e?.responseCode === 535 || e?.responseCode === 534) {
    return `Gmail refuse la connexion à ${user} : le mot de passe d'application est faux ou a été révoqué. Crée-en un nouveau sur myaccount.google.com/apppasswords et enregistre-le dans les réglages d'envoi.`;
  }
  return e?.message ?? "Erreur d'envoi.";
}

// Vérifie la connexion à la boîte (sans rien envoyer).
export async function verifierBoiteEnvoi(credentials?: { user: string; pass: string } | null): Promise<{ user?: string; error?: string }> {
  const resolved = getTransporter(credentials?.user, credentials?.pass);
  if (!resolved) return { error: "Aucune boîte d'envoi configurée." };
  try {
    await resolved.transporter.verify();
    return { user: resolved.user };
  } catch (error) {
    console.error(`[verifierBoiteEnvoi] échec pour ${resolved.user} :`, error instanceof Error ? error.message : error);
    return { user: resolved.user, error: messageErreurSmtp(error, resolved.user) };
  }
}
