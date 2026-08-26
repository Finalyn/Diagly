import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "./env.js";

/**
 * Jetons d'acces aux fichiers de /uploads (plans, captures de support).
 *
 * Les fichiers sont servis en statique : sans jeton, quiconque connait le nom UUID
 * peut les telecharger, indefiniment et sans compte. Le lien n'est plus devinable ET
 * plus permanent : seule une reponse d'API authentifiee en delivre un, et il expire.
 *
 * Duree longue (30 jours) : l'app est hors-ligne sur le terrain, un plan mis en cache
 * doit rester lisible dans un sous-sol. La liste des plans est rafraichie a chaque
 * passage en ligne, donc les jetons se renouvellent tout seuls.
 */
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const secret = () => env.API_KEY_PEPPER ?? env.JWT_ACCESS_SECRET;

function sign(fileName: string, exp: number): string {
  return createHmac("sha256", secret()).update(`${fileName}:${exp}`).digest("base64url").slice(0, 32);
}

/** `plan.pdf` -> `/uploads/plan.pdf?t=<exp>.<signature>` */
export function signUploadPath(fileName: string): string {
  const exp = Date.now() + TTL_MS;
  return `/uploads/${encodeURIComponent(fileName)}?t=${exp}.${sign(fileName, exp)}`;
}

/** Signe un chemin deja stocke (`/uploads/x.png`, avec ou sans jeton existant). */
export function signStoredPath(path: string): string {
  const fileName = path.replace(/^\/uploads\//, "").split("?")[0];
  return signUploadPath(fileName);
}

export function verifyUploadToken(fileName: string, token: string | undefined): boolean {
  if (!token) return false;
  const [expRaw, signature] = token.split(".");
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || !signature) return false;
  if (exp < Date.now()) return false;
  const expected = Buffer.from(sign(fileName, exp));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
