import { AlertTriangle, FileText, Leaf, MapPin, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MENTION_CECB } from '@/lib/marque-cecb'
import { Apparition, Conteneur } from '../ui'
import { typo } from '../typo'
import { EnTeteSection } from './blocs'

/**
 * Les quatre départs d'un diagnostic, tels que l'écran de création les
 * propose (components/demarrage/Demarrage.tsx). La carte de l'adresse porte
 * la mise en garde de l'application, mot pour mot : les valeurs publiques
 * sont des estimations.
 */

const DEPARTS = [
  {
    icone: Upload,
    titre: 'Avec des plans',
    texte: 'Les métrés validés deviennent les quantités du dossier : éléments comptés et ouvrages rattachés, reportés en un geste.',
    recommande: true,
  },
  {
    icone: FileText,
    titre: 'Depuis un document',
    texte: 'Un PDF, un Word, un Excel ou un CSV : l’assistant en lit les données et vous les montre avant de créer le dossier.',
  },
  {
    icone: Leaf,
    titre: 'Depuis un certificat énergétique (CECB®)',
    texte: 'Le certificat en PDF pré-remplit le bâtiment et son étiquette, que vous relisez avant de continuer.',
  },
]

export function Demarrer() {
  return (
    <section id="demarrer" aria-labelledby="titre-demarrer" className="scroll-mt-16 bg-[#f5f7fa] py-20 sm:py-28">
      <Conteneur>
        <EnTeteSection
          id="titre-demarrer"
          surtitre="Démarrer un diagnostic"
          titre="Partez de ce que vous avez."
          chapo="Un jeu de plans, un document, un certificat énergétique ou une simple adresse : chaque départ pré-remplit le dossier, et vous relisez avant de créer."
        />
        <div className="mt-12 grid gap-4 lg:grid-cols-2">
          <div className="grid gap-4">
            {DEPARTS.map((d, i) => (
              <Apparition key={d.titre} delai={i * 70} className={cn('rounded-2xl bg-white p-6 ring-1', d.recommande ? 'ring-[#0167EA]/30' : 'ring-black/[0.06]')}>
                <div className="flex items-start gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef5ff] text-[#0167EA]"><d.icone className="h-5 w-5" aria-hidden="true" /></span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[17px] font-semibold">{d.titre}</h3>
                      {d.recommande && <span className="rounded-full bg-[#0167EA] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">Recommandé</span>}
                    </div>
                    <p className="mt-1 text-[15px] leading-relaxed text-[#545458]">{typo(d.texte)}</p>
                  </div>
                </div>
              </Apparition>
            ))}
          </div>

          {/* L'adresse : ce que donnent les registres, et ce que ça vaut. */}
          <Apparition delai={120} className="rounded-2xl bg-white p-6 ring-1 ring-black/[0.06] sm:p-7">
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef5ff] text-[#0167EA]"><MapPin className="h-5 w-5" aria-hidden="true" /></span>
              <div>
                <h3 className="text-[17px] font-semibold">Depuis l’adresse</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-[#545458]">
                  Le registre fédéral des bâtiments et le cadastre donnent l’année de construction, les niveaux et l’emprise. Diagly en déduit des premiers métrés.
                </p>
              </div>
            </div>
            <div aria-hidden="true" className="mt-6 rounded-xl border border-[#e8e8ed] p-4">
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#6e6e73]">Valeurs publiques</p>
              <p className="mt-1 text-[15px] font-medium">Rue des Alpes 12, 1003 Lausanne</p>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-[14px]">
                {[['Année de construction', '1968'], ['Niveaux', '5'], ['Emprise au sol', '220 m²'], ['Logements', '10']].map(([a, b]) => (
                  <div key={a} className="flex justify-between gap-3 border-b border-[#f0f0f3] pb-2">
                    <dt className="text-[#6e6e73]">{a}</dt><dd className="font-semibold tabular-nums">{b}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <p className="mt-4 flex gap-2.5 rounded-xl bg-amber-50 p-3.5 text-[14px] leading-relaxed text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{typo('Les valeurs publiques sont des estimations (périmètre déduit de l’emprise, hauteur d’étage et vitrages par défaut) : les métrés qui en découlent sont approximatifs. Vérifiez-les ou remplacez-les par vos mesures.')}</span>
            </p>
          </Apparition>
        </div>
        <p className="mt-6 text-[12px] leading-relaxed text-[#6e6e73]">{MENTION_CECB}</p>
      </Conteneur>
    </section>
  )
}
