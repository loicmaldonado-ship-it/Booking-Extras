import { createHmac } from "node:crypto";
import { isIP } from "node:net";

export function authAttemptKeys(email: string, ip: string, secret: string) {
  const digest = (scope: string, value: string) => createHmac("sha256", secret).update(scope + "\0" + value).digest("hex");
  const account = email.trim().toLowerCase();
  return { p_account_hash: digest("account", account), p_ip_hash: digest("ip", ip), p_pair_hash: digest("pair", ip + "\0" + account) };
}

// Seul le proxy de la plateforme est digne de confiance. En local/autre hébergeur,
// les en-têtes fournis par le client ne donnent jamais une nouvelle fenêtre de quota.
export function trustedAuthIp(values: Pick<Headers, "get">, vercel: boolean): string {
  if (!vercel) return "unattributed";
  const ip = values.get("x-vercel-forwarded-for")?.trim() ?? "";
  if (!isIP(ip)) return "unattributed";
  return ip.includes(":") ? new URL(`http://[${ip}]/`).hostname.toLowerCase() : ip;
}
