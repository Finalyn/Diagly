import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Bouton, FOCUS, LienSite, MarqueIA } from './ui'

/**
 * Le haut de la page : ce que fait Diagly en une phrase, les deux portes
 * d'entrée, puis le début de l'application elle-même, son accueil sur
 * ordinateur et la liste des diagnostics sur iPhone.
 *
 * Les écrans sont de vraies captures de l'application, prises sur un dossier
 * d'exemple. Seul leur haut est montré : le reste se fond dans la page, comme
 * une porte entrouverte sur l'outil.
 *
 * Le titre et le texte ne s'animent pas : ce sont eux que le navigateur
 * affiche en premier, ils ne doivent rien attendre. Seuls les appareils
 * montent en fondu.
 */
export function Hero() {
  return (
    // Le fond remonte sous la barre du haut, transparente en début de page.
    <section id="haut" aria-labelledby="titre-accueil" className="relative -mt-[72px] scroll-mt-20 overflow-hidden bg-[#f3f7fe] pt-[72px]">
      <Quadrillage />

      <div className="relative mx-auto w-full max-w-[1200px] px-4 pt-12 text-center sm:px-6 sm:pt-16 lg:px-8 lg:pt-20">
        <LienSite to="/fonctionnalites#metres" className={cn('group inline-flex min-h-11 items-center rounded-full', FOCUS)}>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#0167EA]/20 bg-white py-1 pl-1.5 pr-3.5 text-[13px] font-medium text-[#0b1f44] shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-colors group-hover:border-[#0167EA]/40">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#e6f0ff]"><MarqueIA className="h-3.5 w-3.5" /></span>
            Nouveau&nbsp;: les métrés par l’IA
          </span>
        </LienSite>

        {/* L'accroche, puis la promesse : deux lignes de la même couleur, chacune d'un tenant sur ordinateur. */}
        <h1 id="titre-accueil" className="mx-auto mt-6 text-balance text-[clamp(2.1rem,4.6vw,3.5rem)] font-semibold leading-[1.1] tracking-[-0.035em] text-[#0b1f44]">
          <span className="block lg:whitespace-nowrap">Diagnostic bâtiment, simplifié.</span>
          <span className="block lg:whitespace-nowrap">Des plans au rapport chiffré.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-[41rem] text-pretty text-[16px] leading-[1.6] text-[#4b5563] sm:text-[17px]">
          L’IA tire les métrés de vos plans. Vous relevez l’état sur iPad ou iPhone.
          Diagly chiffre par code CFC et sort le rapport à votre en-tête.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Bouton to="/register" className="w-full px-6 sm:w-auto">
            Créer un compte gratuit<ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Bouton>
          <Bouton to="/fonctionnalites" variante="contour" className="w-full px-6 sm:w-auto">Découvrir l’app</Bouton>
        </div>
      </div>

      <Appareils />
    </section>
  )
}

/**
 * Le quadrillage fin du fond, à la manière d'un papier millimétré : il
 * s'efface vers les bords pour laisser le titre au centre.
 */
export function Quadrillage() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 [background-image:linear-gradient(to_right,rgba(1,103,234,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(1,103,234,0.08)_1px,transparent_1px)] [background-position:center_top] [background-size:72px_72px] [mask-image:radial-gradient(ellipse_75%_65%_at_50%_28%,#000_35%,transparent_100%)]" />
      <div className="absolute left-1/2 top-[-12%] h-[620px] w-[1100px] max-w-[160%] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.95),rgba(255,255,255,0))]" />
    </div>
  )
}

/**
 * L'ordinateur et l'iPhone, coupés par le bas de la section : on voit le
 * début de l'accueil de l'application, le reste se fond dans la page.
 */
function Appareils() {
  return (
    <div className="relative mx-auto mt-12 w-full max-w-[1120px] px-4 sm:mt-16 sm:px-6">
      <figure className="relative" aria-label="L’application Diagly sur ordinateur et sur iPhone">
        {/* Ordinateur : l'écran seul, avec son cadre sombre et sa caméra. */}
        <div className="dp-anim relative mx-auto w-[92%] rounded-t-[22px] bg-[#111827] px-[1.1%] pt-[1.1%] shadow-[0_50px_100px_-40px_rgba(11,31,68,0.55),0_0_0_1px_rgba(15,23,42,0.08)] sm:w-[88%]">
          <span aria-hidden="true" className="absolute left-1/2 top-[0.45%] h-[5px] w-[5px] -translate-x-1/2 rounded-full bg-[#374151]" />
          <div className="overflow-hidden rounded-t-[13px] bg-[#f4f4f5]">
            {/* Le haut de l'accueil seulement : 1800 × 900 sur une capture de 1800 × 1125. */}
            <div className="aspect-[1800/900] overflow-hidden">
              <img
                src="/accueil/app-accueil.webp"
                alt="L’accueil de Diagly : le dossier à reprendre avec ses relevés, ses urgences et son coût estimé, les accès rapides et l’activité récente."
                width={1800}
                height={1125}
                fetchPriority="high"
                className="block h-auto w-full"
              />
            </div>
          </div>
        </div>

        {/* iPhone : devant l'ordinateur, à droite, avec sa barre d'état. */}
        <div className="dp-anim dp-d2 absolute right-0 top-[22%] w-[30%] max-w-[250px] sm:right-[2%] sm:w-[20%]">
          <div className="rounded-[18%/8.5%] bg-[#111827] p-[3.2%] shadow-[0_40px_70px_-30px_rgba(11,31,68,0.6),0_0_0_1px_rgba(15,23,42,0.1)]">
            <div className="relative overflow-hidden rounded-[15%/7%] bg-[#f4f4f5]">
              <div className="relative flex h-[clamp(14px,2.4vw,26px)] items-center justify-between bg-[#f4f4f5] px-[9%] text-[clamp(6px,0.95vw,11px)] font-semibold text-[#111827]">
                <span>9:41</span>
                <span aria-hidden="true" className="absolute left-1/2 top-[22%] h-[56%] w-[32%] -translate-x-1/2 rounded-full bg-[#111827]" />
                <span aria-hidden="true" className="flex items-center gap-[3px]">
                  <span className="h-[0.7em] w-[1.1em] rounded-[2px] border border-[#111827]/80" />
                </span>
              </div>
              <img
                src="/accueil/app-iphone-liste.webp"
                alt="Diagly sur iPhone : la liste des diagnostics, avec leur état et leur adresse."
                width={460}
                height={995}
                className="block h-auto w-full"
              />
            </div>
          </div>
        </div>
      </figure>

      {/* Le bas des appareils se fond dans la section suivante, blanche. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-b from-transparent via-white/75 to-white" />
    </div>
  )
}
