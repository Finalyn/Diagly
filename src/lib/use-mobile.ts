import { useSyncExternalStore } from 'react'

// Mobile = sous le breakpoint lg (1024px), là où la barre latérale est masquée.
const QUERY = '(max-width: 1023px)'

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
