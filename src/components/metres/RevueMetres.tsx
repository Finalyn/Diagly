/**
 * La carte de la revue : un élément à valider à la fois, posé sur le plan
 * qui l'a cadré, avec ce qu'il faut pour décider.
 *
 * Tout se fait au clavier (Entrée valide, Suppr rejette, les flèches passent
 * au précédent ou au suivant, Échap quitte) ou avec de gros boutons au doigt
 * sur iPad. La carte dit où l'on en est (« 12 / 87 »), ce qu'est l'élément,
 * sa confiance, sa provenance (aimanté ou non sur le dessin) et ce que disent
 * les cotes lues.
 */
import { ArrowLeft, ArrowRight, Check, Loader2, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MarqueDiagly } from '@/components/plans/AnalyseIA'
import type { ElementRevue } from '@/lib/plans/revue'
import { quantiteLisible } from '@/lib/plans/quantites'

const CONFIANCES = {
  basse: { libelle: 'Confiance basse', classe: 'bg-red-50 text-red-700' },
  moyenne: { libelle: 'Confiance moyenne', classe: 'bg-amber-50 text-amber-700' },
  haute: { libelle: 'Confiance haute', classe: 'bg-emerald-50 text-emerald-700' },
} as const

export function CarteRevue({
  element, position, total, decision, validees, rejetees, pret, onValider, onRejeter, onPrecedent, onSuivant, onQuitter,
}: {
  element: ElementRevue | null
  /** Rang de l'élément dans la file, à partir de 1. */
  position: number
  total: number
  /** Ce qui a déjà été décidé pour cet élément pendant la revue. */
  decision: 'validee' | 'rejetee' | null
  validees: number
  rejetees: number
  /** La feuille de l'élément est ouverte : on peut décider. */
  pret: boolean
  onValider: () => void
  onRejeter: () => void
  onPrecedent: () => void
  onSuivant: () => void
  onQuitter: () => void
}) {
  const fini = !element
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center p-3 pb-[calc(var(--safe-bottom)+0.75rem)]">
      <div role="dialog" aria-label="Revue des éléments à valider" className="pointer-events-auto w-full max-w-xl rounded-2xl border bg-background/97 p-3 shadow-2xl backdrop-blur">
        <div className="flex items-center gap-2">
          <MarqueDiagly className="h-4 w-4" />
          <p className="min-w-0 flex-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Revue · <span className="tabular-nums text-foreground">{fini ? total : position} / {total}</span>
            <span className="ml-2 normal-case tracking-normal">{validees} validé{validees > 1 ? 's' : ''} · {rejetees} rejeté{rejetees > 1 ? 's' : ''}</span>
          </p>
          <button onClick={onQuitter} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted pointer-coarse:h-11 pointer-coarse:w-11" title="Quitter la revue (Échap)">
            <X className="h-4 w-4" />
          </button>
        </div>

        {fini ? (
          <div className="py-3 text-center">
            <p className="text-sm font-semibold">Revue terminée</p>
            <p className="text-xs text-muted-foreground">Plus rien n’attend d’être validé dans ce jeu de plans.</p>
            <button onClick={onQuitter} className="mt-3 h-11 rounded-xl bg-foreground px-6 text-sm font-semibold text-background">Fermer</button>
          </div>
        ) : (
          <>
            <div className="mt-1.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{element.type} · {element.feuille}</p>
                <p className="truncate text-base font-semibold">{element.libelle}</p>
              </div>
              {element.mesure && (
                <p className="shrink-0 text-lg font-semibold tabular-nums">
                  {element.mesure.exacte ? '' : '≈ '}{quantiteLisible(element.mesure.valeur, element.mesure.unite)}
                </p>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
              {element.confiance && (
                <span className={cn('rounded-full px-2 py-0.5 font-medium', CONFIANCES[element.confiance].classe)}>{CONFIANCES[element.confiance].libelle}</span>
              )}
              <span className="rounded-full bg-muted px-2 py-0.5">{element.provenance}</span>
              {decision && (
                <span className={cn('rounded-full px-2 py-0.5 font-medium', decision === 'validee' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
                  {decision === 'validee' ? 'Validé' : 'Rejeté'}
                </span>
              )}
            </div>
            {element.cotes && <p className="mt-1 text-xs text-muted-foreground">{element.cotes}</p>}
            {element.remarque && element.remarque !== element.libelle && <p className="mt-0.5 text-xs italic text-muted-foreground">{element.remarque}</p>}

            <div className="mt-3 grid grid-cols-[auto_1fr_1fr_auto] gap-2">
              <button onClick={onPrecedent} disabled={position <= 1} className="flex h-12 w-12 items-center justify-center rounded-xl border hover:bg-muted disabled:opacity-40" title="Précédent (←)">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <button
                onClick={onRejeter}
                disabled={!pret || !!decision}
                className="flex h-12 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-40"
                title="Rejeter (Suppr)"
              >
                <Trash2 className="h-4 w-4" />Rejeter
              </button>
              <button
                onClick={onValider}
                disabled={!pret || !!decision}
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-foreground text-sm font-semibold text-background hover:opacity-90 disabled:opacity-40"
                title="Valider (Entrée)"
              >
                {pret ? <Check className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}Valider
              </button>
              <button onClick={onSuivant} disabled={position >= total} className="flex h-12 w-12 items-center justify-center rounded-xl border hover:bg-muted disabled:opacity-40" title="Suivant (→)">
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-muted-foreground pointer-coarse:hidden">
              Entrée valider · Suppr rejeter · ← → précédent, suivant · Échap quitter
            </p>
          </>
        )}
      </div>
    </div>
  )
}
