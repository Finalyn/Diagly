/**
 * Durée de vie de référence des ouvrages, et durée de vie résiduelle.
 *
 * Un état constaté dit ce que l'ouvrage vaut aujourd'hui ; il ne dit pas combien
 * de temps il lui reste. Deux façades en « état moyen » n'appellent pas la même
 * décision selon qu'elles ont douze ou trente-cinq ans. La durée résiduelle
 * rapproche l'année de pose de la durée de vie attendue pour ce type d'ouvrage :
 *
 *     résiduelle = (année de pose + durée de vie de référence) − année courante
 *
 * CADRE NORMATIF. La démarche suit la SIA 469 « Conservation des ouvrages », qui
 * pose la notion de durée d'utilisation d'un élément et sa surveillance. La norme
 * fixe le cadre, pas un barème universel : les valeurs ci-dessous sont celles que
 * le bureau applique, par position CFC à 3 chiffres.
 *
 * ⚠ Ces durées sont à valider par le bureau avant diffusion d'un rapport : elles
 * sont citées au client. Elles se corrigent toutes ici, en un seul endroit.
 */
import { cfcPositionCode } from './cfc'

/**
 * Prestations qui n'ont pas de durée de vie, et n'en auront jamais.
 *
 * Une durée de vie suppose un ouvrage incorporé au bâtiment, qui s'use. Un
 * échafaudage, une installation de chantier, un nettoyage, une démolition, un
 * relevé : ce sont des prestations, elles se consomment le jour où elles ont
 * lieu. Leur attribuer une durée de vie n'aurait aucun sens — et c'est ce qui
 * arrivait, puisque la table ci-dessous est indexée sur la position à 3 chiffres :
 * un échafaudage en 211.1 héritait des 80 ans de la maçonnerie.
 *
 * Les entrées peuvent être une position (« 287 ») ou un code complet (« 211.1 »)
 * quand seule une partie de la position est concernée.
 */
export const SANS_DUREE_DE_VIE = new Set([
  '101', '102', '103', '104', // relevés, études, gabarits
  '111', '112', '113',        // déblaiement, déconstruction, assainissement de site
  '121', '122',               // protection d'ouvrages, aménagements provisoires
  '151',                      // terrassements : un mouvement de terre, pas un ouvrage
  '211.0',                    // installation de chantier
  '211.1',                    // échafaudages
  '287',                      // nettoyage du bâtiment
])

/**
 * Durée de vie de référence, en années, par position CFC à 3 chiffres.
 * Un ouvrage absent de la table n'a pas de durée de référence : on ne devine pas.
 */
export const DUREE_VIE_PAR_CFC: Record<string, number> = {
  // Réseaux enterrés : posés une fois, ils s'usent comme le reste.
  '152': 50, // canalisations

  // Gros œuvre et structure : la durée de vie du bâtiment lui-même.
  '211': 80, // maçonnerie
  '213': 80, // constructions en béton
  '214': 80, // charpente bois
  '215': 50, // constructions métalliques, façades ventilées
  '216': 60, // façades en pierre naturelle ou artificielle

  // Enveloppe.
  '221': 30, // fenêtres et portes extérieures
  '222': 40, // ferblanterie
  '224': 50, // couverture de toiture
  '225': 30, // étanchéité, isolations spéciales
  '226': 35, // crépissage de façade, isolation périphérique
  '227': 12, // traitement des surfaces extérieures (peinture)
  '228': 25, // stores, volets, protections solaires

  // Techniques.
  '230': 30, // installations électriques, introduction
  '231': 30, // installations électriques à courant fort
  '233': 25, // lustrerie
  '236': 20, // courant faible, télécommunications
  '242': 20, // production de chaleur
  '243': 40, // distribution de chaleur
  '244': 25, // ventilation
  '245': 25, // climatisation
  '251': 40, // installations sanitaires, appareils
  '254': 40, // conduites sanitaires
  '258': 25, // agencement de cuisine

  // Aménagements intérieurs.
  '271': 40, // plâtrerie
  '272': 40, // ouvrages métalliques
  '273': 40, // menuiserie intérieure
  '281': 25, // revêtements de sol
  '282': 20, // revêtements de paroi
  '283': 30, // revêtements de plafond
  '285': 12, // traitement des surfaces intérieures (peinture)

  // Aménagements extérieurs.
  '421': 30, // jardinage, plantations
  '422': 30, // surfaces en dur
}

