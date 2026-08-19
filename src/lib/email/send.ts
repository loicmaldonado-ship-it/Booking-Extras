import "server-only";
import nodemailer from "nodemailer";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;
  const user = process.env.GMAIL_SMTP_USER;
  const pass = process.env.GMAIL_SMTP_APP_PASSWORD;
  if (!user || !pass) return null;

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transporter;
}

export async function sendEmail(to: string, subject: string, text: string): Promise<{ error?: string }> {
  const t = getTransporter();
  if (!t) return { error: "Envoi automatique non configuré." };

  try {
    await t.sendMail({ from: process.env.GMAIL_SMTP_USER, to, subject, text });
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Erreur d'envoi." };
  }
}
