import { createPrivateKey, createPublicKey, sign, verify, type JsonWebKey, type KeyObject } from "node:crypto";
import http2 from "node:http2";
import { env } from "./env.js";
import { logger } from "./logger.js";

/**
 * Ce que le serveur échange avec Apple, pour l'app iPhone/iPad et le site :
 *  - les notifications (APNs), envoyées avec un jeton signé par la clé .p8 ;
 *  - la connexion « Se connecter avec Apple » : vérifier le jeton d'identité
 *    (remis par iOS à l'app, ou renvoyé par Apple au site, lib/apple-web.ts),
 *    et pouvoir révoquer l'accès à la suppression d'un compte.
 *
 * Une seule clé .p8 sert aux deux (services APNs et Sign in with Apple cochés
 * sur la même clé). Elle arrive par l'environnement, en base64 pour tenir sur
 * une ligne du .env : APPLE_KEY_ID, APPLE_TEAM_ID, APPLE_PRIVATE_KEY.
 * Sans elle, la connexion Apple fonctionne encore (la vérification du jeton
 * n'utilise que les clés publiques d'Apple) ; seules les notifications et la
 * révocation sont désactivées.
 */

const BUNDLE_ID = env.APPLE_BUNDLE_ID;

let cle: KeyObject | null | undefined;
function clePrivee(): KeyObject | null {
  if (cle !== undefined) return cle;
  try {
    if (!env.APPLE_PRIVATE_KEY) return (cle = null);
    const brut = env.APPLE_PRIVATE_KEY.includes("BEGIN PRIVATE KEY")
      ? env.APPLE_PRIVATE_KEY.replace(/\\n/g, "\n")
      : Buffer.from(env.APPLE_PRIVATE_KEY, "base64").toString("utf8");
    cle = createPrivateKey(brut);
  } catch (err) {
    logger.error({ err }, "clé Apple illisible (APPLE_PRIVATE_KEY)");
    cle = null;
  }
  return cle;
}

/** Vrai quand la clé Apple est configurée : notifications iPhone et révocation possibles. */
export function cleAppleConfiguree(): boolean {
  return !!(env.APPLE_KEY_ID && env.APPLE_TEAM_ID && clePrivee());
}

const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");

