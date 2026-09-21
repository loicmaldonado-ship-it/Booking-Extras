import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

// scrypt (intégré à Node, aucune dépendance à ajouter) plutôt que bcrypt —
// stocké comme "<sel hex>:<hash hex>", le sel généré par mot de passe.
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, storedHex] = hash.split(":");
  if (!salt || !storedHex) return false;
  const stored = Buffer.from(storedHex, "hex");
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  if (stored.length !== derived.length) return false;
  return timingSafeEqual(stored, derived);
}
