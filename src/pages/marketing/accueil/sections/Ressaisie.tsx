import { ArrowRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Apparition, Bouton, Conteneur } from '../ui'
import { typo } from '../typo'
import { IPad } from '../maquettes/IPad'

/**
 * « Fini la ressaisie » : le grand texte à gauche ; à droite, l'accueil de
 * Diagly sur iPad, et autour de lui quatre petites cartes cochées qui disent
 * ce que l'outil reprend pour vous. Sur grand écran, les cartes flottent sur
 * les bords de l'iPad (accueil-flotte, index.css) ; sur téléphone, elles se
 * rangent dessous, deux par deux.
 */

const COCHES: { titre: string; texte: string; place: string; delai: number }[] = [
  { titre: 'Métrés repris des plans', texte: 'L’IA lit, vous validez', place: 'lg:-left-[6%] lg:top-[10%]', delai: 0 },
  { titre: 'Relevé synchronisé', texte: 'Même hors ligne', place: 'lg:-right-[4%] lg:top-[24%]', delai: 1 },
  { titre: 'Prix CFC posés', texte: 'Sur les quantités du bâtiment', place: 'lg:-left-[2%] lg:bottom-[14%]', delai: 2 },
  { titre: 'Rapport prêt à remettre', texte: 'À votre en-tête', place: 'lg:-right-[6%] lg:bottom-[4%]', delai: 3 },
]

export function Ressaisie() {
  return (
    <section id="pourquoi" aria-labelledby="titre-pourquoi" className="relative scroll-mt-24 overflow-x-clip bg-[#f7f8fa] py-20 sm:py-28">
      <Conteneur>
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
          <Apparition>
            <h2 id="titre-pourquoi" className="max-w-[10ch] text-balance text-[clamp(2.8rem,6.5vw,5rem)] font-medium leading-[0.96] tracking-[-0.055em] text-[#0b1220]">
              {typo('Fini la ressaisie.')}
            </h2>
            <p className="mt-6 max-w-[28rem] text-pretty text-[17px] leading-[1.65] text-[#6b7280]">
              {typo('Les métrés, le relevé, les prix et le rapport vivent dans le même dossier. Ce que vous recopiez aujourd’hui d’un outil à l’autre, Diagly le reprend pour vous.')}
            </p>
            <Bouton href="#demo" className="mt-8 px-6">Réserver une démo<ArrowRight className="h-4 w-4" aria-hidden="true" /></Bouton>
          </Apparition>

          <div className="relative">
            <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-[80%] w-[90%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(1,103,234,0.18),transparent)]" />
            <Apparition className="accueil-ipad relative lg:px-[4%]">
              <IPad
                nom="accueil"
                alt="L’accueil de Diagly sur iPad : le dossier en cours avec ses relevés, ses urgences et son coût estimé, les accès rapides et l’activité récente."
                sizes="(min-width: 1024px) 680px, 92vw"
              />
            </Apparition>
            <ul className="relative mt-6 grid grid-cols-2 gap-2.5 lg:static lg:mt-0">
              {COCHES.map((c) => (
                <Apparition as="li" key={c.titre} delai={300 + c.delai * 140} className={cn('lg:absolute lg:z-10', c.place)}>
                  <div className="accueil-flotte flex items-center gap-3 rounded-2xl bg-white/90 px-4 py-3 shadow-[0_18px_40px_-18px_rgba(11,31,68,0.35)] ring-1 ring-black/[0.06] backdrop-blur-md" style={{ animationDelay: `${c.delai * -1.6}s` }}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0167EA] text-white shadow-[0_6px_14px_-6px_rgba(1,103,234,0.8)]">
                      <Check className="h-4 w-4" strokeWidth={2.8} aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block text-[14.5px] font-semibold leading-tight text-[#0b1220]">{typo(c.titre)}</span>
                      <span className="block text-[12.5px] leading-tight text-[#6b7280]">{typo(c.texte)}</span>
                    </span>
                  </div>
                </Apparition>
              ))}
            </ul>
          </div>
        </div>
      </Conteneur>
    </section>
  )
}
