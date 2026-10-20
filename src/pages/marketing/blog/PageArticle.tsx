import { useMemo } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowRight, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Bouton, Conteneur, FOCUS, MarqueIA } from '../accueil/ui'
import { typo } from '../accueil/typo'
import { useAncre, useFinDuPrerendu } from '../accueil/ancre'
import { Entete } from '../accueil/Entete'
import { AppelFinal, PiedDePage } from '../accueil/sections/Fin'
import { teteArticle } from '../seo'
import { useTete } from '../tete'
import { ARTICLES, articleDe, dateLongue, type Article } from './articles'

/**
 * Un article du blog, /blog/:slug. Une adresse inconnue ramène à la liste.
 */
export function PageArticle() {
  const { slug } = useParams<{ slug: string }>()
  const article = articleDe(slug)
  if (!article) return <Navigate to="/blog" replace />
  return <ArticleVivant article={article} />
}

function ArticleVivant({ article }: { article: Article }) {
  const tete = useMemo(() => teteArticle(article), [article])
  useTete(tete)
  useAncre()
  useFinDuPrerendu()
  return <CorpsArticle article={article} />
}

/**
 * L'article : le fil d'Ariane, le titre, l'« En bref » qui répond tout de
 * suite, le corps, les questions fréquentes, puis le lien vers la
 * fonctionnalité de Diagly qui en parle et deux autres articles. Sans
 * effets : c'est aussi ce que le build rend en HTML.
 */
export function CorpsArticle({ article: a }: { article: Article }) {
  const autres = ARTICLES.filter((x) => x.slug !== a.slug).slice(0, 2)
  return (
    <div className="min-h-screen overflow-x-clip bg-white text-[#1d1d1f] antialiased">
      <Entete />
      <main id="contenu">
        <article id="haut" aria-labelledby="titre-article" className="relative -mt-[72px] pt-[72px]">
          <div className="bg-gradient-to-b from-[#f3f7fe] to-white">
            <Conteneur className="max-w-[860px] pb-8 pt-10 sm:pt-14">
              <nav aria-label="Fil d’Ariane">
                <ol className="flex flex-wrap items-center gap-1 text-[13.5px] text-[#6b7280]">
                  <li><Link to="/" className={cn('hover:text-[#0167EA]', FOCUS)}>Accueil</Link></li>
                  <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
                  <li><Link to="/blog" className={cn('hover:text-[#0167EA]', FOCUS)}>Blog</Link></li>
                  <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
                  <li className="font-medium text-[#0167EA]">{a.sujet}</li>
                </ol>
              </nav>
              <h1 id="titre-article" className="mt-5 text-balance text-[clamp(2.1rem,4.6vw,3.3rem)] font-semibold leading-[1.08] tracking-[-0.035em] text-[#0b1f44]">
                {typo(a.titre)}
              </h1>
              <p className="mt-4 text-[14px] text-[#6b7280]">
                Par l’équipe Diagly · <time dateTime={a.date}>{dateLongue(a.date)}</time> · {a.lecture} min de lecture
              </p>

              <div className="mt-8 rounded-[24px] border border-[#0167EA]/15 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-7">
                <p className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#0167EA]">
                  <MarqueIA className="h-4 w-4" />En bref
                </p>
                <p className="mt-3 text-pretty text-[17px] leading-[1.7] text-[#0b1220]">{typo(a.enBref)}</p>
              </div>
            </Conteneur>
          </div>

          <Conteneur className="max-w-[860px] pb-16">
            <div className="space-y-12">
              {a.blocs.map((b) => {
                const Liste = b.ordonnee ? 'ol' : 'ul'
                return (
                  <section key={b.titre}>
                    <h2 className="text-balance text-[clamp(1.5rem,2.6vw,1.95rem)] font-semibold leading-[1.2] tracking-[-0.025em] text-[#0b1220]">{typo(b.titre)}</h2>
                    {b.paragraphes?.map((p) => (
                      <p key={p} className="mt-4 text-pretty text-[17px] leading-[1.75] text-[#374151]">{typo(p)}</p>
                    ))}
                    {b.liste && (
                      <Liste className={cn('mt-4 space-y-2.5 pl-6 text-[17px] leading-[1.7] text-[#374151]', b.ordonnee ? 'list-decimal' : 'list-disc', 'marker:text-[#0167EA]')}>
                        {b.liste.map((l) => <li key={l} className="pl-1.5">{typo(l)}</li>)}
                      </Liste>
                    )}
                  </section>
                )
              })}

              {a.faq?.length ? (
                <section>
                  <h2 className="text-[clamp(1.5rem,2.6vw,1.95rem)] font-semibold tracking-[-0.025em] text-[#0b1220]">Questions fréquentes</h2>
                  <dl className="mt-5 divide-y divide-black/[0.08] border-y border-black/[0.08]">
                    {a.faq.map((f) => (
                      <div key={f.q} className="py-5">
                        <dt className="text-[17px] font-semibold text-[#0b1220]">{typo(f.q)}</dt>
                        <dd className="mt-2 text-[16.5px] leading-[1.7] text-[#374151]">{typo(f.r)}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ) : null}

              {a.mention && <p className="text-[13px] leading-relaxed text-[#8a8f98]">{typo(a.mention)}</p>}

              {/* La fonctionnalité de Diagly qui en parle. */}
              <aside className="rounded-[28px] bg-gradient-to-br from-[#0167EA] via-[#0b5bd3] to-[#0b3d8f] p-7 text-white sm:p-9">
                <p className="flex items-center gap-2 text-[14px] font-semibold text-white/80">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white"><MarqueIA className="h-3.5 w-3.5" /></span>Dans Diagly
                </p>
                <p className="mt-3 text-balance text-[clamp(1.4rem,2.4vw,1.8rem)] font-medium leading-[1.2] tracking-[-0.03em]">{typo(a.lien.libelle)}</p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Bouton to={`/fonctionnalites#${a.lien.ancre}`} variante="clair" className="w-full px-6 sm:w-auto">
                    Voir la fonctionnalité<ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Bouton>
                  <Bouton to="/#demo" className="w-full bg-white/10 px-6 shadow-none ring-1 ring-inset ring-white/30 hover:bg-white/15 sm:w-auto">
                    Réserver une démo
                  </Bouton>
                </div>
              </aside>
            </div>
          </Conteneur>
        </article>

        <section aria-labelledby="titre-autres" className="bg-[#f7f8fa] py-16 sm:py-20">
          <Conteneur className="max-w-[1000px]">
            <h2 id="titre-autres" className="text-[24px] font-semibold tracking-[-0.02em] text-[#0b1220]">À lire aussi</h2>
            <ul className="mt-6 grid gap-4 md:grid-cols-2">
              {autres.map((x) => (
                <li key={x.slug}>
                  <Link to={`/blog/${x.slug}`} className={cn('group flex h-full flex-col rounded-[24px] bg-white p-6 ring-1 ring-black/[0.05] transition-shadow hover:shadow-[0_18px_40px_-24px_rgba(15,23,42,0.35)]', FOCUS)}>
                    <p className="text-[13px] font-semibold text-[#0167EA]">{x.sujet}</p>
                    <p className="mt-2 text-[18px] font-medium leading-snug tracking-[-0.015em] text-[#0b1220]">{typo(x.titre)}</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-[14px] font-medium text-[#0167EA]">
                      Lire l’article<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </span>
                  </Link>
                </li>
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
