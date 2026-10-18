import { CheckCheck, FileSpreadsheet, Hash, Layers, Ruler, ScanLine } from 'lucide-react'
import { Apparition, Conteneur, Echelle, Maquette } from '../ui'
import { typo } from '../typo'
import { DiapoReperage, DiapoTableau } from '../maquettes/Diapositives'
import { EcranTableau } from '../maquettes/EcranTableau'
import { EnTeteSection, Fenetre, Point } from './blocs'

/**
 * Les Métrés par l'IA, la fonctionnalité qui ouvre le parcours : ce que l'IA
 * lit sur chaque feuille, ce qu'elle dessine, et la règle qui rend le tout
 * utilisable, rien ne compte avant validation. Puis la présentation 16:9
 * qu'on en tire.
 */
export function Metres() {
  return (
    <section id="metres" aria-labelledby="titre-metres" className="scroll-mt-16 bg-white py-20 sm:py-28">
      <Conteneur>
        <div className="grid items-start gap-12 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-5">
            <EnTeteSection
              id="titre-metres"
              surtitre="Métrés par l’IA"
              titre="Déposez les plans. L’IA mesure, vous validez."
              chapo="Chaque feuille du jeu est lue : son numéro et son titre au cartouche, la vue, l’étage et les étages identiques qu’elle représente. L’échelle imprimée est contrôlée sur une cote avant d’être posée. Puis l’IA dessine les pièces, les façades et les fenêtres, et compte les portes et les autres éléments."
            />
          </div>
          <Apparition className="min-w-0 lg:col-span-7 lg:pt-10" delai={80}>
            <Maquette description="La vue Tableau des Métrés : chaque forme du jeu sur une ligne, avec sa feuille, son étage, sa quantité, son ouvrage CFC, sa catégorie SIA 416, sa confiance et son statut, validé ou à valider.">
              <Fenetre largeur={1200} hauteur={640} adresse="diagly.ch/app/metres">
                <EcranTableau />
              </Fenetre>
            </Maquette>
          </Apparition>
        </div>

        <div className="mt-16 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          <Point icone={CheckCheck} titre="Rien ne compte sans vous">
            Chaque forme proposée arrive « à valider », avec sa confiance et ce que disent les cotes. Elle n’entre dans les totaux qu’une fois validée, une à une ou en revue.
          </Point>
          <Point icone={Layers} titre="Les étages types multipliés">
            Une feuille marquée « × 3 étages » compte trois fois. Les quantités se lisent par classification, par étage, puis par forme.
          </Point>
          <Point icone={Ruler} titre="Surfaces SIA 416">
            SP, SN et SC par étage, la SN rangée en SUP, SUS, SD et SI d’après le nom des locaux. Affichées comme à vérifier, selon SIA 416:2003.
          </Point>
          <Point icone={Hash} titre="Les éléments comptés">
            Portes palières et intérieures, fenêtres, balcons, cuisines, appareils sanitaires : comptés sur les plans, puis reportés au dossier.
          </Point>
          <Point icone={FileSpreadsheet} titre="Vue Tableau et export Excel">
            Toutes les formes du jeu en tableau, à filtrer et regrouper. L’Excel sort en trois onglets : récapitulatif, détail et SIA 416.
          </Point>
          <Point icone={ScanLine} titre="Les plans papier aussi">
            Pas de PDF ? Photographiez la feuille et ajustez les quatre coins : elle devient un plan à métrer. Dans l’app, c’est le scanner d’iOS.
          </Point>
        </div>

        {/* La présentation : ce qu'on projette en séance ou qu'on joint au dossier. */}
        <div className="mt-20 rounded-[28px] bg-[#f5f7fa] p-5 sm:mt-24 sm:p-10">
          <Apparition className="max-w-2xl">
            <h3 className="text-[clamp(1.4rem,2.6vw,1.9rem)] font-semibold leading-tight tracking-[-0.025em]">Plans de repérage et métrés, en 16:9</h3>
            <p className="mt-3 text-[16px] leading-relaxed text-[#545458] sm:text-[17px]">
              {typo('Un bouton fait de vos métrés une présentation à projeter ou à exporter en PDF : une page de titre, chaque élément repéré et numéroté sur son plan, puis son tableau par niveau avec le total général. Elle se retrouve aussi parmi les rapports du dossier.')}
            </p>
          </Apparition>
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <Apparition delai={60}>
              <Maquette description="Diapositive de repérage : le plan de l’étage type en retrait, ses neuf pièces numérotées en couleur, et à côté leur surface, 192,40 m² par étage, 577,20 m² sur trois étages.">
                <div className="overflow-hidden rounded-xl shadow-[0_20px_50px_-28px_rgba(16,36,80,0.45)] ring-1 ring-black/[0.06]">
                  <Echelle largeur={1280} hauteur={720}><DiapoReperage /></Echelle>
                </div>
              </Maquette>
            </Apparition>
            <Apparition delai={140}>
              <Maquette description="Diapositive de tableau : les pièces par niveau, rez, 1er au 3e et attique, avec le total général de 857,10 m² et la part de chaque niveau.">
                <div className="overflow-hidden rounded-xl shadow-[0_20px_50px_-28px_rgba(16,36,80,0.45)] ring-1 ring-black/[0.06]">
                  <Echelle largeur={1280} hauteur={720}><DiapoTableau /></Echelle>
                </div>
              </Maquette>
            </Apparition>
          </div>
        </div>
      </Conteneur>
    </section>
  )
}
