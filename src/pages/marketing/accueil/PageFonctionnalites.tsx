import { ArrowRight } from 'lucide-react'
import { Bouton } from './ui'
import { useAncre, useFinDuPrerendu } from './ancre'
import { TETE_FONCTIONNALITES } from '../seo'
import { useTete } from '../tete'
import { Entete } from './Entete'
import { Quadrillage } from './Hero'
import { Fonctionnalites } from './sections/Fonctionnalites'
import { AppelFinal, PiedDePage } from './sections/Fin'

/**
 * La page Fonctionnalités, /fonctionnalites : le détail de chaque outil.
 *
 * L'accueil vend et renvoie ici pour le détail ; cette page montre tout : le
 * titre de la page sur le fond quadrillé du héros, puis l'explorateur (les
 * grands titres à gauche, les iPad et les interfaces à droite), et l'appel
 * final. Le menu du haut et le pied de page sont ceux de l'accueil.
 *
 * Le titre de l'onglet, la description et l'adresse canonique viennent de
 * seo.ts ; au build, la page est aussi rendue en HTML (scripts/prerendu.mjs).
 */

export function PageFonctionnalites() {
  useTete(TETE_FONCTIONNALITES)
  useAncre()
  useFinDuPrerendu()
  return <CorpsFonctionnalites />
}

/** Le contenu de la page, sans effets : c'est aussi lui que le build rend en HTML. */
export function CorpsFonctionnalites() {
  return (
    <div className="min-h-screen overflow-x-clip bg-white text-[#1d1d1f] antialiased">
      <Entete />
      <main id="contenu">
        <section id="haut" aria-labelledby="titre-page" className="relative -mt-[72px] overflow-hidden bg-gradient-to-b from-[#f3f7fe] to-white pt-[72px]">
          <Quadrillage />
          <div className="relative mx-auto w-full max-w-[1200px] px-4 pb-6 pt-12 text-center sm:px-6 sm:pt-16 lg:px-8 lg:pt-20">
            <h1 id="titre-page" className="mx-auto max-w-[20ch] text-balance text-[clamp(2.25rem,5vw,3.75rem)] font-semibold leading-[1.08] tracking-[-0.035em] text-[#0b1f44]">
              Tout ce que fait Diagly, montré sur l’application
            </h1>
            <p className="mx-auto mt-5 max-w-[40rem] text-pretty text-[16px] leading-[1.6] text-[#4b5563] sm:text-[17px]">
              Du premier plan au rapport remis au client, chaque outil sur de vraies captures de Diagly. L’IA propose, vous décidez.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Bouton href="#demo" className="w-full px-6 sm:w-auto">
                Réserver une démo<ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Bouton>
              <Bouton to="/#tarifs" variante="contour" className="w-full px-6 sm:w-auto">Voir les tarifs</Bouton>
            </div>
          </div>
        </section>

        <Fonctionnalites />
        <AppelFinal demoIci />
      </main>
      <PiedDePage />
    </div>
  )
}
