import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";

/**
 * « Se connecter avec Apple » sur le site, sans le script d'Apple.
 *
 * Le navigateur part vers appleid.apple.com (GET /api/auth/apple/web), puis
 * Apple le renvoie par un formulaire POST (response_mode=form_post) sur
 * /api/auth/apple/web/retour, avec le code, le jeton d'identité, l'état et, à
 * la toute première connexion, le nom de la personne.
 *
 * Ce POST vient de appleid.apple.com : un cookie SameSite=Lax n'y est pas
 * joint. Le lien avec le navigateur qui a lancé la connexion (contre la CSRF
 * de connexion) passe donc par un cookie SameSite=None (Secure, HttpOnly, dix
 * minutes) qui porte un secret aléatoire, le « lien ». L'état envoyé à Apple
 * est signé par le serveur et ne porte que l'empreinte de ce lien, plus le
 * nonce : au retour, l'état doit être intact, récent, et correspondre au
 * cookie ; le jeton d'identité doit porter le nonce.
 *
 * Les fonctions de ce module sont pures (pas de base, pas d'environnement) :
 * routes/auth.ts leur passe la configuration.
 */

export const AUTORISATION_APPLE = "https://appleid.apple.com/auth/authorize";

/** Durée d'une demande : au-delà, le retour d'Apple est refusé. */
export const DUREE_DEMANDE_MS = 10 * 60_000;

const BUT = "apple-web";

/** L'adresse de retour à déclarer chez Apple, à partir de l'URL publique (APP_URL). */
export const adresseDeRetourApple = (urlPublique: string) =>
  `${urlPublique.replace(/\/+$/, "")}/api/auth/apple/web/retour`;

const empreinteDuLien = (lien: string) => createHash("sha256").update(lien, "utf8").digest("base64url");

export interface DemandeAppleWeb {
  /** L'adresse d'Apple vers laquelle rediriger le navigateur. */
  url: string;
  /** Le secret à poser dans le cookie du navigateur, jamais ailleurs. */
  lien: string;
}

/**
 * Prépare une connexion : l'adresse d'autorisation d'Apple et le lien à poser
 * en cookie. Les espaces des paramètres s'écrivent %20 (« code id_token »,
 * « name email »), comme dans la documentation d'Apple, plutôt qu'en « + ».
 */
export function demandeAppleWeb(o: { servicesId: string; retour: string; secret: string }): DemandeAppleWeb {
  const lien = randomBytes(32).toString("base64url");
  const nonce = randomBytes(24).toString("base64url");
  const state = jwt.sign({ purpose: BUT, l: empreinteDuLien(lien), o: nonce }, o.secret, {
    expiresIn: Math.floor(DUREE_DEMANDE_MS / 1000),
  });
  const parametres: Record<string, string> = {
    client_id: o.servicesId,
    redirect_uri: o.retour,
    response_type: "code id_token",
    response_mode: "form_post",
    scope: "name email",
    state,
    nonce,
  };
  const requete = Object.entries(parametres)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  return { url: `${AUTORISATION_APPLE}?${requete}`, lien };
}

/**
 * Vérifie l'état renvoyé par Apple contre le lien du cookie. Rend le nonce que
 * le jeton d'identité doit porter. Lève une erreur si l'état manque, a été
 * modifié, a expiré, vient d'une autre demande ou d'un autre navigateur.
 */
export function verifierEtatAppleWeb(state: string | undefined, lien: string | undefined, secret: string): { nonce: string } {
  if (!state) throw new Error("état absent");
  // Sans le cookie, rien ne relie ce retour au navigateur qui a lancé la connexion.
  if (!lien) throw new Error("cookie de connexion absent");
  const st = jwt.verify(state, secret, { algorithms: ["HS256"] }) as { purpose?: string; l?: string; o?: string };
  if (st.purpose !== BUT || !st.l || !st.o) throw new Error("état d'une autre demande");
  const a = Buffer.from(empreinteDuLien(lien));
  const b = Buffer.from(st.l);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("état lancé depuis un autre navigateur");
  return { nonce: st.o };
}

const nomPropre = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 100) : undefined);

/**
 * Le nom qu'Apple joint au tout premier passage seulement : le champ « user »,
 * du JSON ({"name":{"firstName","lastName"},"email"}). Borné comme à
 * l'inscription ; rien quand il manque ou ne se lit pas.
 */
export function nomDuPremierPassage(user: string | undefined): { firstName?: string; lastName?: string } {
  if (!user) return {};
  try {
    const nom = (JSON.parse(user) as { name?: { firstName?: unknown; lastName?: unknown } } | null)?.name;
    return { firstName: nomPropre(nom?.firstName), lastName: nomPropre(nom?.lastName) };
  } catch {
    return {};
  }
}
