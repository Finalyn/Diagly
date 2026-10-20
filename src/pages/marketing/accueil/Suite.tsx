import { useAncre, useFinDuPrerendu } from './ancre'
import { QuEstCe } from './sections/QuEstCe'
import { Atouts } from './sections/Atouts'
import { Ressaisie } from './sections/Ressaisie'
import { AppIPhone } from './sections/AppIPhone'
import { Demo } from './sections/Demo'
import { Confiance } from './sections/Confiance'
import { Tarifs } from './sections/Tarifs'
import { Questions } from './sections/Questions'
import { AppelFinal, PiedDePage } from './sections/Fin'

/**
 * Tout ce qui suit le héros, chargé à part : le haut de la page s'affiche
 * sans attendre ces maquettes, qui arrivent pendant qu'on lit le titre.
 *
 * L'accueil vend : ce qu'est Diagly, ce qu'il fait pour vous (avec un lien
 * vers chaque fonctionnalité), la ressaisie qu'il vous évite, l'app, la
 * confiance, les tarifs, la réservation d'une démo, les questions et l'appel
 * final. Le détail de chaque
 * outil vit sur la page Fonctionnalités (PageFonctionnalites.tsx).
 */
export function Sections() {
  // Arrivé par une adresse avec ancre (/#tarifs), le navigateur a cherché la
  // section avant qu'elle existe : on y va une fois la suite affichée.
  useAncre()
  // La suite est là : le HTML pré-rendu peut laisser la place à la page vivante.
  useFinDuPrerendu()

  return (
    <>
      <QuEstCe />
      <Atouts />
      <Ressaisie />
      <AppIPhone />
      <Confiance />
      <Tarifs />
      <Demo />
      <Questions />
      <AppelFinal demoIci />
    </>
  )
}

export { PiedDePage }
