import { useEffect } from 'react'
import { SITE, type Tete } from './seo'

/**
 * La tête d'une page publique, mise à jour en arrivant sur la page : titre de
 * l'onglet, description, adresse canonique, carte de partage. Les données
 * structurées, elles, ne sont écrites qu'au build (scripts/prerendu.mjs) :
 * c'est là que les moteurs les lisent.
 *
 * En quittant la page, la tête d'avant revient : l'application garde le titre
 * qu'elle avait.
 */
export function useTete(tete: Tete) {
  useEffect(() => {
    const avant = { titre: document.title, metas: new Map<Element, string | null>() }
    document.title = tete.titre
    const url = `${SITE}${tete.chemin === '/' ? '/' : tete.chemin}`
    const poser = (selecteur: string, creer: () => HTMLElement, attribut: string, valeur: string) => {
      let el = document.head.querySelector(selecteur)
      if (!el) { el = creer(); document.head.appendChild(el) }
      avant.metas.set(el, el.getAttribute(attribut))
      el.setAttribute(attribut, valeur)
    }
    const meta = (cle: string, nom: string) => () => { const m = document.createElement('meta'); m.setAttribute(cle, nom); return m }
    poser('meta[name="description"]', meta('name', 'description'), 'content', tete.description)
    poser('link[rel="canonical"]', () => { const l = document.createElement('link'); l.rel = 'canonical'; return l }, 'href', url)
    poser('meta[property="og:title"]', meta('property', 'og:title'), 'content', tete.titre)
    poser('meta[property="og:description"]', meta('property', 'og:description'), 'content', tete.description)
    poser('meta[property="og:url"]', meta('property', 'og:url'), 'content', url)
    poser('meta[property="og:type"]', meta('property', 'og:type'), 'content', tete.type)
    poser('meta[name="twitter:title"]', meta('name', 'twitter:title'), 'content', tete.titre)
    poser('meta[name="twitter:description"]', meta('name', 'twitter:description'), 'content', tete.description)
    return () => {
      document.title = avant.titre
      for (const [el, valeur] of avant.metas) {
        if (valeur === null) el.remove()
        else el.setAttribute(el.tagName === 'LINK' ? 'href' : 'content', valeur)
      }
    }
  }, [tete])
}
