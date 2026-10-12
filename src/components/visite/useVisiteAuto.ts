/**
 * Les visites qui se proposent d'elles-mêmes.
 *
 * Une aide qu'il faut aller chercher n'aide personne le premier jour : c'est à
 * la première arrivée sur un écran qu'on ne sait pas quoi en faire. Chaque
 * visite se propose donc une fois, au moment où l'écran qu'elle décrit
 * s'ouvre, et jamais plus : le magasin retient qu'elle l'a été, qu'on l'ait
 * suivie jusqu'au bout ou abandonnée au premier pas.
 *
 * La règle vit ici, et non dans les écrans concernés : trois pages n'ont pas à
 * savoir qu'une visite existe, et la liste des déclenchements se lit d'un coup.
 */

import { useEffect } from 'react'
import { useVisite } from '@/stores/visite'

/** Du plus précis au plus général : la première route qui correspond gagne. */
const DECLENCHEURS: { route: RegExp; visite: string }[] = [
  { route: /^\/app\/projects\/new$/, visite: 'creation' },
  // Un dossier s'ouvre sur son relevé : c'est là que se propose la visite du relevé.
  { route: /^\/app\/projects\/[^/]+\/diagnostic$/, visite: 'releve' },
  { route: /^\/app\/projects\/[^/]+(\/|$)/, visite: 'dossier' },
  { route: /^\/app\/(dashboard|projects)$/, visite: 'decouverte' },
]

/**
 * Le délai laisse l'écran se remplir : une visite qui cherche son bouton
 * pendant que la page charge ne le trouve pas et s'ouvre dans le vide.
 */
const DELAI = 1200

export function useVisiteAuto(pathname: string, actif: boolean) {
  const proposer = useVisite((s) => s.proposer)

  useEffect(() => {
    if (!actif) return
    const regle = DECLENCHEURS.find((d) => d.route.test(pathname))
    if (!regle) return
    const t = window.setTimeout(() => proposer(regle.visite), DELAI)
    return () => window.clearTimeout(t)
  }, [pathname, actif, proposer])
}
