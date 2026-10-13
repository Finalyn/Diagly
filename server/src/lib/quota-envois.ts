/**
 * Le quota des courriels qu'un compte fait partir par le SMTP de Diagly.
 *
 * Les mails de visite et les demandes aux partenaires partent de l'adresse du
 * serveur, au nom de l'utilisateur. Sans plafond, un seul compte pouvait en
 * envoyer des milliers : le fournisseur SMTP bloque alors le compte entier, et
 * plus rien ne part, ni les invitations, ni les codes de double
 * authentification par email. Le plafond est large pour un usage normal (une
 * visite, c'est quelques mails) et court pour un envoi en masse.
 *
 * Tenu en mémoire : le serveur tourne en un seul processus (le planificateur
 * des notifications aussi). Un redémarrage remet les compteurs à zéro, ce qui
 * ne laisse passer, au pire, qu'un quota de plus.
 */

export interface LimiteEnvoi {
  /** La fenêtre glissante, en millisecondes. */
  fenetreMs: number;
  max: number;
  /** « par heure », « par jour » : pour le message d'erreur. */
  libelle: string;
}

const HEURE = 60 * 60_000;

export const LIMITES_ENVOI: readonly LimiteEnvoi[] = [
  { fenetreMs: HEURE, max: 30, libelle: "par heure" },
  { fenetreMs: 24 * HEURE, max: 100, libelle: "par jour" },
];

export type Verdict =
  | { ok: true }
  /** attenteMs : null quand l'envoi dépasse la limite à lui seul, et n'y entrera jamais. */
  | { ok: false; limite: LimiteEnvoi; attenteMs: number | null };

/**
 * Peut-on envoyer `nombre` courriels de plus, vu les envois passés ?
 *
 * `envois` : les instants (ms) des courriels déjà partis, un par
 * destinataire. Tout ou rien : un mail de visite ne part pas à la moitié de
 * ses destinataires.
 */
export function verifierQuota(
  envois: readonly number[],
  maintenant: number,
  nombre: number,
  limites: readonly LimiteEnvoi[] = LIMITES_ENVOI,
): Verdict {
  for (const limite of limites) {
    if (nombre > limite.max) return { ok: false, limite, attenteMs: null };
    const recents = envois.filter((t) => t > maintenant - limite.fenetreMs).sort((a, b) => a - b);
    const enTrop = recents.length + nombre - limite.max;
    if (enTrop > 0) {
      // Il faut attendre que les `enTrop` plus anciens sortent de la fenêtre.
      return { ok: false, limite, attenteMs: recents[enTrop - 1] + limite.fenetreMs - maintenant };
    }
  }
  return { ok: true };
}

/** Le refus en une phrase, avec ce qu'on peut faire à la place. */
export function messageDeQuota(v: Extract<Verdict, { ok: false }>, nombre: number): string {
  const plafond = `${v.limite.max} emails ${v.limite.libelle}`;
  if (v.attenteMs === null) {
    return `Ce mail compte ${nombre} destinataires, au-delà des ${plafond} que Diagly peut envoyer pour vous. Ouvrez-le dans votre messagerie pour l'envoyer.`;
  }
  return `Limite d'envoi atteinte : ${plafond} depuis Diagly. Réessayez ${dansCombien(v.attenteMs)}, ou ouvrez le mail dans votre messagerie.`;
}

/** « dans 12 minutes », « dans 3 heures ». */
function dansCombien(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  if (minutes < 60) return `dans ${minutes} minute${minutes > 1 ? "s" : ""}`;
  const heures = Math.ceil(minutes / 60);
  return `dans ${heures} heure${heures > 1 ? "s" : ""}`;
}

/** Les envois de chaque compte, sur la plus longue fenêtre. */
export class QuotaEnvois {
  private readonly envois = new Map<string, number[]>();
  private readonly fenetreMax: number;

  constructor(private readonly limites: readonly LimiteEnvoi[] = LIMITES_ENVOI) {
    this.fenetreMax = Math.max(...limites.map((l) => l.fenetreMs));
  }

  /**
   * Réserve `nombre` envois pour ce compte, ou dit pourquoi c'est refusé.
   *
   * La réservation est faite avant l'envoi, sans attente entre la vérification
   * et l'écriture : deux requêtes lancées en même temps ne passent pas toutes
   * les deux sous le plafond. Un envoi qui échoue compte quand même : c'est
   * le serveur SMTP qui l'a reçu.
   */
  reserver(compte: string, nombre: number, maintenant = Date.now()): Verdict {
    const passes = (this.envois.get(compte) ?? []).filter((t) => t > maintenant - this.fenetreMax);
    const verdict = verifierQuota(passes, maintenant, nombre, this.limites);
    if (verdict.ok) for (let i = 0; i < nombre; i++) passes.push(maintenant);
    if (passes.length) this.envois.set(compte, passes);
    else this.envois.delete(compte);
    return verdict;
  }
}

/** Le quota partagé par toutes les routes qui envoient au nom d'un utilisateur. */
export const quotaEnvois = new QuotaEnvois();