/** Un jeton ES256 signé par la clé Apple (format exigé par APNs et par Sign in with Apple). */
function jetonSigne(charge: Record<string, unknown>): string {
  const k = clePrivee();
  if (!k || !env.APPLE_KEY_ID) throw new Error("Clé Apple non configurée");
  const corps = `${b64url({ alg: "ES256", kid: env.APPLE_KEY_ID })}.${b64url(charge)}`;
  return `${corps}.${sign("sha256", Buffer.from(corps), { key: k, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
}

// ------------------------------------------------------------- notifications

// Le jeton d'APNs vaut une heure ; Apple refuse qu'on en change plus d'une fois
// toutes les vingt minutes. On le garde cinquante minutes.
let jetonApns: { valeur: string; le: number } | null = null;
function jetonPourApns(): string {
  if (jetonApns && Date.now() - jetonApns.le < 50 * 60_000) return jetonApns.valeur;
  jetonApns = { valeur: jetonSigne({ iss: env.APPLE_TEAM_ID, iat: Math.floor(Date.now() / 1000) }), le: Date.now() };
  return jetonApns.valeur;
}

export interface NotificationApple {
  titre: string;
  texte: string;
  url?: string;
  /** Regroupe les notifications d'un même sujet (« thread » iOS). */
  fil?: string;
}

/** Résultat d'un envoi : « perime » demande d'oublier le jeton de l'appareil. */
export type EnvoiApns = "envoye" | "perime" | "echec";

let session: http2.ClientHttp2Session | null = null;
function connexionApns(): http2.ClientHttp2Session {
  if (session && !session.closed && !session.destroyed) return session;
  // Une version installée depuis TestFlight ou l'App Store utilise l'APNs de
  // production ; seule une app compilée en développement utilise le bac à sable.
  const hote = env.APNS_SANDBOX ? "https://api.sandbox.push.apple.com" : "https://api.push.apple.com";
  session = http2.connect(hote);
  session.on("error", (err) => { logger.warn({ err }, "connexion APNs perdue"); session = null; });
  session.on("close", () => { session = null; });
  session.unref();
  return session;
}

/** Envoie une notification à un appareil iOS. */
export function envoyerApns(jetonAppareil: string, n: NotificationApple): Promise<EnvoiApns> {
  return new Promise((resolve) => {
    let req: http2.ClientHttp2Stream;
    try {
      req = connexionApns().request({
        ":method": "POST",
        ":path": `/3/device/${jetonAppareil}`,
        authorization: `bearer ${jetonPourApns()}`,
        "apns-topic": BUNDLE_ID,
        "apns-push-type": "alert",
        "apns-priority": "10",
        ...(n.fil ? { "apns-collapse-id": n.fil.slice(0, 64) } : {}),
      });
    } catch (err) {
      logger.warn({ err }, "envoi APNs impossible");
      return resolve("echec");
    }
    let statut = 0;
    let corps = "";
    req.setEncoding("utf8");
    req.on("response", (h) => { statut = Number(h[":status"]); });
    req.on("data", (d) => { corps += d; });
    req.on("end", () => {
      if (statut === 200) return resolve("envoye");
      const raison = (() => { try { return (JSON.parse(corps) as { reason?: string }).reason; } catch { return undefined; } })();
      // 410 : l'app a été désinstallée ; jeton invalide ou d'un autre environnement.
      if (statut === 410 || raison === "BadDeviceToken" || raison === "Unregistered" || raison === "DeviceTokenNotForTopic") {
        return resolve("perime");
      }
      logger.warn({ statut, raison }, "notification APNs refusée");
      resolve("echec");
    });
    req.on("error", (err) => { logger.warn({ err }, "envoi APNs échoué"); resolve("echec"); });
    req.setTimeout(10_000, () => { req.close(); resolve("echec"); });
    req.end(JSON.stringify({
      aps: { alert: { title: n.titre, body: n.texte }, sound: "default", ...(n.fil ? { "thread-id": n.fil } : {}) },
      url: n.url ?? "/app/dashboard",
    }));
  });
}

// ---------------------------------------------------- Se connecter avec Apple

const EMETTEUR = "https://appleid.apple.com";

/**
 * Délai maximal d'un appel à Apple. Sans lui, un Apple lent gardait la requête
 * de connexion (ou de suppression du compte) ouverte aussi longtemps que le
 * réseau le voulait.
 */
const DELAI_APPLE_MS = 10_000;
const avecDelai = () => ({ signal: AbortSignal.timeout(DELAI_APPLE_MS) });

type CleApple = JsonWebKey & { kid?: string };
let clesPubliques: { cles: CleApple[]; le: number } | null = null;
let derniereLecture = 0;
let lectureEnCours: Promise<void> | null = null;

/** Relit la liste des clés d'Apple ; les appels simultanés attendent la même lecture. */
function lireClesApple(): Promise<void> {
  if (lectureEnCours) return lectureEnCours;
  derniereLecture = Date.now();
  lectureEnCours = (async () => {
    try {
      const r = await fetch(`${EMETTEUR}/auth/keys`, avecDelai());
      if (!r.ok) throw new Error(`clés publiques d'Apple indisponibles (${r.status})`);
      clesPubliques = { cles: ((await r.json()) as { keys: CleApple[] }).keys, le: Date.now() };
    } finally {
      lectureEnCours = null;
    }
  })();
  return lectureEnCours;
}

async function clePublique(kid: string): Promise<KeyObject> {
  const chercher = () => clesPubliques?.cles.find((k) => k.kid === kid);
  if (!clesPubliques) {
    await lireClesApple();
  } else {
    // Apple fait tourner ses clés : une clé inconnue, ou une liste vieille d'une
    // heure, fait relire la liste. Au plus une fois par minute : un jeton forgé
    // avec un kid inventé ne doit pas faire de chaque connexion un appel à Apple.
    const aRelire = !chercher() || Date.now() - clesPubliques.le > 3_600_000;
    if (aRelire && (lectureEnCours || Date.now() - derniereLecture > 60_000)) {
      // Apple injoignable : on garde la liste qu'on a.
      await lireClesApple().catch((err) => logger.warn({ err }, "relecture des clés Apple impossible"));
    }
  }
  const jwk = chercher();
  if (!jwk) throw new Error("clé de signature Apple inconnue");
  return createPublicKey({ key: jwk, format: "jwk" });
}

export interface IdentiteApple {
  /** Identifiant stable de la personne pour cette app. */
  sub: string;
  /** Peut être une adresse relais (@privaterelay.appleid.com). */
  email?: string;
  emailVerifie: boolean;
}

/** Ce que le jeton d'identité doit porter, au-delà de la signature d'Apple. */
export interface AttenduApple {
  /**
   * Son destinataire : l'app (APPLE_BUNDLE_ID, par défaut) ou, pour une
   * connexion depuis le site, l'identifiant de service (APPLE_SERVICES_ID).
   */
  audience?: string;
  /** Le nonce parti avec la demande (site) : le jeton doit porter le même. */
  nonce?: string;
}

/**
 * Vérifie le jeton d'identité de « Se connecter avec Apple » : signature
 * d'Apple, émetteur, destinataire (l'app, ou le site), expiration, et le nonce
 * quand la demande en portait un. Lève une erreur si quoi que ce soit cloche.
 */
