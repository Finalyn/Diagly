import { ArrowRight, Check, Hourglass, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Accent, Apparition, Bouton, Conteneur, EnTeteCentre } from '../ui'
import { typo } from '../typo'

/**
 * Ce que Diagly change, à la manière du « Notre histoire » d'inview.ch : le
 * titre centré, puis une grande carte claire (la phrase qui le dit, le
 * paragraphe, deux chiffres dans de petites cartes à pastille sombre) et,
 * à côté, une photo de bâtiment.
 *
 * Les deux chiffres sont ceux que donne l'équipe : trois jours pour un
 * diagnostic avant, le temps d'une visite avec Diagly.
 */

const CHIFFRES: { valeur: string; texte: string; pastille: string; icone: LucideIcon; diagly?: boolean }[] = [
  { valeur: '3 jours', texte: 'par diagnostic', pastille: 'Avant', icone: Hourglass },
  { valeur: '1 visite', texte: 'par diagnostic', pastille: 'Avec Diagly', icone: Check, diagly: true },
]

export function ParDesPros() {
  return (
    <section id="pros" aria-labelledby="titre-pros" className="scroll-mt-24 bg-white py-20 sm:py-28">
      <Conteneur>
        <EnTeteCentre
          id="titre-pros"
          titre={<>Imaginé et créé <Accent>par des pros du bâtiment</Accent></>}
          sousTitre="Le diagnostic, nous le connaissons de l’intérieur."
        />

        <div className="mt-12 grid gap-4 sm:mt-16 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)] lg:gap-5">
          <Apparition className="flex flex-col rounded-[28px] bg-gradient-to-b from-[#f3f4f6] to-[#fafbfc] p-6 ring-1 ring-black/[0.06] sm:p-9">
            <h3 className="text-balance text-[clamp(1.5rem,2.6vw,2.1rem)] font-semibold leading-[1.18] tracking-[-0.03em] text-[#0b1220]">
              {typo('Avant, un diagnostic prenait 3 jours. ')}<Accent>{typo('Maintenant, juste le temps de la visite.')}</Accent>
            </h3>
            <p className="mt-5 max-w-[40rem] text-pretty text-[16px] leading-[1.65] text-[#6b7280]">
              {typo('Les métrés sont prêts avant de partir, le relevé se fait sur place, le chiffrage et le rapport en découlent. Ce que vous faisiez au bureau après chaque visite, Diagly le fait pour vous. Fini le temps passé au bureau.')}
            </p>

            <ul className="mt-10 grid grid-cols-2 gap-3 lg:mt-auto lg:pt-10">
              {CHIFFRES.map((c) => (
                <li key={c.valeur} className="relative rounded-[20px] bg-white px-5 pb-5 pt-14 ring-1 ring-black/[0.07] sm:px-7 sm:pb-6 sm:pt-6">
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[#0b1220] px-3 py-1 text-[12.5px] font-medium text-white sm:right-4 sm:top-4">
                    <c.icone className="h-3.5 w-3.5" aria-hidden="true" />{c.pastille}
                  </span>
                  <p className={cn('text-[clamp(2rem,4vw,3rem)] font-semibold leading-none tracking-[-0.045em]', c.diagly ? 'text-[#0167EA]' : 'text-[#0b1220]')}>{typo(c.valeur)}</p>
                  <p className="mt-3 text-[14px] leading-snug text-[#6b7280] sm:text-[15px]">{typo(c.texte)}</p>
                </li>
              ))}
            </ul>
          </Apparition>

          <Apparition delai={90} className="relative min-h-[300px] overflow-hidden rounded-[28px] ring-1 ring-black/[0.06] sm:min-h-[380px]">
            <img
              src="/preview-bg.webp"
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover object-[72%_50%]"
            />
          </Apparition>
        </div>

        <Apparition className="mt-10 flex justify-center">
          <Bouton href="#demo" className="w-full px-6 sm:w-auto">
            Réserver une démo<ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Bouton>
        </Apparition>
      </Conteneur>
    </section>
  )
}
