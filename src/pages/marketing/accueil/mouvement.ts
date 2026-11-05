import { useSyncExternalStore } from 'react'

const MOUVEMENT_REDUIT = '(prefers-reduced-motion: reduce)'

/**
 * Vrai si le système demande moins de mouvement : le héros pose l'écran
 * d'emblée, les scènes des fonctionnalités restent sur leur image finale.
 * Faux au pré-rendu.
 */
export function useMouvementReduit() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(MOUVEMENT_REDUIT)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(MOUVEMENT_REDUIT).matches,
    () => false,
  )
}
