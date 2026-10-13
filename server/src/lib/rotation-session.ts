/**
 * Rotation des jetons de rafraîchissement, et la minute de tolérance.
 *
 * Chaque rafraîchissement révoque le jeton présenté et en émet un nouveau. Si
 * la réponse se perd (réseau du terrain, onglet fermé, deux onglets qui
 * rafraîchissent ensemble), l'appareil n'a plus que l'ancien jeton : refusé
 * comme révoqué, il faisait perdre la session et le cache hors-ligne.
 *
 * Un jeton révoqué par une rotation garde donc la trace de celui qui l'a
 * remplacé (`replacedById`), et reste accepté pendant une minute, à condition
 * que la session qu'il a ouverte vive encore : une déconnexion ou un
 * changement de mot de passe révoquent sans remplacer, et coupent cette
 * tolérance. Passé la minute, un jeton remplacé est refusé comme avant.
 */

export const DELAI_GRACE_ROTATION_MS = 60_000;

/** Longueur maximale de la chaîne de remplacements suivie. */
const PROFONDEUR_MAX = 5;

/** Ce que la décision lit d'un jeton enregistré. */
export interface EtatJeton {
  revokedAt: Date | null;
  replacedById: string | null;
  expiresAt: Date;
}

export type ChargerJeton = (id: string) => Promise<EtatJeton | null>;

/** Révoqué par une rotation il y a moins d'une minute. */
export function dansLeDelaiDeGrace(jeton: EtatJeton, maintenant: Date): boolean {
  if (!jeton.revokedAt || !jeton.replacedById) return false;
  return maintenant.getTime() - jeton.revokedAt.getTime() <= DELAI_GRACE_ROTATION_MS;
}

/**
 * Suit les remplacements depuis `id` : vrai si l'on arrive à un jeton encore
 * valide. Un jeton révoqué sans remplaçant (déconnexion, mot de passe changé),
 * expiré ou introuvable arrête la chaîne : la session est close.
 */
export async function brancheVivante(id: string | null, charger: ChargerJeton, maintenant: Date): Promise<boolean> {
  let courant = id;
  for (let i = 0; i < PROFONDEUR_MAX && courant; i++) {
    const jeton = await charger(courant);
    if (!jeton || jeton.expiresAt.getTime() <= maintenant.getTime()) return false;
    if (!jeton.revokedAt) return true;
    courant = jeton.replacedById;
  }
  return false;
}

/** Un jeton déjà remplacé peut-il encore servir ? */
export async function rotationTolerable(jeton: EtatJeton, charger: ChargerJeton, maintenant = new Date()): Promise<boolean> {
  if (!dansLeDelaiDeGrace(jeton, maintenant)) return false;
  return brancheVivante(jeton.replacedById, charger, maintenant);
}
