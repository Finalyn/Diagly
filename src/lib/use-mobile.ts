import { useSyncExternalStore } from 'react'

// Mobile = le téléphone, sous le breakpoint md (768px). Au-dessus, y compris une
// tablette en portrait, l'app complète s'affiche avec sa barre latérale : sinon
// tourner l'iPad faisait basculer d'une application à l'autre.
//
// `screen and` n'est pas décoratif : sans lui, la requête est évaluée aussi sur le
// média impression, où la largeur de référence est celle de la page (A4 moins ses
// marges, soit ~660 px). L'app se croyait donc sur mobile pendant l'impression, et
// la garde mobile d'AppLayout quittait la page pour la liste des diagnostics — les
// rapports, réservés au desktop, ne s'imprimaient jamais. La notion de mobile est
// une notion d'écran ; sur papier elle n'a pas de sens.
const QUERY = 'screen and (max-width: 767px)'

/** Vrai sur écran mobile/tablette (largeur < lg). Réagit au redimensionnement. */
export function useIsMobile() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(QUERY)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(QUERY).matches,
    () => false,
  )
}

// Tablette = un écran tactile assez large pour l'app complète (iPad, à la
// verticale comme à l'horizontale). Le pointeur grossier la distingue d'un
// ordinateur à la même largeur : sur iPad, l'éditeur du relevé passe à un
// panneau à la fois, comme sur téléphone, et replie le menu de gauche.
const TABLETTE = 'screen and (min-width: 768px) and (pointer: coarse)'

export function useEstTablette() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(TABLETTE)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(TABLETTE).matches,
    () => false,
  )
}