/**
 * Durée de vie de référence d'un ouvrage, en années.
 *
 * undefined pour une prestation de chantier, et pour tout ouvrage dont la position
 * n'est pas dans la table : mieux vaut ne rien afficher qu'un chiffre inventé.
 */
export function dureeVieDeReference(cfcCode: string | null | undefined): number | undefined {
  if (!cfcCode) return undefined
  const code = cfcCode.trim()
  const position = cfcPositionCode(code)
  // Le code complet d'abord : une exclusion peut ne viser qu'une partie de la position.
  if (SANS_DUREE_DE_VIE.has(code)) return undefined
  if (position && SANS_DUREE_DE_VIE.has(position)) return undefined
  return position ? DUREE_VIE_PAR_CFC[position] : undefined
}

export interface DureeVie {
  /** Durée de vie de référence retenue pour ce type d'ouvrage, en années. */
  reference: number
  /** Année de pose utilisée pour le calcul. */
  anneePose: number
  /** true si l'année de pose n'est pas relevée et vient de l'année de construction. */
  poseEstimee: boolean
  /** Années restantes ; 0 quand la durée de vie est dépassée. */
  residuelle: number
  /** Nombre d'années de dépassement, 0 si l'ouvrage est encore dans sa durée de vie. */
  depassement: number
  /** Part de la durée de vie déjà consommée, bornée à 1. */
  usure: number
}

/**
 * Durée de vie résiduelle d'un ouvrage.
 *
 * Sans année de pose relevée, on retombe sur l'année de construction du bâtiment :
 * un ouvrage d'origine est le cas courant, et le rapport le signale comme estimé
 * plutôt que de taire l'information. Sans l'une ni l'autre, on ne calcule rien.
 */
export function dureeVieResiduelle(
  ouvrage: { cfcCode: string | null | undefined; yearInstalled: number | null | undefined },
  contexte: { yearBuilt?: number | null; anneeCourante?: number },
): DureeVie | undefined {
  const reference = dureeVieDeReference(ouvrage.cfcCode)
  if (reference == null) return undefined

  const poseEstimee = ouvrage.yearInstalled == null
  const anneePose = ouvrage.yearInstalled ?? contexte.yearBuilt ?? null
  if (anneePose == null) return undefined

  const anneeCourante = contexte.anneeCourante ?? new Date().getFullYear()
  const fin = anneePose + reference
  const restant = fin - anneeCourante

  return {
    reference,
    anneePose,
    poseEstimee,
    residuelle: Math.max(restant, 0),
    depassement: Math.max(-restant, 0),
    usure: Math.min(Math.max((anneeCourante - anneePose) / reference, 0), 1),
  }
}

/** Phrase toute faite pour le rapport, ou null si le calcul n'est pas possible. */
export function phraseDureeVie(d: DureeVie | undefined): string | null {
  if (!d) return null
  const pose = `Posé en ${d.anneePose}${d.poseEstimee ? ' (année de construction, à confirmer)' : ''}`
  const duree = `durée de vie de référence ${d.reference} ans`
  const reste = d.depassement > 0
    ? `durée de vie dépassée de ${d.depassement} an${d.depassement > 1 ? 's' : ''}`
    : `durée de vie résiduelle ${d.residuelle} an${d.residuelle > 1 ? 's' : ''}`
  return `${pose} · ${duree} · ${reste}`
}
