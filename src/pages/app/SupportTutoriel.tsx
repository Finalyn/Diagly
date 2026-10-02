import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, ChevronRight, Clock, GraduationCap, ListChecks, MapPin, Play, RotateCcw } from 'lucide-react'
import { Card, CardContent, Button, Badge } from '@/components/ui'
import { ARTICLES, TUTORIELS, type Article, type Tutoriel } from '@/data/documentation'
import { visitesDuTutoriel } from '@/data/visites'
import { useVisite } from '@/stores/visite'
import { Mascotte } from '@/components/visite/Mascotte'
import { cn } from '@/lib/utils'

const NIVEAUX: Record<Tutoriel['niveau'], string> = {
  'Débutant': 'bg-emerald-50 text-emerald-700',
  'Intermédiaire': 'bg-blue-50 text-blue-700',
  'Avancé': 'bg-violet-50 text-violet-700',
}

const cle = (slug: string) => `diagly.tutoriel.${slug}`

/**
 * L'avancement d'un tutoriel, gardé sur l'appareil.
 *
 * Un tutoriel se suit en faisant, pas en lisant : on quitte la page pour aller
 * dans l'application, on revient. Sans mémoire, on ne sait plus où l'on en
 * était. Le navigateur peut refuser le stockage, et ce n'est pas grave : le
 * tutoriel se lit alors simplement sans coche.
 */
function lireAvancement(slug: string): number[] {
  try {
    const brut = localStorage.getItem(cle(slug))
    const lu: unknown = brut ? JSON.parse(brut) : []
    return Array.isArray(lu) ? lu.filter((x): x is number => typeof x === 'number') : []
  } catch {
    return []
  }
}

export function SupportTutoriel() {
  const { slug } = useParams()
  const tuto = TUTORIELS.find((t) => t.slug === slug)
  const [faites, setFaites] = useState<number[]>(() => (slug ? lireAvancement(slug) : []))
  const demarrer = useVisite((s) => s.demarrer)

  if (!tuto) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <CardContent className="py-14 text-center">
            <GraduationCap className="mx-auto h-8 w-8 text-muted-foreground" strokeWidth={1.6} />
            <p className="mt-3 font-medium">Ce tutoriel n’existe pas ou plus</p>
            <p className="mt-1 text-sm text-muted-foreground">Le centre d’aide vous remettra sur la bonne page.</p>
            <Link to="/app/support" className="mt-4 inline-block text-sm font-medium text-blue-700 hover:underline">Ouvrir le centre d’aide</Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const enregistrer = (liste: number[]) => {
    setFaites(liste)
    try { localStorage.setItem(cle(tuto.slug), JSON.stringify(liste)) } catch { /* stockage refusé : tant pis */ }
  }
  const basculer = (i: number) => enregistrer(faites.includes(i) ? faites.filter((x) => x !== i) : [...faites, i])

  const suites = (tuto.pourAllerPlusLoin ?? [])
    .map((s) => ARTICLES.find((a) => a.slug === s))
    .filter((a): a is Article => Boolean(a))
  const visites = visitesDuTutoriel(tuto.slug)
  const total = tuto.etapes.length
  const fini = faites.length >= total

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground" aria-label="Fil d’Ariane">
        <Link to="/app/support" className="font-medium hover:text-foreground">Centre d’aide</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>Tutoriels</span>
      </nav>

      <header className="border-b pb-5">
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <Badge className={cn('text-[10px]', NIVEAUX[tuto.niveau])}>{tuto.niveau}</Badge>
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" />{tuto.duree}</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><ListChecks className="h-3.5 w-3.5" />{total} étapes</span>
        </div>
        <h1 className="text-2xl font-bold leading-tight">{tuto.titre}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{tuto.objectif}</p>
      </header>

      {/* Lire, ou se faire montrer : les deux mènent au même endroit. */}
      {visites.length > 0 && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-5 sm:flex-row">
          <Mascotte pose="montre" vers="droite" taille={86} className="shrink-0" />
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="font-semibold">Je peux vous le montrer dans l’application</p>
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
              Plutôt que de lire puis de chercher, laissez-moi entourer les boutons au fur et à mesure. Vous cliquez, je suis.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            {visites.map((v) => (
              <Button key={v.id} size="sm" onClick={() => demarrer(v.id)}>
                <Play className="mr-2 h-3.5 w-3.5" />{v.titre}
              </Button>
            ))}
          </div>
        </div>
      )}

      {tuto.prerequis && tuto.prerequis.length > 0 && (
        <div className="rounded-xl bg-neutral-100/70 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Avant de commencer</p>
          <ul className="mt-1.5 space-y-1">
            {tuto.prerequis.map((p, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-neutral-700">
                <span className="mt-[0.55rem] h-1 w-1 shrink-0 rounded-full bg-neutral-400" aria-hidden />{p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* L'avancement : il dit où reprendre après un passage dans l'application. */}
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200">
          <div className="h-full rounded-full bg-blue-600 transition-[width] duration-300" style={{ width: `${(faites.length / total) * 100}%` }} />
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{faites.length} / {total}</span>
        {faites.length > 0 && (
          <button onClick={() => enregistrer([])} className="shrink-0 text-xs text-muted-foreground transition-colors hover:text-foreground" title="Tout décocher">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <ol className="space-y-2.5">
        {tuto.etapes.map((e, i) => {
          const fait = faites.includes(i)
          return (
            <li key={i}>
              <Card className={cn('transition-colors', fait && 'bg-muted/30')}>
                <div className="flex gap-3.5 p-4">
                  <button
                    onClick={() => basculer(i)}
                    aria-pressed={fait}
                    aria-label={fait ? `Étape ${i + 1} faite` : `Marquer l’étape ${i + 1} comme faite`}
                    className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold transition-colors',
                      fait ? 'border-blue-600 bg-blue-600 text-white' : 'border-neutral-300 text-neutral-500 hover:border-blue-600 hover:text-blue-700')}
                  >
                    {fait ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={cn('font-medium leading-snug', fait && 'text-muted-foreground line-through')}>{e.titre}</p>
                    <p className="mt-1 text-sm leading-relaxed text-neutral-700">{e.detail}</p>
                    {e.ecran && (
                      <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700">
                        <MapPin className="h-3 w-3" />{e.ecran}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          )
        })}
      </ol>

      {fini && (
        <div className="rounded-xl bg-emerald-50 p-4 text-center">
          <p className="text-sm font-semibold text-emerald-800">Tutoriel terminé.</p>
          <p className="mt-0.5 text-sm text-emerald-700">Vous pouvez refaire le parcours à tout moment : décochez les étapes avec la flèche de reprise.</p>
        </div>
      )}

      {suites.length > 0 && (
        <div className="border-t pt-6">
          <p className="mb-3 text-sm font-semibold">Pour aller plus loin</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {suites.map((a) => (
              <Link key={a.slug} to={`/app/support/doc/${a.slug}`} className="rounded-xl border border-black/[0.06] p-3.5 transition-colors hover:bg-muted/40">
                <p className="text-sm font-medium">{a.titre}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{a.resume}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-center pt-2">
        <Link to="/app/support"><Button variant="outline">Revenir au centre d’aide</Button></Link>
      </div>
    </div>
  )
}
