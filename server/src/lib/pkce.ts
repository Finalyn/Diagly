import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Connexion Google depuis l'app iPhone/iPad, façon PKCE (RFC 7636).
 *
 * Le retour vers l'app passe par l'adresse ch.diagly.app://, qu'une autre app
 * installée sur l'appareil peut déclarer elle aussi. Ce retour ne porte donc
 * plus de jetons : seulement un code à usage unique, valable une minute, qui ne
 * s'échange qu'avec le secret (« verifier ») resté dans l'app. L'empreinte de
 * ce secret (« challenge ») est partie avec la demande de connexion : un code
 * intercepté ne sert à rien sans le secret.
 */

/** L'empreinte : SHA-256 en base64url sans « = », soit 43 caractères. */
const FORMAT_CHALLENGE = /^[A-Za-z0-9_-]{43}$/;
/** Le secret : 43 à 128 caractères non réservés (RFC 7636, section 4.1). */
const FORMAT_VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;

export const challengeValide = (c: unknown): c is string => typeof c === "string" && FORMAT_CHALLENGE.test(c);
export const verifierValide = (v: unknown): v is string => typeof v === "string" && FORMAT_VERIFIER.test(v);

/** L'empreinte d'un secret, calculée comme l'app le fait (ConnexionPlugin.swift). */
export function challengeDe(verifier: string): string {
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}

/** Vrai quand le secret présenté est celui dont l'empreinte est partie avec la demande. */
export function verifierCorrespond(verifier: string, challenge: string): boolean {
  if (!verifierValide(verifier) || !challengeValide(challenge)) return false;
  const a = Buffer.from(challengeDe(verifier));
  const b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Durée de vie d'un code : l'app l'échange dans la seconde qui suit le retour. */
export const DUREE_CODE_MS = 60_000;

interface CodeEnAttente {
  userId: string;
  challenge: string;
  expire: number;
}

/**
 * Les codes en attente d'échange, gardés en mémoire du processus. La
 * production n'en fait tourner qu'un (pm2, DEPLOIEMENT.md), comme pour les
 * limites de débit ; plusieurs processus demanderaient une table.
 */
export class CodesDeConnexion {
  private readonly codes = new Map<string, CodeEnAttente>();

  constructor(
    private readonly duree = DUREE_CODE_MS,
    private readonly maximum = 10_000,
  ) {}

  /** Un code aléatoire, lié au compte et à l'empreinte du secret de l'app. */
  emettre(userId: string, challenge: string, maintenant = Date.now()): string {
    this.purger(maintenant);
    // Garde-fou mémoire : au-delà, le plus ancien code part.
    if (this.codes.size >= this.maximum) {
      const ancien = this.codes.keys().next().value;
      if (ancien !== undefined) this.codes.delete(ancien);
    }
    const code = randomBytes(32).toString("base64url");
    this.codes.set(code, { userId, challenge, expire: maintenant + this.duree });
    return code;
  }

  /**
   * Échange un code contre le compte, si le secret correspond. Le code est
   * consommé dès la première tentative, réussie ou non : il ne resservira pas.
   */
  echanger(code: string, verifier: string, maintenant = Date.now()): string | null {
    const attente = this.codes.get(code);
    if (!attente) return null;
    this.codes.delete(code);
    if (attente.expire < maintenant) return null;
    return verifierCorrespond(verifier, attente.challenge) ? attente.userId : null;
  }

  /** Nombre de codes gardés (pour les tests). */
  get taille(): number {
    return this.codes.size;
  }

  private purger(maintenant: number) {
    for (const [code, attente] of this.codes) {
      if (attente.expire < maintenant) this.codes.delete(code);
    }
  }
}
