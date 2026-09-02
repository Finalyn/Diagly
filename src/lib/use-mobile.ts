import { useSyncExternalStore } from 'react'

// Mobile = le téléphone, sous le breakpoint md (768px). Au-dessus, y compris une
// tablette en portrait, l'app complète s'affiche avec sa barre latérale : sinon
// tourner l'iPad faisait basculer d'une application à l'autre.
const QUERY = '(max-width: 767px)'

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
