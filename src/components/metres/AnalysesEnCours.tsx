import { useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronRight, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { abonnerAnalyses, instantaneDesAnalyses, moteurDe } from './moteur'

/**
 * L'indicateur des analyses de plans, partout dans l'app (AppLayout).
 *
 * L'analyse d'un jeu de plans continue quand on quitte l'espace Métrés : le
 * moteur vit hors des écrans (moteur.ts). Cette pastille, en bas de l'écran,
 * dit où il en est (« Analyse des plans en cours, 4 feuilles restantes ») et
 * mène au dossier. À la fin, elle devient « Plans analysés » jusqu'à ce qu'on
 * l'ouvre ou qu'on la ferme ; si l'on était ailleurs, la notification est
 * aussi partie (la cloche, et le push sur l'appareil).
 *
 * L'espace Métrés est hors d'AppLayout : la pastille n'y paraît pas, l'écran y
 * montre déjà la file.
 */
export function AnalysesEnCours() {
  const analyses = useSyncExternalStore(abonnerAnalyses, instantaneDesAnalyses, instantaneDesAnalyses)
  if (!analyses.length) return null

  return (
    <div
      aria-live="polite"
      className="js-print-hide pointer-events-none fixed inset-x-0 z-40 flex flex-col items-center gap-2 px-3 bottom-[calc(var(--safe-bottom)+5.5rem)] lg:bottom-5"
    >
      {analyses.map((a) => {
        const finie = !a.enMarche && !!a.fin
        const lien = `/app/metres/${a.projectId}`
        const fermer = () => moteurDe(a.projectId).oublierFin()
        return (
          <div
            key={a.projectId}
            className="dp-pop pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-black/[0.06] bg-white/95 py-2.5 pl-3 pr-2 shadow-[0_18px_40px_-16px_rgba(15,23,42,0.35)] backdrop-blur-md"
          >
            <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', finie ? 'bg-emerald-50 text-emerald-600' : 'bg-sky-50 text-sky-600')}>
              {finie ? <Check className="h-4 w-4" strokeWidth={2.6} /> : <Loader2 className="h-4 w-4 animate-spin" />}
            </span>
            <Link to={lien} onClick={finie ? fermer : undefined} className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold text-foreground">
                {finie ? 'Plans analysés' : 'Analyse des plans en cours'}
              </span>
              <span className="block truncate text-[12.5px] text-muted-foreground">
                {a.nom} · {finie ? bilan(a.fin!) : restantes(a.restantes)}
              </span>
            </Link>
            <Link to={lien} onClick={finie ? fermer : undefined} className="flex h-9 shrink-0 items-center gap-0.5 rounded-xl px-2.5 text-[13px] font-medium text-foreground hover:bg-muted pointer-coarse:min-h-11">
              {finie ? 'Voir' : 'Suivre'}<ChevronRight className="h-4 w-4" />
            </Link>
            {finie && (
              <button onClick={fermer} title="Fermer" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted pointer-coarse:min-h-11 pointer-coarse:w-11">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

function restantes(n: number) {
  if (n <= 0) return 'Rangement des résultats…'
  return `${n} feuille${n > 1 ? 's' : ''} restante${n > 1 ? 's' : ''}`
}

function bilan(f: { faites: number; erreurs: number }) {
  const faites = f.faites ? `${f.faites} feuille${f.faites > 1 ? 's' : ''} à valider` : 'Aucune feuille analysée'
  return f.erreurs ? `${faites}, ${f.erreurs} en erreur` : faites
}
