/**
 * Rattacher une zone du plan à un ouvrage du diagnostic.
 *
 * Une zone tracée connaît sa surface, un ouvrage attend une quantité : tant que
 * les deux ne se parlaient pas, la surface relevée au plan restait un nombre
 * affiché sur un calque et le devis continuait de travailler sur une estimation
 * déduite des dimensions du bâtiment.
 *
 * Le choix se fait ici, dans la liste des ouvrages déjà relevés : on ne crée pas
 * d'ouvrage depuis le plan, parce qu'un ouvrage sans état ni priorité n'est pas
 * un relevé, c'est une ligne vide de plus dans le diagnostic.
 */
import { useMemo, useState } from 'react'
import { Loader2, Search, Link2Off, Check } from 'lucide-react'
import { useOuvragesDuProjet } from './ouvrages'
import { cn } from '@/lib/utils'
import { uniteCourte } from '@/lib/devis'
import { natureDeLUnite, type NatureQuantite } from '@/lib/plan-quantites'
import { stateLabels } from '@/data/mock'
import type { ApiDiagnosticItem } from '@/lib/api-types'

export function ChoixOuvrage({ projectId, nature, choisi, onChoisir, onFermer }: {
  projectId: string
  /** Ce que la zone sait mesurer : les ouvrages d'une autre grandeur sont signalés. */
  nature: NatureQuantite
  choisi: string | null
  onChoisir: (itemId: string | null) => void
  onFermer: () => void
}) {
  const { items, chargement, aucunDiagnostic } = useOuvragesDuProjet(projectId)
  const [recherche, setRecherche] = useState('')

  const liste = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    const filtres = q
      ? items.filter((i) => `${i.cfcCode} ${i.cfcLabel}`.toLowerCase().includes(q))
      : items
    // Les ouvrages dont l'unité correspond à ce qui est tracé passent devant :
    // ce sont les seuls sur lesquels la quantité pourra être reportée.
    return [...filtres].sort((a, b) => {
      const ca = natureDeLUnite(a.unit) === nature ? 0 : 1
      const cb = natureDeLUnite(b.unit) === nature ? 0 : 1
      if (ca !== cb) return ca - cb
      return (a.cfcCode ?? '').localeCompare(b.cfcCode ?? '', undefined, { numeric: true })
    })
  }, [items, recherche, nature])

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onFermer}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full flex-col rounded-t-2xl bg-background shadow-xl sm:max-w-lg sm:rounded-2xl"
      >
        <div className="border-b p-4">
          <h3 className="font-semibold">Rattacher à un ouvrage</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {nature === 'surface'
              ? 'La surface de cette zone pourra être reportée sur l’ouvrage choisi.'
              : 'La longueur de ce trait pourra être reportée sur l’ouvrage choisi.'}
          </p>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Chercher un CFC, un ouvrage…"
              className="h-11 w-full rounded-lg border pl-9 pr-3 text-base outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {chargement ? (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />Chargement des ouvrages…
            </p>
          ) : aucunDiagnostic ? (
            <p className="px-3 py-10 text-center text-sm text-muted-foreground">
              Ce dossier n’a pas encore de diagnostic. Démarrez le relevé, puis revenez rattacher les zones.
            </p>
          ) : liste.length === 0 ? (
            <p className="px-3 py-10 text-center text-sm text-muted-foreground">
              {items.length === 0 ? 'Aucun ouvrage relevé pour l’instant.' : 'Aucun ouvrage ne correspond.'}
            </p>
          ) : (
            liste.map((it) => <LigneOuvrage key={it.id} it={it} nature={nature} actif={it.id === choisi} onChoisir={onChoisir} />)
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t p-3">
          <button
            onClick={() => onChoisir(null)}
            disabled={!choisi}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-40"
          >
            <Link2Off className="h-4 w-4" />Détacher
          </button>
          <button onClick={onFermer} className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-muted">Fermer</button>
        </div>
      </div>
    </div>
  )
}

function LigneOuvrage({ it, nature, actif, onChoisir }: {
  it: ApiDiagnosticItem
  nature: NatureQuantite
  actif: boolean
  onChoisir: (itemId: string) => void
}) {
  const unite = uniteCourte(it.unit)
  const compatible = natureDeLUnite(it.unit) === nature
  return (
    <button
      onClick={() => onChoisir(it.id)}
      className={cn('flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
        actif ? 'bg-primary/10' : 'hover:bg-muted')}
    >
      <span className="mt-0.5 w-14 shrink-0 font-mono text-xs text-muted-foreground">{it.cfcCode}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{it.cfcLabel}</span>
        <span className="block text-xs text-muted-foreground">
          {it.state ? stateLabels[it.state] : 'À évaluer'}
          {unite ? ` · ${unite}` : ''}
          {it.area != null ? ` · quantité actuelle ${it.area}` : ' · pas de quantité'}
          {/* Dit pourquoi l'ouvrage est proposé mais ne recevra rien : une
              surface n'a pas de sens sur un forfait ou sur un prix à la pièce. */}
          {!compatible && <span className="text-amber-600"> · unité incompatible</span>}
        </span>
      </span>
      {actif && <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
    </button>
  )
}
