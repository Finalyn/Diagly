import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { env } from "./env.js";

/**
 * Garde-fou anti-SSRF pour les URL fournies par l'utilisateur (endpoints webhook).
 *
 * Sans ce controle, un compte peut faire emettre des requetes POST par le serveur vers
 * son propre reseau : `http://localhost:4000/api/...`, un service interne, ou l'API de
 * metadonnees d'un hebergeur cloud (169.254.169.254). Le serveur est dans le reseau
 * prive, pas l'attaquant : c'est toute la valeur de la manoeuvre.
 *
 * On verifie a la CREATION (retour d'erreur clair) et a nouveau AVANT CHAQUE ENVOI :
 * un nom de domaine public peut etre repointe vers 127.0.0.1 apres coup (DNS rebinding).
 */

/** Plages IPv4 non routables sur l'internet public. */
function isPrivateV4(ip: string): boolean {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true; // illisible = refuse
  const [a, b] = p;
  if (a === 0 || a === 10 || a === 127) return true; // "ce reseau", prive, loopback
  if (a === 169 && b === 254) return true; // link-local (metadonnees cloud)
  if (a === 172 && b >= 16 && b <= 31) return true; // prive
  if (a === 192 && b === 168) return true; // prive
  if (a === 192 && b === 0) return true; // reseaux reserves IETF
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast + reserve
  return false;
}

/** Equivalent IPv6 (loopback, link-local, unique-local, mappage IPv4). */
function isPrivateV6(ip: string): boolean {
  const v = ip.toLowerCase().split("%")[0]; // enleve l'eventuel scope (fe80::1%eth0)
  if (v === "::" || v === "::1") return true;
  if (v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb")) return true; // link-local
  if (v.startsWith("fc") || v.startsWith("fd")) return true; // unique-local
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v); // IPv4 encapsulee
  if (mapped) return isPrivateV4(mapped[1]);
  return false;
}

export function isPrivateAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return isPrivateV4(ip);
  if (kind === 6) return isPrivateV6(ip);
  return true; // pas une IP = on refuse
}

export class UnsafeUrlError extends Error {}

/**
 * Valide qu'une URL est publiquement joignable et sans danger a appeler depuis le serveur.
 * Resout le DNS : toutes les adresses du nom doivent etre publiques.
 * En developpement, localhost reste autorise (tests avec un receveur local).
 */
export async function assertPublicHttpUrl(raw: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("URL invalide.");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new UnsafeUrlError("Seules les URL http(s) sont acceptees.");
  }
  if (env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Une URL https est requise (le contenu transite en clair sinon).");
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError("Les identifiants dans l'URL ne sont pas acceptes.");
  }

  const host = url.hostname.replace(/^\[|\]$/g, ""); // IPv6 litterale : [::1] -> ::1
  const localDev = env.NODE_ENV !== "production" && /^(localhost|127\.0\.0\.1|::1)$/.test(host);
  if (localDev) return;

  if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(host)) {
    throw new UnsafeUrlError("Cette adresse n'est pas joignable depuis l'internet public.");
  }

  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new UnsafeUrlError("Adresse IP privee ou reservee non autorisee.");
    return;
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new UnsafeUrlError("Nom de domaine introuvable.");
  }
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new UnsafeUrlError("Ce domaine pointe vers une adresse privee ou reservee.");
  }
}
