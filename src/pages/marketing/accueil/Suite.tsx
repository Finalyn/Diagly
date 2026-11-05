import { useAncre, useFinDuPrerendu } from './ancre'
import { ParDesPros } from './sections/ParDesPros'
import { Atouts } from './sections/Atouts'
import { Demo } from './sections/Demo'
import { Questions } from './sections/Questions'
import { PiedDePage } from './sections/Fin'

/**
 * Tout ce qui suit le héros, chargé à part : le haut de la page s'affiche
 * sans attendre ces maquettes, qui arrivent pendant qu'on lit le titre.
 *
 * L'accueil suit le modèle d'inview.ch, en clair. Sous le héros, dont
 * l'écran devient la vidéo de présentation (Hero.tsx) : ce que Diagly change
 * (imaginé par des pros du bâtiment, il ramène un diagnostic de trois jours
 * au temps de la visite), les principales fonctionnalités, puis la réservation d'une démo, que visent
 * tous les boutons « Réserver une démo », et les questions. Ni tarifs ni
 * blog : le tarif est présenté pendant la démo, le blog sert au référencement.
 * Le détail de chaque outil vit sur la page Fonctionnalités
 * (PageFonctionnalites.tsx).
 */
export function Sections() {
  // Arrivé par une adresse avec ancre (/#faq), le navigateur a cherché la
  // section avant qu'elle existe : on y va une fois la suite affichée.
  useAncre()
  // La suite est là : le HTML pré-rendu peut laisser la place à la page vivante.
  useFinDuPrerendu()

  return (
    <>
      <ParDesPros />
      <Atouts />
      <Demo />
      <Questions />
    </>
  )
}

export { PiedDePage }
