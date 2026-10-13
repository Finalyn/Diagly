/**
 * Les essais de code de double authentification.
 *
 * Le ticket remis entre le mot de passe et le code est un JWT sans table : rien
 * n'empêchait d'y essayer des codes jusqu'à son expiration (dix minutes pour un
 * code par email), ni de le rejouer après un succès. On compte donc :
 *  - par ticket : cinq essais, puis le ticket ne sert plus ; un succès le
 *    consomme aussi ;
 *  - par compte : dix échecs par quart d'heure, tous tickets confondus, faute
 *    de quoi une nouvelle connexion redonnerait cinq essais à chaque fois.
 *
 * Gardé en mémoire du processus, comme les limites de débit : la production
 * n'en fait tourner qu'un (DEPLOIEMENT.md).
 */

export const ESSAIS_PAR_TICKET = 5;
export const ECHECS_PAR_COMPTE = 10;
export const FENETRE_COMPTE_MS = 15 * 60_000;

/** Pourquoi un essai est refusé avant même de lire le code. */
export type RefusEssai = "utilise" | "epuise" | "compte";

interface EtatTicket {
  essais: number;
  utilise: boolean;
  /** Expiration du ticket (ms) : au-delà, il est refusé de toute façon. */
  expire: number;
}

interface EtatCompte {
  echecs: number;
  depuis: number;
}

export class EssaisDeCode {
  private readonly tickets = new Map<string, EtatTicket>();
  private readonly comptes = new Map<string, EtatCompte>();

  constructor(
    private readonly parTicket = ESSAIS_PAR_TICKET,
    private readonly parCompte = ECHECS_PAR_COMPTE,
    private readonly fenetre = FENETRE_COMPTE_MS,
  ) {}

  /**
   * Réserve un essai avant de vérifier le code. Synchrone : deux requêtes
   * simultanées ne passent pas sur le même essai. null si l'essai est permis.
   */
  commencer(ticket: string, compte: string, expire: number, maintenant = Date.now()): RefusEssai | null {
    this.purger(maintenant);
    const t = this.tickets.get(ticket) ?? { essais: 0, utilise: false, expire };
    if (t.utilise) return "utilise";
    if (t.essais >= this.parTicket) return "epuise";
    if (this.compteBloque(compte, maintenant)) return "compte";
    t.essais++;
    this.tickets.set(ticket, t);
    return null;
  }

  /** Le code était faux. Rend le nombre d'essais qui restent sur ce ticket. */
  echec(ticket: string, compte: string, maintenant = Date.now()): number {
    const c = this.comptes.get(compte);
    if (!c || maintenant - c.depuis >= this.fenetre) this.comptes.set(compte, { echecs: 1, depuis: maintenant });
    else c.echecs++;
    const t = this.tickets.get(ticket);
    return t ? Math.max(0, this.parTicket - t.essais) : 0;
  }

  /**
   * Le code était bon : le ticket ne resservira plus, et les échecs du compte
   * sont oubliés. Faux si une requête simultanée l'a déjà utilisé.
   */
  reussite(ticket: string, compte: string, expire: number): boolean {
    const t = this.tickets.get(ticket);
    if (t?.utilise) return false;
    this.tickets.set(ticket, { essais: t?.essais ?? 1, utilise: true, expire });
    this.comptes.delete(compte);
    return true;
  }

  /** Le ticket peut-il encore servir (renvoi d'un code) ? */
  utilisable(ticket: string): boolean {
    const t = this.tickets.get(ticket);
    return !t || (!t.utilise && t.essais < this.parTicket);
  }

  /** Retire un ticket sans essai : un nouveau code l'a remplacé. */
  invalider(ticket: string, expire: number) {
    const t = this.tickets.get(ticket);
    this.tickets.set(ticket, { essais: t?.essais ?? 0, utilise: true, expire });
  }

  private compteBloque(compte: string, maintenant: number): boolean {
    const c = this.comptes.get(compte);
    return !!c && maintenant - c.depuis < this.fenetre && c.echecs >= this.parCompte;
  }

  private purger(maintenant: number) {
    for (const [cle, t] of this.tickets) if (t.expire < maintenant) this.tickets.delete(cle);
    for (const [cle, c] of this.comptes) if (maintenant - c.depuis >= this.fenetre) this.comptes.delete(cle);
  }
}
