import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Apparition, Conteneur, FOCUS, Surtitre, TitreSection } from './ui'
import { Parcours } from './sections/Parcours'
import { Metres } from './sections/Metres'
import { Demarrer } from './sections/Demarrer'
import { Releve } from './sections/Releve'
import { Chiffrage } from './sections/Chiffrage'
import { Rapports } from './sections/Rapports'
import { Assistant } from './sections/Assistant'
import { AppMobile } from './sections/AppMobile'
import { Confiance } from './sections/Confiance'
import { Tarifs } from './sections/Tarifs'
import { Questions } from './sections/Questions'
import { AppelFinal, PiedDePage } from './sections/Fin'

/**
 * Tout ce qui suit le héros, chargé à part : le haut de la page s'affiche
 * sans attendre ces maquettes, qui arrivent pendant qu'on lit le titre.
 */

const SOMMAIRE = [
  ['Métrés IA', '#metres'], ['Démarrer', '#demarrer'], ['Relevé', '#releve'],
  ['Chiffrage', '#chiffrage'], ['Rapports', '#rapports'], ['Assistant et API', '#assistant'],
] as const

export function Sections() {
  // Arrivé par une adresse avec ancre (/#tarifs), le navigateur a cherché la
  // section avant qu'elle existe : on y va une fois la suite affichée.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1))
    if (id) document.getElementById(id)?.scrollIntoView()
  }, [])

  return (
    <>
      <Parcours />
      <div id="fonctionnalites" className="scroll-mt-16 bg-white pt-20 sm:pt-28">
        <Conteneur>
          <Apparition className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <Surtitre>Fonctionnalités</Surtitre>
            <TitreSection>Tout le diagnostic, du bureau au chantier.</TitreSection>
            <nav aria-label="Fonctionnalités" className="mt-8">
              <ul className="flex flex-wrap justify-center gap-2">
                {SOMMAIRE.map(([libelle, href]) => (
                  <li key={href}>
                    <a href={href} className={cn('inline-flex min-h-11 items-center rounded-full bg-[#f5f7fa] px-4 text-[14px] font-medium text-[#1d1d1f] ring-1 ring-black/[0.05] transition-colors hover:bg-[#eef5ff] hover:text-[#0167EA]', FOCUS)}>
                      {libelle}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </Apparition>
        </Conteneur>
      </div>
      <Metres />
      <Demarrer />
      <Releve />
      <Chiffrage />
      <Rapports />
      <Assistant />
      <AppMobile />
      <Confiance />
      <Tarifs />
      <Questions />
      <AppelFinal />
    </>
  )
}

export { PiedDePage }
