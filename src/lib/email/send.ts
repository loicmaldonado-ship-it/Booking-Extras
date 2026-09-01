import "server-only";
import nodemailer from "nodemailer";

// Un transporteur par adresse d'expédition — la globale par défaut, plus une
// par projet ayant configuré sa propre boîte Gmail (voir projets/email.ts).
const transporters = new Map<string, ReturnType<typeof nodemailer.createTransport>>();

function getTransporter(user?: string | null, pass?: string | null) {
  const resolvedUser = user || process.env.GMAIL_SMTP_USER;
  const resolvedPass = pass || process.env.GMAIL_SMTP_APP_PASSWORD;
  if (!resolvedUser || !resolvedPass) return null;

  const cached = transporters.get(resolvedUser);
  if (cached) return { transporter: cached, user: resolvedUser };

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: resolvedUser, pass: resolvedPass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  transporters.set(resolvedUser, transporter);
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
      attachments: options?.attachments,
    });
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur d'envoi." };
  }
}
