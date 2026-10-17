/**
 * Les lectures par l'IA qui durent plusieurs minutes, menées en tâche de fond.
 *
 * Lire un jeu de plans ou analyser un plan prend une à trois minutes. Une
 * requête qui attend aussi longtemps peut être coupée par le relais placé
 * devant le serveur en production, et la lecture serait payée puis perdue.
 * L'envoi répond donc tout de suite avec un numéro, et le navigateur demande
 * où en est la tâche jusqu'à ce qu'elle soit prête.
 *
 * Les tâches vivent en mémoire : le serveur tourne en un seul processus. Une
 * tâche non réclamée est oubliée au bout de trente minutes, et arrêtée si elle
 * tournait encore. Chacune appartient au compte qui l'a lancée : un autre
 * compte ne peut ni la suivre ni l'arrêter.
 *
 * Module sans base ni réseau : la démarche est commune à la lecture des plans
 * (routes/demarrage.ts) et à l'analyse d'un plan (routes/plans.ts), seuls les
 * messages changent.
 */
import { randomUUID } from "node:crypto";
import { HttpError, badRequest, notFound } from "./http-error.js";
import { logger } from "./logger.js";

interface Tache<T> {
  proprietaire: string;
  /** Ce sur quoi porte la tâche (un plan), pour qu'une autre ne la suive pas par erreur. */
  sujet: string | null;
  debut: number;
  abandon: AbortController;
  etat: "en_cours" | "prete" | "erreur";
  resultat?: T;
  erreur?: string;
}

export interface MessagesDesTaches {
  /** Quand le numéro ne mène à rien : expirée, réclamée ou d'un autre compte. */
  introuvable: string;
  /** Quand le compte a déjà une tâche du même genre en cours. */
  dejaEnCours: string;
  /** Quand la tâche échoue sans message prévu pour l'utilisateur. */
  echec: string;
  /** Libellé du journal. */
  journal: string;
}

export type SuiviDeTache<T> = { etat: "en_cours" } | { etat: "prete"; resultat: T };

export class TachesDeFond<T> {
  private taches = new Map<string, Tache<T>>();
  private readonly messages: MessagesDesTaches;
  private readonly oubliApres: number;
  private readonly maintenant: () => number;

  constructor(messages: MessagesDesTaches, options: { oubliApres?: number; maintenant?: () => number } = {}) {
    this.messages = messages;
    this.oubliApres = options.oubliApres ?? 30 * 60_000;
    this.maintenant = options.maintenant ?? Date.now;
  }

  private oublierLesVieilles(): void {
    for (const [id, t] of this.taches) {
      if (this.maintenant() - t.debut > this.oubliApres) { t.abandon.abort(); this.taches.delete(id); }
    }
  }

  /**
   * Lance une tâche et rend son numéro.
   *
   * Une seule tâche en cours par compte : chacune coûte, et une deuxième ne
   * ferait que doubler la première.
   */
  lancer(proprietaire: string, travail: (signal: AbortSignal) => Promise<T>, sujet: string | null = null): string {
    this.oublierLesVieilles();
    for (const t of this.taches.values()) {
      if (t.proprietaire === proprietaire && t.etat === "en_cours") throw badRequest(this.messages.dejaEnCours);
    }
    const id = randomUUID();
    const tache: Tache<T> = { proprietaire, sujet, debut: this.maintenant(), abandon: new AbortController(), etat: "en_cours" };
    this.taches.set(id, tache);
    void travail(tache.abandon.signal)
      .then((resultat) => {
        tache.etat = "prete";
        tache.resultat = resultat;
      })
      .catch((e: unknown) => {
        tache.etat = "erreur";
        tache.erreur = e instanceof HttpError ? e.message : this.messages.echec;
        if (!(e instanceof HttpError)) logger.warn({ err: e }, `${this.messages.journal} en échec`);
      });
    return id;
  }

  /**
   * Où en est la tâche. Prête ou en échec, elle est remise une fois puis
   * oubliée : son résultat n'a pas à rester en mémoire.
   */
  suivre(id: string, proprietaire: string, sujet: string | null = null): SuiviDeTache<T> {
    const t = this.taches.get(id);
    if (!t || t.proprietaire !== proprietaire || t.sujet !== sujet) throw notFound(this.messages.introuvable);
    if (t.etat === "en_cours") return { etat: "en_cours" };
    this.taches.delete(id);
    if (t.etat === "erreur") throw badRequest(t.erreur ?? this.messages.echec);
    return { etat: "prete", resultat: t.resultat as T };
  }

  /**
   * La dernière tâche que ce compte a lancée sur ce sujet et pas encore
   * réclamée, en cours ou prête. L'outil Métrés garde le numéro de chaque
   * tâche avec ses feuilles ; si l'onglet se ferme entre le lancement et
   * l'enregistrement de ce numéro, c'est par ici qu'il la retrouve, au lieu
   * d'en relancer (et d'en payer) une seconde.
   */
  derniere(proprietaire: string, sujet: string | null): string | null {
    this.oublierLesVieilles();
    let trouvee: string | null = null;
    let debut = -Infinity;
    for (const [id, t] of this.taches) {
      if (t.proprietaire === proprietaire && t.sujet === sujet && t.debut > debut) { trouvee = id; debut = t.debut; }
    }
    return trouvee;
  }

  /** Quitter l'écran pendant la tâche l'arrête : personne n'en lira le résultat. */
  arreter(id: string, proprietaire: string): void {
    const t = this.taches.get(id);
    if (t && t.proprietaire === proprietaire) { t.abandon.abort(); this.taches.delete(id); }
  }
}
