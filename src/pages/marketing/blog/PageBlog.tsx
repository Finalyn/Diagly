import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Apparition, Conteneur, FOCUS } from '../accueil/ui'
import { typo } from '../accueil/typo'
import { useAncre, useFinDuPrerendu } from '../accueil/ancre'
import { Entete } from '../accueil/Entete'
import { Quadrillage } from '../accueil/Hero'
import { AppelFinal, PiedDePage } from '../accueil/sections/Fin'
import { TETE_BLOG } from '../seo'
import { useTete } from '../tete'
import { ARTICLES, dateLongue } from './articles'

/**
 * Le blog, /blog : les guides pratiques du diagnostic de bâtiment en Suisse
 * romande, chacun en une carte qui mène à l'article.
 */
export function PageBlog() {
  useTete(TETE_BLOG)
  useAncre()
  useFinDuPrerendu()
  return <CorpsBlog />
}

/** Le contenu de la page, sans effets : c'est aussi lui que le build rend en HTML. */
export function CorpsBlog() {
  return (
    <div className="min-h-screen overflow-x-clip bg-white text-[#1d1d1f] antialiased">
      <Entete />
      <main id="contenu">
        <section id="haut" aria-labelledby="titre-blog" className="relative -mt-[72px] overflow-hidden bg-gradient-to-b from-[#f3f7fe] to-white pt-[72px]">
          <Quadrillage />
          <div className="relative mx-auto w-full max-w-[1200px] px-4 pb-10 pt-12 text-center sm:px-6 sm:pt-16 lg:px-8 lg:pt-20">
            <h1 id="titre-blog" className="mx-auto max-w-[18ch] text-balance text-[clamp(2.25rem,5vw,3.75rem)] font-semibold leading-[1.08] tracking-[-0.035em] text-[#0b1f44]">
              Le blog du diagnostic de bâtiment
            </h1>
            <p className="mx-auto mt-5 max-w-[40rem] text-pretty text-[16px] leading-[1.6] text-[#4b5563] sm:text-[17px]">
              {typo('Des guides pratiques pour les diagnostiqueurs, les architectes et les régies de Suisse romande : le déroulement d’un diagnostic, les codes CFC, les surfaces SIA 416, le certificat énergétique.')}
            </p>
          </div>
        </section>

        <section aria-label="Les articles" className="bg-white pb-20 sm:pb-28">
          <Conteneur>
            <ul className="grid gap-4 md:grid-cols-2">
              {ARTICLES.map((a, i) => (
                <Apparition as="li" key={a.slug} delai={(i % 2) * 80}>
                  <Link
                    to={`/blog/${a.slug}`}
                    className={cn('group flex h-full flex-col rounded-[28px] border border-black/[0.06] bg-[#f4f5f7] p-7 transition-colors hover:border-[#0167EA]/25 sm:p-8', FOCUS)}
                  >
                    <p className="text-[13px] font-semibold text-[#0167EA]">{a.sujet}</p>
                    <h2 className="mt-2 text-balance text-[clamp(1.35rem,2.2vw,1.7rem)] font-medium leading-[1.2] tracking-[-0.025em] text-[#0b1220]">{typo(a.titre)}</h2>
                    <p className="mt-3 flex-1 text-pretty text-[15px] leading-[1.6] text-[#6b7280]">{typo(a.description)}</p>
                    <p className="mt-6 flex items-center justify-between gap-3 text-[13.5px] text-[#8a8f98]">
                      <span>{dateLongue(a.date)} · {a.lecture} min de lecture</span>
                      <span className="inline-flex items-center gap-1 font-medium text-[#0167EA]">
                        Lire<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                      </span>
                    </p>
                  </Link>
                </Apparition>
              ))}
            </ul>
          </Conteneur>
        </section>
        <AppelFinal />
      </main>
      <PiedDePage />
    </div>
  )
}
