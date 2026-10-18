import { ArrowRightLeft, Hash, ListChecks, WifiOff } from 'lucide-react'
import { Maquette } from '../ui'
import { Tablette, Telephone } from '../maquettes/Appareils'
import { EcranCompteur, EcranParcours } from '../maquettes/EcranTerrain'
import { EnTeteSection, Fonctionnalite, Point } from './blocs'

/**
 * Le relevé sur le terrain : le parcours par étapes sur iPad, le compteur au
 * palier sur iPhone. Ce que la section promet est ce que fait l'éditeur de
 * relevé, rien de plus : le Guide IA propose, l'utilisateur applique.
 */

export function Releve() {
  return (
    <Fonctionnalite
      id="releve"
      labelledBy="titre-releve"
      inverse
      texte={
        <>
          <EnTeteSection
            id="titre-releve"
            surtitre="Le relevé sur le terrain"
            titre="Sur place, l’iPad vous mène d’un ouvrage à l’autre."
            chapo="Les ouvrages sont rangés dans l’ordre de la visite, de la façade aux aménagements extérieurs. Pour chacun : une photo, l’état constaté, puis « Suivant »."
          />
          <div className="mt-10 grid gap-7">
            <Point icone={ListChecks} titre="L’état, avec ses travaux">
              Très bon, bon, moyen ou mauvais : chaque état affiche le constat type et les travaux qu’il engage, tirés de votre base. La priorité en découle.
            </Point>
            <Point icone={ArrowRightLeft} titre="Présent ou absent">
              Devant un ouvrage pas encore relevé, « Suivant » demande s’il existe dans le bâtiment. Absent, on passe sans rien créer.
            </Point>
            <Point icone={Hash} titre="Compter ce qu’on a devant soi">
              Six portes palières comptées sur les plans ? Au palier, vous touchez plus ou moins : 2/6 en bois, 4/6 en métal.
            </Point>
            <Point ia titre="Le Guide IA">
              Il analyse la photo, dit ce qu’il voit, vérifie la cohérence avec le code CFC et propose un état, une priorité et une note. Vous appliquez, ou non.
            </Point>
            <Point icone={WifiOff} titre="Hors ligne">
              Au sous-sol, sans réseau : les relevés restent sur l’appareil et partent dès que le réseau revient.
            </Point>
          </div>
        </>
      }
      maquette={
        <Maquette description="Le relevé sur iPad : les sept étapes de la visite, la cage d’escalier en cours avec ses ouvrages et leur état, et la question « Cet élément est-il présent dans le bâtiment ? ». Sur iPhone, le compteur des portes palières en bois, 2 sur 6, et le bouton Suivant.">
          <div className="relative mx-auto max-w-[600px] pb-6 pr-[18%]">
            <Tablette><EcranParcours /></Tablette>
            <div className="absolute bottom-0 right-0 w-[36%]">
              <Telephone><EcranCompteur /></Telephone>
            </div>
          </div>
        </Maquette>
      }
    />
  )
}
