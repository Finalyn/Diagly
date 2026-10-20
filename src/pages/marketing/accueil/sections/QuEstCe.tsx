import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, Calculator, ClipboardCheck, FileText, HardHat, Target, Timer, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Apparition, Bouton, Conteneur, MarqueIA } from '../ui'
import { Defileur } from '../Defileur'
import { typo } from '../typo'

/**
 * « Qu'est-ce que Diagly » : à gauche, ce que fait l'outil en une phrase et
 * le bouton d'inscription ; à droite, ce qu'on y gagne, en une colonne de
 * repères reliés par un trait.
 *
 * Le trait se colore de haut en bas à mesure que les repères arrivent à
 * l'écran. Les deux chiffres ont été mesurés sur nos plans d'essai
 * (l'astérisque y renvoie) et défilent comme un compteur à leur arrivée ; les
 * autres repères décrivent ce que fait le logiciel. Un gain de temps chiffré
 * attendra une mesure sur de vrais diagnostics.
 */

const REPERES: { icone?: LucideIcon; ia?: boolean; titre: string; texte: ReactNode }[] = [
  { icone: Target, titre: 'Des surfaces justes', texte: <><Defileur texte="< 0,1 %" /><Asterisque /> d’écart sur les surfaces tracées par l’IA, échelle vérifiée sur une cote.</> },
  { icone: Timer, titre: 'Des plans lus en quelques secondes', texte: <><Defileur texte="≈ 40 s" /><Asterisque /> pour que l’IA lise une feuille : pièces, façades, fenêtres et portes.</> },
  { icone: ClipboardCheck, titre: 'Guidé sur place', texte: 'Le tour du bâtiment en 7 étapes, sur iPad ou iPhone, même sans réseau.' },
  { icone: Calculator, titre: 'Chiffré par code CFC', texte: 'Les prix de votre base, posés sur les quantités du bâtiment, à plus ou moins 15 %.' },
  { icone: FileText, titre: 'Prêt à remettre', texte: 'Rapport, devis estimatif et présentation 16:9, à l’en-tête de votre bureau.' },
  { ia: true, titre: 'L’IA propose, vous décidez', texte: 'Métrés, Guide IA et assistant : rien n’entre dans le dossier sans votre validation.' },
]

export function QuEstCe() {
  return (
    <section id="diagly" aria-labelledby="titre-diagly" className="scroll-mt-24 bg-white py-20 sm:py-28">
      <Conteneur>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <Apparition className="lg:sticky lg:top-32 lg:self-start lg:pt-10">
            <h2 id="titre-diagly" className="max-w-[16ch] text-balance text-[clamp(2.1rem,4.4vw,3.3rem)] font-medium leading-[1.06] tracking-[-0.04em] text-[#0b1220]">
              {typo('Le diagnostic de bâtiment, sans la ressaisie.')}
            </h2>
            <p className="mt-5 max-w-[30rem] text-pretty text-[16px] leading-[1.65] text-[#6b7280]">
              {typo('Créé par des professionnels du bâtiment suisse, Diagly lit vos plans, vous guide pendant la visite, chiffre les travaux par code CFC et sort le rapport à l’en-tête de votre bureau.')}
            </p>
            <Bouton href="#demo" className="mt-8 px-6">
              Réserver une démo<ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Bouton>
            <p className="mt-6 flex items-center gap-2.5 text-[14px] font-medium text-[#0b1220]">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eef5ff] text-[#0167EA]"><HardHat className="h-4 w-4" aria-hidden="true" /></span>
              {typo('Créé par des professionnels du bâtiment, en Suisse romande')}
            </p>
          </Apparition>

          <div>
            <ol>
              {REPERES.map((r, i) => <Repere key={r.titre} {...r} dernier={i === REPERES.length - 1} />)}
            </ol>
            <p className="mt-2 pl-[60px] text-[12.5px] text-[#8a8f98]">
              * Mesuré en octobre 2026 sur nos jeux de plans d’essai, PDF vectoriels au 1:100.
            </p>
          </div>
        </div>
      </Conteneur>
    </section>
  )
}

/**
 * Un repère : l'icône dans son cercle, le trait qui descend vers le suivant,
 * le titre et le texte. Le trait se colore quand le repère arrive à l'écran.
 */
function Repere({ icone: Icone, ia, titre, texte, dernier }: { icone?: LucideIcon; ia?: boolean; titre: string; texte: ReactNode; dernier: boolean }) {
  const ref = useRef<HTMLLIElement>(null)
  // Sans IntersectionObserver, rien n'attend : tout s'affiche d'emblée.
  const [vu, setVu] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') return
    const o = new IntersectionObserver((e) => {
      if (e.some((x) => x.isIntersecting)) { setVu(true); o.disconnect() }
    }, { rootMargin: '0px 0px -30% 0px' })
    o.observe(el)
    return () => o.disconnect()
  }, [])

  return (
    <li ref={ref} className="relative flex gap-6 pb-12 last:pb-6">
      <div className="relative flex w-9 shrink-0 flex-col items-center">
        <span
          className={cn(
            'relative z-10 flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-inset transition-colors duration-700',
            vu ? 'bg-[#eef5ff] text-[#0167EA] ring-[#0167EA]/25' : 'bg-white text-[#b8bfca] ring-black/[0.08]',
          )}
        >
          {ia ? <MarqueIA className={cn('h-[18px] w-[18px] transition-opacity duration-700', !vu && 'opacity-40 grayscale')} /> : Icone && <Icone className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />}
        </span>
        {!dernier && (
          <span aria-hidden="true" className="absolute bottom-[-12px] top-[44px] w-px overflow-hidden bg-black/[0.08]">
            <span className={cn('block h-full w-full origin-top bg-[#0167EA] transition-transform duration-[1200ms] ease-out', vu ? 'scale-y-100' : 'scale-y-0')} />
          </span>
        )}
      </div>
      <div className={cn('pt-1 transition-[opacity,transform] duration-700', vu ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-40')}>
        <h3 className="text-[18px] font-semibold tracking-[-0.015em] text-[#0b1220]">{titre}</h3>
        <p className="mt-1.5 max-w-[30rem] text-pretty text-[15px] leading-[1.6] text-[#6b7280]">{typeof texte === 'string' ? typo(texte) : texte}</p>
      </div>
    </li>
  )
}

function Asterisque() {
  return <span aria-hidden="true" className="align-super text-[0.7em] font-semibold text-[#0167EA]">*</span>
}
