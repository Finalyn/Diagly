import { useEffect } from 'react'
import { AlertTriangle, ArrowRight, Check, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { Oubli, ReleveIncomplet } from '@/lib/oublis'
import { phraseDuGroupe, type GroupeSurface } from '@/lib/groupes-surface'
import type { ApiDiagnosticItem } from '@/lib/api-types'

/**
 * Ce qui reste à faire, en une liste qu'on peut parcourir.
 *
 * Le bandeau disait « 2 ouvrages dégradés sans photo » sans dire lesquels. Sur le
 * terrain, cette phrase oblige à redescendre toute la nomenclature pour retrouver
 * les deux. Ici chaque ligne ouvre l'ouvrage concerné : on y va, on photographie,
 * on revient.
 *
 * Le même écran sert à clore la visite. Avant de marquer un relevé terminé, on
 * montre ce qui ne l'est pas. Pas pour l'interdire, un diagnostiqueur sait ce
 * qu'il fait et certains ouvrages restent inaccessibles : pour qu'il ne l'apprenne
 * pas de retour au bureau.
 */

export type ModeRecap = 'consultation' | 'fin'

export function RecapOublis({
  incomplets, restants, groupesMalRepartis, mode, onOuvrir, onFermer, onTerminer, terminaisonEnCours,
}: {
  incomplets: ReleveIncomplet<ApiDiagnosticItem>[]
  /** Ouvrages du catalogue pas encore relevés. Ce n'est pas un oubli, mais ça compte pour clore. */
  restants: number
  /**
   * Groupes de surface dont les parts ne font pas 100 %.
   *
   * Ce n'est pas un oubli de relevé mais une erreur de calcul : tant qu'une
   * façade est répartie à 140 %, le devis la chiffre une fois et demie. Elle
   * passe donc en tête du récapitulatif, avant ce qui manque.
   */
  groupesMalRepartis?: GroupeSurface[]
  mode: ModeRecap
  onOuvrir: (itemId: string) => void
  onFermer: () => void
  onTerminer?: () => void
  terminaisonEnCours?: boolean
}) {
  useEffect(() => {
    const auClavier = (e: KeyboardEvent) => { if (e.key === 'Escape') onFermer() }
    window.addEventListener('keydown', auClavier)
    return () => window.removeEventListener('keydown', auClavier)
  }, [onFermer])

  const importants = incomplets.filter((r) => r.oublis.some((o) => o.gravite === 'importante'))
  const legers = incomplets.filter((r) => !r.oublis.some((o) => o.gravite === 'importante'))
  const malRepartis = groupesMalRepartis ?? []
  const rienAsignaler = incomplets.length === 0 && restants === 0 && malRepartis.length === 0

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'fin' ? 'Terminer le relevé' : 'Ce qui reste à faire'}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6"
      onClick={(e) => { if (e.target === e.currentTarget) onFermer() }}
    >
      <div className="flex max-h-[90dvh] w-full max-w-[620px] flex-col overflow-hidden rounded-t-2xl bg-background shadow-2xl sm:rounded-2xl">

        <div className="flex shrink-0 items-start gap-3 border-b px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">
              {mode === 'fin' ? 'Terminer le relevé ?' : 'Ce qui reste à faire'}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {rienAsignaler
                ? 'Tout est relevé, rien ne manque.'
                : mode === 'fin'
                  ? 'Voici ce qui ne sera pas dans le rapport en l’état.'
                  : 'Touchez une ligne pour aller à l’ouvrage.'}
            </p>
          </div>
          <button
            onClick={onFermer}
            aria-label="Fermer"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {rienAsignaler && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <Check className="h-6 w-6 text-green-600" />
              </span>
              <p className="text-sm text-muted-foreground">
                Chaque ouvrage porte son état et sa preuve.
              </p>
            </div>
          )}

          {restants > 0 && (
            <div className="mb-4 rounded-xl border bg-muted/40 px-4 py-3">
              <p className="text-sm font-medium">
                {restants} ouvrage{restants > 1 ? 's' : ''} du catalogue pas encore relevé{restants > 1 ? 's' : ''}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Ce n'est pas un oubli : tout le catalogue ne concerne pas tous les bâtiments.
              </p>
            </div>
          )}

          {/* Une surface mal répartie fausse un montant : elle passe avant ce qui
              manque, parce qu'un chiffre faux se voit moins qu'une photo absente. */}
          {malRepartis.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-sm font-semibold text-red-900">Surfaces mal réparties</p>
              <p className="mt-0.5 text-xs text-red-800">
                Tant que les parts ne font pas 100 %, le devis chiffre ces surfaces en trop ou en moins.
              </p>
              <ul className="mt-2 space-y-1">
                {malRepartis.map((g) => (
                  <li key={g.nom} className="text-xs text-red-900">{phraseDuGroupe(g)}</li>
                ))}
              </ul>
            </div>
          )}

          {importants.length > 0 && (
            <Groupe
              titre="À reprendre avant de rendre"
              sousTitre="Des constats qui engagent, sans leur preuve."
              lignes={importants}
              onOuvrir={onOuvrir}
              grave
            />
          )}

          {legers.length > 0 && (
            <Groupe
              titre="Sans conséquence pour le rapport"
              sousTitre="À compléter si vous repassez devant."
              lignes={legers}
              onOuvrir={onOuvrir}
            />
          )}
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t px-5 py-4">
          {mode === 'fin' ? (
            <>
              <Button variant="outline" onClick={onFermer} disabled={terminaisonEnCours}>
                Continuer le relevé
              </Button>
              <Button onClick={onTerminer} disabled={terminaisonEnCours}>
                {terminaisonEnCours
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enregistrement…</>
                  : importants.length > 0 ? 'Terminer quand même' : 'Terminer le relevé'}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={onFermer}>Fermer</Button>
          )}
        </div>
      </div>
    </div>
  )
}

function Groupe({ titre, sousTitre, lignes, onOuvrir, grave }: {
  titre: string
  sousTitre: string
  lignes: ReleveIncomplet<ApiDiagnosticItem>[]
  onOuvrir: (itemId: string) => void
  grave?: boolean
}) {
  return (
    <div className="mb-5 last:mb-0">
      <p className={cn('flex items-center gap-1.5 text-sm font-semibold', grave && 'text-orange-700')}>
        {grave && <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />}
        {titre}
      </p>
      <p className="mb-2 text-xs text-muted-foreground">{sousTitre}</p>
      <div className="space-y-1.5">
        {lignes.map(({ item, oublis }) => (
          <button
            key={item.id}
            onClick={() => onOuvrir(item.id)}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors hover:bg-muted/50',
              grave && 'border-orange-200 bg-orange-50/40',
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {item.cfcCode && (
                  <span className="mr-1.5 font-mono text-xs font-normal text-muted-foreground">{item.cfcCode}</span>
                )}
                {item.cfcLabel}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {oublis.map((o: Oubli) => o.message).join(' ')}
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  )
}
