import { CalendarRange, Database, GitCompare, Sigma } from 'lucide-react'
import { Maquette } from '../ui'
import { EcranCouts } from '../maquettes/EcranCouts'
import { EnTeteSection, Fenetre, Fonctionnalite, Point } from './blocs'

/**
 * Le chiffrage : d'où vient chaque montant. La section ne parle que de ce que
 * calcule l'application, quantité fois prix de l'état, puis la cascade
 * honoraires, réserve et TVA, et ne promet aucune indexation.
 */
export function Chiffrage() {
  return (
    <Fonctionnalite
      id="chiffrage"
      labelledBy="titre-chiffrage"
      fond="gris"
      texte={
        <>
          <EnTeteSection
            id="titre-chiffrage"
            surtitre="Le chiffrage"
            titre="Chaque montant dit d’où il vient."
            chapo="La quantité du bâtiment, multipliée par le prix de l’état constaté, tiré de votre base CFC. Honoraires, réserve et TVA à 8,1 % s’ajoutent en cascade, et chaque ligne reste à vous."
          />
          <div className="mt-10 grid gap-7">
            <Point icone={Database} titre="Votre base de prix">
              Les articles CFC du bureau, avec un prix par état et les travaux qu’il engage. Elle s’édite, et chaque modification garde son auteur.
            </Point>
            <Point icone={Sigma} titre="Des quantités calculées">
              Façade, fenêtres, pièces d’eau : déduites des dimensions et des métrés. Une quantité reprise à la main n’est plus recalculée.
            </Point>
            <Point icone={GitCompare} titre="Des variantes comparées">
              Remplacez une ligne ou ajoutez un travail : chaque variante se compare au diagnostic de base.
            </Point>
            <Point icone={CalendarRange} titre="Des horizons de travaux">
              Priorités I, II et III, travaux rangés de 0 à 5 ans, de 5 à 10 ans et au-delà de 10 ans.
            </Point>
          </div>
        </>
      }
      maquette={
        <Maquette description="La page Coûts d’un dossier : les postes rangés par priorité I, II et III, chacun avec son code CFC, son état, sa quantité et son montant, et la synthèse avec honoraires de 12 %, réserve de 10 %, TVA à 8,1 % et total TTC.">
          <Fenetre largeur={1100} hauteur={790} adresse="diagly.ch/app/projects/couts">
            <EcranCouts />
          </Fenetre>
        </Maquette>
      }
    />
  )
}