export async function verifierJetonApple(jeton: string, attendu: AttenduApple = {}): Promise<IdentiteApple> {
  const audience = attendu.audience ?? BUNDLE_ID;
  const [e, c, s] = jeton.split(".");
  if (!e || !c || !s) throw new Error("jeton Apple mal formé");
  const entete = JSON.parse(Buffer.from(e, "base64url").toString("utf8")) as { alg?: string; kid?: string };
  if (entete.alg !== "RS256" || !entete.kid) throw new Error("algorithme de signature inattendu");
  const ok = verify("RSA-SHA256", Buffer.from(`${e}.${c}`), await clePublique(entete.kid), Buffer.from(s, "base64url"));
  if (!ok) throw new Error("signature Apple invalide");
  const charge = JSON.parse(Buffer.from(c, "base64url").toString("utf8")) as {
    iss?: string; aud?: string | string[]; exp?: number; sub?: string; email?: string; email_verified?: boolean | string;
    nonce?: string;
  };
  const destinataires = Array.isArray(charge.aud) ? charge.aud : [charge.aud];
  if (charge.iss !== EMETTEUR) throw new Error("émetteur inattendu");
  if (!destinataires.includes(audience)) throw new Error("jeton destiné à une autre app");
  if (!charge.exp || charge.exp * 1000 < Date.now()) throw new Error("jeton Apple expiré");
  if (!charge.sub) throw new Error("identifiant Apple absent");
  // Un jeton sans nonce, ou avec celui d'une autre demande, ne s'injecte pas
  // dans cette connexion-ci.
  if (attendu.nonce !== undefined && charge.nonce !== attendu.nonce) throw new Error("nonce du jeton Apple inattendu");
  return {
    sub: charge.sub,
    email: charge.email?.toLowerCase(),
    emailVerifie: charge.email_verified === true || charge.email_verified === "true",
  };
}

/**
 * Le secret du client auprès d'Apple : un jeton ES256 signé par la clé, dont
 * le sujet est l'identifiant du client (l'app ou l'identifiant de service).
 */
function secretClient(clientId: string): string {
  const t = Math.floor(Date.now() / 1000);
  return jetonSigne({ iss: env.APPLE_TEAM_ID, iat: t, exp: t + 300, aud: EMETTEUR, sub: clientId });
}

/** Une connexion depuis le site : l'identifiant de service et l'adresse de retour déclarés chez Apple. */
export interface ClientSiteApple {
  servicesId: string;
  retour: string;
}

/**
 * Un jeton se révoque avec l'identifiant du client qui l'a obtenu. Celui du
 * site est gardé avec ce préfixe, qui le dit sans colonne de plus en base ; un
 * jeton de l'app reste tel quel (ceux déjà gardés aussi).
 */
const PREFIXE_SITE = "site:";

/**
 * Échange le code d'autorisation remis à la connexion contre un jeton de
 * rafraîchissement. On ne s'en sert que pour le révoquer quand le compte est
 * supprimé, comme Apple le demande. Rend la valeur à garder (préfixée pour le
 * site), ou null si la clé n'est pas configurée ou qu'Apple refuse.
 */
export async function jetonDeRevocation(code: string, site?: ClientSiteApple): Promise<string | null> {
  if (!cleAppleConfiguree()) return null;
  const clientId = site?.servicesId ?? BUNDLE_ID;
  const r = await fetch(`${EMETTEUR}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: secretClient(clientId),
      code,
      grant_type: "authorization_code",
      // Apple l'exige quand la demande d'autorisation en portait une (le site).
      ...(site ? { redirect_uri: site.retour } : {}),
    }),
    ...avecDelai(),
  });
  if (!r.ok) {
    logger.warn({ statut: r.status, site: !!site }, "échange du code Apple refusé");
    return null;
  }
  const jeton = ((await r.json()) as { refresh_token?: string }).refresh_token;
  if (!jeton) return null;
  return site ? `${PREFIXE_SITE}${jeton}` : jeton;
}

/** Révoque l'accès de Diagly au compte Apple (suppression du compte), avec le client qui l'a obtenu. */
export async function revoquerApple(garde: string): Promise<void> {
  if (!cleAppleConfiguree()) return;
  const duSite = garde.startsWith(PREFIXE_SITE);
  const clientId = duSite ? env.APPLE_SERVICES_ID : BUNDLE_ID;
  if (!clientId) {
    logger.warn("révocation Apple impossible : jeton du site, mais APPLE_SERVICES_ID n'est plus configuré");
    return;
  }
  const r = await fetch(`${EMETTEUR}/auth/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: secretClient(clientId),
      token: duSite ? garde.slice(PREFIXE_SITE.length) : garde,
      token_type_hint: "refresh_token",
    }),
    ...avecDelai(),
  });
  if (!r.ok) logger.warn({ statut: r.status, site: duSite }, "révocation Apple refusée");
}
