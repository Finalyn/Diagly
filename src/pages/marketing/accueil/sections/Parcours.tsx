import { Calculator, ClipboardCheck, FileText, Ruler, Upload } from 'lucide-react'
import { Apparition, Conteneur } from '../ui'
import { typo } from '../typo'
import { EnTeteSection } from './blocs'

/**
 * Le parcours d'un dossier en cinq étapes. Chacune part de ce que la
 * précédente a produit : c'est l'argument, et la section le montre d'un
 * trait continu plutôt que de l'écrire.
 */
const ETAPES = [
  { icone: Upload, titre: 'Plans', texte: 'Déposez le jeu de plans en PDF ou en images. Un plan papier se photographie.', ancre: '#metres' },
  { icone: Ruler, titre: 'Métrés', texte: 'L’IA lit chaque feuille, dessine et compte. Vous validez ce qu’elle propose.', ancre: '#metres' },
  { icone: ClipboardCheck, titre: 'Visite', texte: 'Sur iPad ou iPhone, ouvrage par ouvrage : une photo, l’état, puis « Suivant ».', ancre: '#releve' },
  { icone: Calculator, titre: 'Chiffrage', texte: 'Chaque état porte ses travaux et son prix. Les quantités viennent du bâtiment.', ancre: '#chiffrage' },
  { icone: FileText, titre: 'Rapport', texte: 'Rapport complet, rapport photo, présentation des métrés, à votre en-tête.', ancre: '#rapports' },
]

export function Parcours() {
  return (
    <section id="parcours" aria-labelledby="titre-parcours" className="scroll-mt-16 bg-[#f5f7fa] py-20 sm:py-28">
      <Conteneur>
        <EnTeteSection
          id="titre-parcours"
          centre
          surtitre="Le parcours"
          titre="Cinq étapes, un seul dossier."
          chapo="Chaque étape reprend ce que la précédente a produit : les quantités ne se recopient pas d’un outil à l’autre."
        />
        <ol className="relative mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:gap-0">
          {/* Le fil qui relie les étapes, derrière les pastilles. */}
          <span aria-hidden="true" className="absolute left-[10%] right-[10%] top-[27px] hidden h-px bg-[linear-gradient(90deg,rgba(1,103,234,0)_0%,rgba(1,103,234,0.35)_12%,rgba(1,103,234,0.35)_88%,rgba(1,103,234,0)_100%)] lg:block" />
          {ETAPES.map((e, i) => (
            <Apparition key={e.titre} as="li" delai={i * 70} className="relative">
              <a href={e.ancre} className="group flex h-full gap-4 rounded-2xl bg-white p-5 ring-1 ring-black/[0.05] transition-shadow hover:shadow-[0_12px_30px_-18px_rgba(16,36,80,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0167EA] lg:mx-2 lg:flex-col lg:bg-transparent lg:p-3 lg:text-center lg:ring-0 lg:hover:shadow-none">
                <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-[#0167EA] shadow-[0_6px_16px_-8px_rgba(16,36,80,0.35)] ring-1 ring-black/[0.06] lg:mx-auto">
                  <e.icone className="h-6 w-6" aria-hidden="true" />
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#0167EA] text-[11px] font-bold text-white">{i + 1}</span>
                </span>
                <span className="block">
                  <span className="block text-[17px] font-semibold text-[#1d1d1f] group-hover:text-[#0167EA]">{e.titre}</span>
                  <span className="mt-1 block text-[15px] leading-relaxed text-[#545458]">{typo(e.texte)}</span>
                </span>
              </a>
            </Apparition>
          ))}
        </ol>
      </Conteneur>
    </section>
  )
}
