/**
 * La page Métrés, ouverte depuis l'accueil.
 *
 * En tête, la zone où l'on dépose un jeu de plans ; dessous, les métrés déjà
 * faits, un par dossier qui a des plans : le bâtiment, le nombre de feuilles,
 * où en est leur analyse, ce qui attend d'être validé. Un clic ouvre
 * l'espace de travail du bâtiment. Sans aucun métré, un exemple animé montre
 * ce que l'IA fera des plans (ExempleMetres).
 *
 * En tête aussi, de quoi apprendre l'outil : la visite guidée, qui entoure
 * les boutons au fur et à mesure, et le tutoriel écrit. Le téléphone n'a pas
 * de visite guidée (la bulle n'y tiendrait pas à côté de ce qu'elle montre) :
 * il ouvre le tutoriel.
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ChevronRight, Compass, GraduationCap, Loader2, MapPin } from 'lucide-react'
import { api } from '@/lib/api'
import type { ApiMetre } from '@/lib/api-types'
import { cn, formatDate } from '@/lib/utils'
import { useIsMobile } from '@/lib/use-mobile'
import { useVisite } from '@/stores/visite'
import { ApercuPlan } from '@/components/plans/ApercuPlan'
import { DepotPlans } from '@/components/metres/DepotPlans'
import { ExempleMetres } from '@/components/metres/ExempleMetres'
import { etatAnalyse, feuillesDe, nombreDePages, ordonnerPlans } from '@/lib/plans/feuilles'

/** Où en est l'analyse d'un métré, en une pastille. */
function etatDuMetre(m: ApiMetre): { feuilles: number | null; libelle: string; classe: string } {
  let total = 0, pretes = 0, enCours = 0, erreurs = 0, inconnu = false
  for (const plan of m.plans) {
    const f = feuillesDe(plan)
    const n = nombreDePages(plan, f)
    if (!n) { inconnu = true; continue }
    for (let page = 1; page <= n; page++) {
      total++
      const etat = etatAnalyse(plan, f, page)
      if (etat === 'prete') pretes++
      else if (etat === 'en_cours' || etat === 'en_file') enCours++
      else if (etat === 'erreur') erreurs++
    }
  }
  const feuilles = inconnu ? null : total
  if (enCours) return { feuilles, libelle: `Analyse en cours · ${pretes}/${total}`, classe: 'bg-sky-50 text-sky-700' }
  if (erreurs) return { feuilles, libelle: `${erreurs} feuille${erreurs > 1 ? 's' : ''} en erreur`, classe: 'bg-red-50 text-red-700' }
  if (total && pretes === total) return { feuilles, libelle: 'Analysé', classe: 'bg-emerald-50 text-emerald-700' }
  if (pretes) return { feuilles, libelle: `Analysé en partie · ${pretes}/${total}`, classe: 'bg-amber-50 text-amber-700' }
  return { feuilles, libelle: 'Non analysé', classe: 'bg-muted text-muted-foreground' }
}

export function Metres() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['metres'], queryFn: () => api.plans.metres() })
  const metres = useMemo(() => data?.metres ?? [], [data])
  const telephone = useIsMobile()
  const demarrer = useVisite((s) => s.demarrer)
  const lien = 'inline-flex h-9 items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted pointer-coarse:min-h-11'

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[32px] font-normal leading-none tracking-tight text-foreground">Métrés</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">Un jeu de plans, toutes ses quantités, feuille par feuille.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!telephone && (
            <button onClick={() => demarrer('metres')} className={lien} data-visite="metres-aide">
              <Compass className="h-4 w-4" />Visite guidée
            </button>
          )}
          <Link to="/app/support/tuto/metres" className={lien}>
            <GraduationCap className="h-4 w-4" />{telephone ? 'Comment ça marche' : 'Tutoriel'}
          </Link>
        </div>
      </div>

      <DepotPlans />

      <section data-visite="metres-liste">
        <h2 className="mb-3 text-[16px] font-semibold text-foreground">Vos métrés</h2>
        {isLoading ? (
          <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Chargement…</p>
        ) : isError ? (
          <p className="flex items-center gap-2 py-10 text-sm text-red-700"><AlertCircle className="h-4 w-4" />Les métrés n’ont pas pu être chargés.</p>
        ) : metres.length === 0 ? (
          <ExempleMetres />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {metres.map((m, i) => <CarteMetre key={m.projectId} metre={m} visite={i === 0 ? 'metres-carte' : undefined} />)}
          </div>
        )}
      </section>
    </div>
  )
}

/** `visite` : repère désigné par la visite guidée, posé sur la première carte. */
function CarteMetre({ metre, visite }: { metre: ApiMetre; visite?: string }) {
  const etat = etatDuMetre(metre)
  const premier = ordonnerPlans(metre.plans)[0]
  const aValider = metre.plans.reduce((s, p) => s + p.aValider, 0)
  const documents = metre.plans.length
  return (
    <Link
      to={`/app/metres/${metre.projectId}`}
      data-visite={visite}
      className="group flex flex-col overflow-hidden rounded-2xl border bg-card transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_40px_-16px_rgba(0,0,0,0.22)]"
    >
      {premier && <ApercuPlan plan={premier} largeurCible={480} className="aspect-[16/9] w-full border-b" />}
      <div className="flex items-start gap-2 p-3.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-foreground">{metre.nom}</p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{[metre.adresse, metre.ville].filter(Boolean).join(', ') || 'Adresse à lire au cartouche'}</span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', etat.classe)}>{etat.libelle}</span>
            {aValider > 0 && <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700">{aValider} à valider</span>}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {etat.feuilles != null ? `${etat.feuilles} feuille${etat.feuilles > 1 ? 's' : ''}` : `${documents} document${documents > 1 ? 's' : ''}`}
            {etat.feuilles != null && documents > 1 ? ` · ${documents} documents` : ''}
            {' · '}mis à jour le {formatDate(new Date(metre.misAJour))}
          </p>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-foreground" />
      </div>
    </Link>
  )
}
