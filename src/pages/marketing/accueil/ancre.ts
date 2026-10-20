import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * À l'arrivée sur une page du site, et à chaque changement d'ancre : descend
 * à l'ancre de l'adresse, ou remonte en haut s'il n'y en a pas. À appeler là
 * où les sections visées existent déjà (après un chargement différé).
 *
 * Sur une page pré-rendue (le HTML du build est encore affiché), on ne
 * remonte pas : le visiteur a peut-être déjà commencé à lire.
 */
export function useAncre() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    const id = decodeURIComponent(hash.slice(1))
    if (id) document.getElementById(id)?.scrollIntoView()
    else if (!document.getElementById('prerendu')) window.scrollTo(0, 0)
  }, [pathname, hash])
}

/**
 * La page vivante est prête : le HTML pré-rendu au build (scripts/prerendu.mjs),
 * affiché en attendant, s'efface, et l'application prend sa place, à la même
 * hauteur de lecture. Tant qu'il est là, l'application reste masquée
 * (index.css), pour que le visiteur ne voie ni sablier ni page vide.
 */
export function useFinDuPrerendu() {
  useEffect(() => {
    document.getElementById('prerendu')?.remove()
  }, [])
}
