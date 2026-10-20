import { lazy, Suspense } from 'react'
import { rechargerUneFois } from '@/lib/rechargement'
import { Entete } from './Entete'
import { Hero } from './Hero'
import { TETE_ACCUEIL } from '../seo'
import { useTete } from '../tete'

/**
 * La page d'accueil publique, diagly.ch.
 *
 * Elle se lit de haut en bas comme un dossier se traite : les plans, les
 * métrés, la visite, le chiffrage, le rapport. Les écrans montrés sont de
 * vraies captures de l'application, prises sur le dossier d'exemple
 * Résidence Les Tilleuls (aucune donnée de client) : le haut de l'accueil
 * dans le héros, puis l'application page par page sur iPad. Le plan de
 * « Tout commence par un plan », animé, et les iPhone de la section App
 * restent dessinés en code.
 *
 * Le haut de la page (barre, titre, appareils) arrive seul ; le reste est un
 * second paquet, demandé dès que ce module s'exécute, pour que le titre ne
 * l'attende pas. Dans l'app iPhone et iPad, « / » mène à l'application : la
 * page ne concerne que le web.
 */

const chargerSuite = () => import('./Suite').catch((err) => rechargerUneFois(err))
const suite = chargerSuite()
const Sections = lazy(() => suite.then((m) => ({ default: m.Sections })))
const PiedDePage = lazy(() => suite.then((m) => ({ default: m.PiedDePage })))

export function Accueil() {
  useTete(TETE_ACCUEIL)
  return (
    <div className="min-h-screen overflow-x-clip bg-white text-[#1d1d1f] antialiased">
      <Entete />
      <main id="contenu">
        <Hero />
        {/* La place de la suite est réservée : la barre de défilement ne saute pas à son arrivée. */}
        <Suspense fallback={<div className="min-h-[200vh]" />}>
          <Sections />
        </Suspense>
      </main>
      <Suspense fallback={null}>
        <PiedDePage />
      </Suspense>
    </div>
  )
}
