/* eslint-disable react-refresh/only-export-components -- point d'entrée du rendu au build (scripts/prerendu.mjs), jamais rechargé à chaud */
import type { ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { Entete } from './pages/marketing/accueil/Entete'
import { Hero } from './pages/marketing/accueil/Hero'
import { PiedDePage, Sections } from './pages/marketing/accueil/Suite'
import { CorpsFonctionnalites } from './pages/marketing/accueil/PageFonctionnalites'
import { CorpsBlog } from './pages/marketing/blog/PageBlog'
import { CorpsArticle } from './pages/marketing/blog/PageArticle'
import { ARTICLES } from './pages/marketing/blog/articles'
import { TETE_ACCUEIL, TETE_BLOG, TETE_FONCTIONNALITES, teteArticle, type Tete } from './pages/marketing/seo'

/**
 * Le point d'entrée du rendu au build (scripts/prerendu.mjs) : chaque page
 * publique, rendue en HTML hors navigateur, avec sa tête.
 *
 * Les pages sont celles de l'application, sans leurs effets : l'accueil y
 * est composé d'un bloc, sans le chargement différé de sa suite, pour que
 * tout le texte soit dans le HTML. Les blocs qui apparaissent au défilement y
 * sont visibles d'emblée (pas d'IntersectionObserver hors navigateur).
 */

export interface PageARendre {
  /** Le fichier écrit dans dist/prerendu/. */
  fichier: string
  tete: Tete
  element: ReactNode
}

function AccueilEntier() {
  return (
    <div className="min-h-screen overflow-x-clip bg-white text-[#1d1d1f] antialiased">
      <Entete />
      <main id="contenu">
        <Hero />
        <Sections />
      </main>
      <PiedDePage />
    </div>
  )
}

export const PAGES: PageARendre[] = [
  { fichier: 'index.html', tete: TETE_ACCUEIL, element: <AccueilEntier /> },
  { fichier: 'fonctionnalites.html', tete: TETE_FONCTIONNALITES, element: <CorpsFonctionnalites /> },
  { fichier: 'blog.html', tete: TETE_BLOG, element: <CorpsBlog /> },
  ...ARTICLES.map((a) => ({ fichier: `blog/${a.slug}.html`, tete: teteArticle(a), element: <CorpsArticle article={a} /> })),
]

export function rendre(page: PageARendre): string {
  return renderToString(<StaticRouter location={page.tete.chemin}>{page.element}</StaticRouter>)
}

export { ARTICLES } from './pages/marketing/blog/articles'
export { QUESTIONS, PRIX_DIAGNOSTIC, PLUS, PRO, SEUIL_PLUS, SEUIL_PRO, ENGAGEMENT_MOIS, remise, francs, CONTACT } from './pages/marketing/accueil/contenu'
export { SITE, FONCTIONNALITES_CLES } from './pages/marketing/seo'
