import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Clock, Lightbulb, AlertTriangle, ChevronRight, BookOpen } from 'lucide-react'
import { Card, CardContent } from '@/components/ui'
import { ARTICLES, CATEGORIES, type Article, type Bloc } from '@/data/documentation'
import { minutesDeLecture } from '@/lib/recherche-aide'

/** Un article de la documentation, avec son sommaire et ses suites. */
export function SupportArticle() {
  const { slug } = useParams()
  const article = ARTICLES.find((a) => a.slug === slug)

  if (!article) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardContent className="py-14 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" strokeWidth={1.6} />
            <p className="mt-3 font-medium">Cet article n’existe pas ou plus</p>
            <p className="mt-1 text-sm text-muted-foreground">Il a peut-être été renommé. Le centre d’aide vous remettra sur la bonne page.</p>
            <Link to="/app/support" className="mt-4 inline-block text-sm font-medium text-blue-700 hover:underline">Ouvrir le centre d’aide</Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const categorie = CATEGORIES.find((c) => c.id === article.categorie)
  const voisins = ARTICLES.filter((a) => a.categorie === article.categorie)
  const position = voisins.findIndex((a) => a.slug === article.slug)
  const precedent = voisins[position - 1]
  const suivant = voisins[position + 1]
  const suites = (article.voirAussi ?? [])
    .map((s) => ARTICLES.find((a) => a.slug === s))
    .filter((a): a is Article => Boolean(a))

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground" aria-label="Fil d’Ariane">
        <Link to="/app/support" className="font-medium hover:text-foreground">Centre d’aide</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="truncate">{categorie?.label ?? 'Documentation'}</span>
      </nav>

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_200px]">
        <article className="min-w-0">
          <header className="border-b pb-5">
            <h1 className="text-2xl font-bold leading-tight">{article.titre}</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{article.resume}</p>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />{minutesDeLecture(article)} min de lecture
            </p>
          </header>

          <div className="space-y-8 pt-7">
            {article.sections.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-6">
                <h2 className="text-lg font-semibold tracking-tight">{s.titre}</h2>
                <div className="mt-3 space-y-3.5">
                  {s.blocs.map((b, i) => <BlocRendu key={i} bloc={b} />)}
                </div>
              </section>
            ))}
          </div>

          {suites.length > 0 && (
            <div className="mt-10 border-t pt-6">
              <p className="mb-3 text-sm font-semibold">À lire ensuite</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {suites.map((a) => (
                  <Link
                    key={a.slug}
                    to={`/app/support/doc/${a.slug}`}
                    className="group rounded-xl border border-black/[0.06] p-3.5 transition-colors hover:bg-muted/40"
                  >
                    <p className="text-sm font-medium">{a.titre}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.resume}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-col gap-2 border-t pt-6 sm:flex-row sm:justify-between">
            {precedent ? (
              <Link to={`/app/support/doc/${precedent.slug}`} className="group flex min-w-0 items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
                <span className="truncate">{precedent.titre}</span>
              </Link>
            ) : <span />}
            {suivant && (
              <Link to={`/app/support/doc/${suivant.slug}`} className="group flex min-w-0 items-center gap-2 text-sm text-muted-foreground hover:text-foreground sm:justify-end">
                <span className="truncate">{suivant.titre}</span>
                <ArrowRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
          </div>
        </article>

        {/* Le sommaire : un article de documentation se parcourt autant qu'il se lit. */}
        {article.sections.length > 1 && (
          <aside className="hidden lg:sticky lg:top-4 lg:block">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Sur cette page</p>
            <ul className="space-y-1 border-l">
              {article.sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="-ml-px block border-l border-transparent py-1 pl-3 text-sm text-muted-foreground transition-colors hover:border-blue-600 hover:text-foreground">
                    {s.titre}
                  </a>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </div>
  )
}

function BlocRendu({ bloc }: { bloc: Bloc }) {
  if (bloc.type === 'texte') return <p className="text-[15px] leading-[1.75] text-neutral-700">{bloc.texte}</p>

  if (bloc.type === 'liste') {
    return (
      <ul className="space-y-1.5">
        {bloc.items.map((it, i) => (
          <li key={i} className="flex gap-2.5 text-[15px] leading-[1.7] text-neutral-700">
            <span className="mt-[0.6rem] h-1 w-1 shrink-0 rounded-full bg-neutral-400" aria-hidden />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    )
  }

  if (bloc.type === 'etapes') {
    return (
      <ol className="space-y-2">
        {bloc.items.map((it, i) => (
          <li key={i} className="flex gap-3 text-[15px] leading-[1.7] text-neutral-700">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[11px] font-bold text-blue-700">{i + 1}</span>
            <span>{it}</span>
          </li>
        ))}
      </ol>
    )
  }

  const astuce = bloc.type === 'astuce'
  const Icon = astuce ? Lightbulb : AlertTriangle
  return (
    <div className={`flex gap-3 rounded-xl p-3.5 ${astuce ? 'bg-blue-50/70' : 'bg-amber-50/70'}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${astuce ? 'text-blue-600' : 'text-amber-600'}`} strokeWidth={2} />
      <div className="min-w-0">
        <p className={`text-[11px] font-semibold uppercase tracking-wider ${astuce ? 'text-blue-700' : 'text-amber-700'}`}>
          {astuce ? 'Bon à savoir' : 'À surveiller'}
        </p>
        <p className="mt-0.5 text-sm leading-relaxed text-neutral-700">{bloc.texte}</p>
      </div>
    </div>
  )
}
