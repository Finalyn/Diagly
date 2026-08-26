import { randomToken, sha256 } from "./hash.js";
import { env } from "./env.js";

// Clés d'API publiques : format `dgly_live_<hex>`. Le secret n'est jamais stocké ;
// seul son hash sha256(pepper + clé) l'est. Le poivre retombe sur JWT_ACCESS_SECRET si non défini.
const PREFIX = "dgly_live_";
const pepper = () => env.API_KEY_PEPPER ?? env.JWT_ACCESS_SECRET;

export function mintApiKey() {
  const key = `${PREFIX}${randomToken(24)}`; // 48 hex chars
  return { key, tokenHash: sha256(pepper() + key), keyPrefix: key.slice(0, 16) };
}

export function hashApiKey(key: string) {
  return sha256(pepper() + key);
}

export function isApiKeyFormat(v: string | undefined): v is string {
  return typeof v === "string" && v.startsWith("dgly_");
}
