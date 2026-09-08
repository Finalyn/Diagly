/**
 * Mouvement physique : ressorts, projection d'élan, résistance aux bords.
 *
 * Une transition CSS a une durée fixe et part de sa valeur cible. Elle convient à
 * un changement d'état, jamais à ce qu'on saisit au doigt : un élément attrapé en
 * plein vol doit pouvoir être rattrapé et inversé sans attendre la fin de sa course.
 * C'est ce qu'un ressort fait naturellement, parce qu'il part toujours de la valeur
 * affichée et porte une vitesse.
 *
 * Écrit ici plutôt qu'ajouté en dépendance : le besoin tient en quatre-vingts lignes,
 * et chaque paquet tiers est une surface de sécurité à maintenir.
 *
 * Les deux réglages sont ceux d'Apple, pas ceux d'un moteur physique :
 *   amortissement  1 = pas de dépassement, < 1 = rebond. On reste à 1 sauf si le
 *                  geste portait de l'élan.
 *   réponse        temps que met la valeur à rejoindre sa cible, en secondes. Ce
 *                  n'est pas une durée : le ressort n'en a pas.
 */

/** Réglages tirés des valeurs qu'Apple utilise dans ses propres interfaces. */
export const RESSORTS = {
  /** Déplacement, repositionnement : rien ne dépasse. */
  deplacement: { damping: 1, response: 0.4 },
  /** Feuille, panneau : un soupçon de rebond, le geste porte de l'élan. */
  panneau: { damping: 0.8, response: 0.3 },
  /** Retour après un lancer : le rebond est mérité. */
  lance: { damping: 0.8, response: 0.4 },
  /** Glissement libre après un lancer : on vise le point projeté, sans dépasser. */
  glisse: { damping: 1, response: 0.55 },
} as const

export interface SpringOptions {
  from: number
  to: number
  /** Vitesse de relâchement du doigt, en unités par seconde. */
  velocity?: number
  damping?: number
  response?: number
  onUpdate: (valeur: number) => void
  onRest?: () => void
}

export interface SpringHandle {
  /** Arrête le ressort là où il est. */
  stop(): void
  /**
   * Change la cible sans interrompre le mouvement. La vitesse courante est conservée :
   * c'est ce qui évite le mur au moment où un geste s'inverse.
   */
  retarget(to: number, velocity?: number): void
  /** Valeur affichée à cet instant : le point de départ d'une reprise. */
  readonly value: number
  readonly velocity: number
}

/** Le système demande-t-il de limiter les animations ? */
export function mouvementReduit(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

/**
 * Anime une valeur vers sa cible. Rend une poignée qui permet de l'attraper en vol.
 *
 * Sous mouvement réduit, la valeur rejoint sa cible immédiatement : le retour reste,
 * le déplacement disparaît.
 */
export function spring(o: SpringOptions): SpringHandle {
  const damping = o.damping ?? 1
  const response = o.response ?? 0.4

  let x = o.from
  let v = o.velocity ?? 0
  let cible = o.to
  let brut: number | null = null
  let precedent = 0

  if (mouvementReduit()) {
    o.onUpdate(cible)
    o.onRest?.()
    return { stop() {}, retarget(t) { cible = t; o.onUpdate(t) }, get value() { return cible }, get velocity() { return 0 } }
  }

  // Pulsation propre et coefficient d'amortissement, dérivés des deux réglages.
  const omega = (2 * Math.PI) / response
  const raideur = omega * omega
  const frottement = 2 * damping * omega

  const pas = (maintenant: number) => {
    // Un onglet en arrière-plan rend des écarts énormes : au-delà de deux images,
    // on plafonne, sinon l'intégration explose et la valeur part à l'infini.
    const dt = Math.min((maintenant - precedent) / 1000, 1 / 30)
    precedent = maintenant

    const acceleration = -raideur * (x - cible) - frottement * v
    v += acceleration * dt
    x += v * dt

    // Au repos : assez près et assez lent pour que l'œil ne voie plus rien bouger.
    if (Math.abs(x - cible) < 0.05 && Math.abs(v) < 0.05) {
      x = cible
      v = 0
      o.onUpdate(x)
      brut = null
      o.onRest?.()
      return
    }

    o.onUpdate(x)
    brut = requestAnimationFrame(pas)
  }

  precedent = performance.now()
  brut = requestAnimationFrame(pas)

  return {
    stop() {
      if (brut != null) cancelAnimationFrame(brut)
      brut = null
    },
    retarget(t, vitesse) {
      cible = t
      if (vitesse != null) v = vitesse
      if (brut == null) {
        precedent = performance.now()
        brut = requestAnimationFrame(pas)
      }
    },
    get value() { return x },
    get velocity() { return v },
  }
}

/**
 * Où le doigt allait-il ? Distance parcourue en plus, après le relâchement, par une
 * décélération exponentielle. C'est la même loi que l'inertie du défilement, et c'est
 * elle qui transforme une chiquenaude en lancer : on vise le point projeté, pas le
 * point où le doigt s'est levé.
 *
 * 0.998 donne la sensation d'un défilement normal, 0.99 quelque chose de plus sec.
 */
export function projeterElan(vitesse: number, decroissance = 0.998): number {
  return ((vitesse / 1000) * decroissance) / (1 - decroissance)
}

/**
 * Résistance au-delà d'une limite. Plus on tire loin, moins l'élément suit, sans
 * jamais s'arrêter net : un objet réel ralentit avant de s'immobiliser. Un arrêt
 * brutal se lit comme un blocage, une résistance continue se lit comme une fin.
 */
export function elastique(depassement: number, dimension: number, constante = 0.55): number {
  return (depassement * dimension * constante) / (dimension + constante * Math.abs(depassement))
}

/**
 * Mémoire courte des dernières positions, pour connaître la vitesse au relâchement.
 * Le dernier déplacement seul est trop bruité : on lisse sur une fenêtre de temps.
 */
export function suiviVitesse(fenetreMs = 100) {
  let points: { valeur: number; t: number }[] = []
  return {
    ajouter(valeur: number, t = performance.now()) {
      points.push({ valeur, t })
      const limite = t - fenetreMs
      while (points.length > 2 && points[0].t < limite) points.shift()
    },
    /** Unités par seconde. 0 si le doigt est resté immobile. */
    vitesse(): number {
      if (points.length < 2) return 0
      const a = points[0]
      const b = points[points.length - 1]
      const dt = (b.t - a.t) / 1000
      return dt > 0 ? (b.valeur - a.valeur) / dt : 0
    },
    reset() { points = [] },
  }
}

/**
 * Retour haptique. Réservé aux moments qui engagent : un état validé, une étape
 * terminée, une erreur. En mettre partout apprend à l'ignorer.
 */
export function vibrer(motif: 'leger' | 'succes' | 'erreur' = 'leger') {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return
  if (mouvementReduit()) return
  navigator.vibrate(motif === 'succes' ? [12, 40, 18] : motif === 'erreur' ? [30, 60, 30] : 10)
}
