import { useSyncExternalStore } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Bouton, Conteneur, Echelle, FOCUS, LienFleche, Maquette, MarqueIA } from './ui'
import { Ordinateur, Tablette, Telephone } from './maquettes/Appareils'
import { EcranMetres } from './maquettes/EcranMetres'
import { EcranFiche } from './maquettes/EcranReleve'
import { EcranDiagnostics } from './maquettes/EcranMobile'

/**
 * Le haut de la page : ce que fait Diagly en une phrase, les deux portes
 * d'entrée, et les trois écrans côte à côte, l'ordinateur au bureau, l'iPad
 * et l'iPhone sur le chantier.
 *
 * Le titre et le texte ne s'animent pas : ce sont eux que le navigateur
 * affiche en premier, ils ne doivent rien attendre. Seuls les appareils
 * montent en fondu.
 */

const ETROIT = '(max-width: 639.98px)'

/** Sur téléphone, l'ordinateur deviendrait illisible : la composition passe à l'iPad et l'iPhone. */
function useEtroit() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(ETROIT)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(ETROIT).matches,
    () => false,
  )
}

const FAITS = ['Données hébergées en Suisse', 'Codes CFC et surfaces SIA 416', 'Sur le web, l’iPad et l’iPhone']

export function Hero() {
  const etroit = useEtroit()
  return (
    <section id="haut" aria-labelledby="titre-accueil" className="relative scroll-mt-20 overflow-hidden pb-10 pt-10 sm:pt-16 lg:pb-16 lg:pt-20">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_0%,#e3eeff_0%,rgba(255,255,255,0)_72%)]" />
      <Conteneur className="relative text-center">
        <a href="#metres" className={cn('group inline-flex min-h-11 items-center rounded-full', FOCUS)}>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#0167EA]/15 bg-white/80 py-1 pl-1.5 pr-3.5 text-[13px] font-medium text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors group-hover:border-[#0167EA]/35">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#eef5ff]"><MarqueIA className="h-3.5 w-3.5" /></span>
            Nouveau&nbsp;: les métrés par l’IA
            <span aria-hidden="true" className="text-[#0167EA]">→</span>
          </span>
        </a>

        <h1 id="titre-accueil" className="mx-auto mt-5 max-w-[18ch] text-balance text-[clamp(2.4rem,6vw,4.25rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-[#1d1d1f]">
          Le diagnostic de bâtiment, des plans au rapport chiffré.
        </h1>
        <p className="mx-auto mt-6 max-w-[40rem] text-pretty text-[17px] leading-[1.6] text-[#48484a] sm:text-[19px]">
          L’IA lit vos plans et en tire les métrés. Vous relevez l’état sur place, sur iPad ou iPhone.
          Diagly chiffre les travaux par code CFC et met le rapport en page à l’en-tête de votre bureau.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-5">
          <Bouton to="/register" className="w-full px-6 sm:w-auto">Créer un compte gratuit</Bouton>
          <LienFleche href="#parcours">Voir le parcours</LienFleche>
        </div>

        <ul className="mx-auto mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[14px] text-[#48484a]">
          {FAITS.map((f) => (
            <li key={f} className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-[#0167EA]" aria-hidden="true" />{f}
            </li>
          ))}
        </ul>
      </Conteneur>

      <div className="relative mx-auto mt-12 w-full max-w-[1240px] px-4 sm:mt-14 sm:px-6">
        <Maquette description="Diagly sur trois appareils : sur ordinateur, l’espace Métrés avec les feuilles du jeu de plans, le plan d’étage aux pièces colorées et le panneau des quantités ; sur iPad, la fiche d’une porte palière avec sa photo, le Guide IA et son état ; sur iPhone, la liste des diagnostics.">
          {etroit ? <CompositionEtroite /> : <CompositionLarge />}
        </Maquette>
      </div>
    </section>
  )
}

function CompositionLarge() {
  return (
    <Echelle largeur={1200} hauteur={628}>
      <div className="relative h-full w-full">
        <div className="dp-anim absolute left-[170px] top-0 w-[860px]">
          <Ordinateur><EcranMetres /></Ordinateur>
        </div>
        <div className="dp-anim dp-d2 absolute left-[928px] top-[196px] w-[252px]">
          <Tablette><EcranFiche /></Tablette>
        </div>
        <div className="dp-anim dp-d3 absolute left-[46px] top-[262px] w-[168px]">
          <Telephone><EcranDiagnostics /></Telephone>
        </div>
      </div>
    </Echelle>
  )
}

function CompositionEtroite() {
  return (
    <Echelle largeur={600} hauteur={560}>
      <div className="relative h-full w-full">
        <div className="dp-anim absolute left-[214px] top-0 w-[350px]">
          <Tablette><EcranFiche /></Tablette>
        </div>
        <div className="dp-anim dp-d2 absolute left-[36px] top-[86px] w-[228px]">
          <Telephone><EcranDiagnostics /></Telephone>
        </div>
      </div>
    </Echelle>
  )
}
