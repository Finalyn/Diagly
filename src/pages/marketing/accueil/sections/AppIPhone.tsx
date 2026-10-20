import { Check } from 'lucide-react'
import { Apparition, Conteneur, LienFleche } from '../ui'
import { typo } from '../typo'
import { BadgeAppStore } from '../BadgeAppStore'

/**
 * L'app iPhone sur l'accueil : le grand texte et le badge App Store à
 * gauche, l'iPhone incliné à droite. La capture est prise sur un vrai
 * iPhone, avec la barre du bas native d'iOS ; le cadre est la maquette
 * fournie (public/accueil/iphone/).
 */

const ATOUTS = [
  'Le relevé guidé, photo par photo, même sans réseau',
  'Le scanner d’iOS pour les plans papier',
  'Connexion avec Apple, Google ou votre e-mail',
]

export function AppIPhone() {
  return (
    <section id="iphone" aria-labelledby="titre-iphone" className="relative scroll-mt-24 overflow-hidden bg-gradient-to-b from-white via-[#f3f7fe] to-white py-20 sm:py-28">
      <div aria-hidden="true" className="pointer-events-none absolute right-[-10%] top-1/2 h-[720px] w-[720px] -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(1,103,234,0.16),transparent)]" />
      <Conteneur className="relative">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
          <Apparition>
            <h2 id="titre-iphone" className="max-w-[13ch] text-balance text-[clamp(2.6rem,6vw,4.6rem)] font-medium leading-[0.98] tracking-[-0.05em] text-[#0b1220]">
              {typo('Le chantier, dans votre poche.')}
            </h2>
            <p className="mt-6 max-w-[30rem] text-pretty text-[17px] leading-[1.65] text-[#6b7280]">
              {typo('Diagly sur iPhone et iPad : le dossier complet, le relevé, les photos et le Guide IA, avec la navigation d’iOS. Et pour le bureau, installable sur Mac et PC, ou dans le navigateur.')}
            </p>
            <ul className="mt-7 space-y-3">
              {ATOUTS.map((a) => (
                <li key={a} className="flex items-center gap-3 text-[15.5px] font-medium text-[#0b1220]">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0167EA] text-white">
                    <Check className="h-3.5 w-3.5" strokeWidth={2.8} aria-hidden="true" />
                  </span>
                  {typo(a)}
                </li>
              ))}
            </ul>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
              <BadgeAppStore />
              <LienFleche to="/fonctionnalites#app">Voir l’app en détail</LienFleche>
            </div>
          </Apparition>

          <Apparition delai={120} className="accueil-ipad relative mx-auto w-full max-w-[460px] lg:max-w-[520px]">
            <img
              src="/accueil/iphone/iphone-liste-incline-1300.webp"
              srcSet="/accueil/iphone/iphone-liste-incline-700.webp 700w, /accueil/iphone/iphone-liste-incline-1300.webp 1300w"
              sizes="(min-width: 1024px) 520px, 80vw"
              alt="Diagly sur iPhone : la liste des diagnostics avec leur statut, leur adresse et la barre du bas d’iOS."
              width={1379}
              height={1990}
              loading="lazy"
              decoding="async"
              className="block h-auto w-full [filter:drop-shadow(0_40px_50px_rgba(11,31,68,0.25))]"
            />
          </Apparition>
        </div>
      </Conteneur>
    </section>
  )
}
