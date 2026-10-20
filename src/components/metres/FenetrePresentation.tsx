/**
 * La présentation des métrés, ouverte depuis l'espace Métrés : plein écran,
 * les réglages à gauche, les diapositives empilées au centre. On la consulte
 * ici ; son PDF se télécharge depuis la page Rapports du dossier, le seul
 * endroit de l'app d'où un document sort.
 *
 * Elle lit le jeu que l'espace tient à jour, éditeur ouvert compris : ce
 * qu'on vient de valider y paraît sans attendre l'enregistrement. Elle se
 * passe de diagnostic : sans relevé ni photo, elle sort entière, sans les
 * diapositives de l'existant.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Minus, Plus, X } from 'lucide-react'
import type { ApiDiagnosticItem, ApiProject } from '@/lib/api-types'
import { DIAPO, OPTIONS_PRESENTATION, type OptionsPresentation } from '@/lib/plans/presentation'
import type { PanneauQuantites } from '@/lib/plans/quantites'
import type { Sia416 } from '@/lib/plans/sia416'
import { useAuth } from '@/stores/auth'
import { MarqueDuRapport } from '@/components/report/marque-contexte'
import { OptionsDeLaPresentation, PresentationMetres } from './PresentationMetres'
import { usePresentation, type JeuDePlans } from './presentation-donnees'

export function FenetrePresentation({ projet, jeu, panneau, sia, items, onFermer }: {
  projet: ApiProject | null | undefined
  jeu: JeuDePlans
  panneau: PanneauQuantites
  sia: Sia416
  items: ApiDiagnosticItem[]
  onFermer: () => void
}) {
  const [options, setOptions] = useState<OptionsPresentation>(OPTIONS_PRESENTATION)
  const p = usePresentation({ jeu, panneau, sia, projet, items, options })
  const [, setPret] = useState(false)
  // L'auteur des rapports signe aussi la présentation.
  const user = useAuth((s) => s.user)
  const auteur = projet?.reportBranding?.auteur?.trim() || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.companyName || ''

  // Les diapositives réduites à la largeur de la colonne, multipliées par la loupe.
  const [largeur, setLargeur] = useState<number | null>(null)
  const observateur = useRef<ResizeObserver | null>(null)
  const mesurer = useCallback((el: HTMLElement | null) => {
    observateur.current?.disconnect()
    if (!el) return
    observateur.current = new ResizeObserver(([e]) => setLargeur(e.contentRect.width))
    observateur.current.observe(el)
  }, [])
  const [loupe, setLoupe] = useState(1)
  const ajuste = largeur ? Math.min(1, largeur / DIAPO.largeur) : 0.6
  const zoom = Math.min(2, Math.max(0.25, ajuste * loupe))

  // L'éditeur reste monté sous la présentation : ses raccourcis (Suppr, Ctrl+Z,
  // les lettres des outils) n'agissent pas à travers elle. Échap la ferme.
  useEffect(() => {
    const arreter = (e: KeyboardEvent) => {
      e.stopPropagation()
      if (e.type === 'keydown' && e.key === 'Escape') onFermer()
    }
    window.addEventListener('keydown', arreter, true)
    window.addEventListener('keyup', arreter, true)
    return () => {
      window.removeEventListener('keydown', arreter, true)
      window.removeEventListener('keyup', arreter, true)
    }
  }, [onFermer])

  const n = p.diapositives.length
  const bouton = 'flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted pointer-coarse:h-11 pointer-coarse:w-11'

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-neutral-100" role="dialog" aria-label="Présentation des métrés">
      <header className="safe-top safe-sides shrink-0 border-b bg-background">
        <div className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
          <button onClick={onFermer} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground pointer-coarse:p-3" title="Fermer la présentation" aria-label="Fermer la présentation">
            <X className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">Présentation des métrés</p>
            <p className="truncate text-xs text-muted-foreground">
              {n} diapositive{n > 1 ? 's' : ''} · 16:9 · {p.batiment}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5 rounded-full border bg-background p-0.5">
            <button type="button" onClick={() => setLoupe((l) => Math.max(0.5, l / 1.25))} aria-label="Réduire" className={bouton}><Minus className="h-4 w-4" /></button>
            <button type="button" onClick={() => setLoupe(1)} aria-label="Ajuster à la largeur" className="min-w-14 rounded-full px-2 text-xs font-semibold tabular-nums hover:bg-muted pointer-coarse:min-h-11">
              {Math.round(zoom * 100)} %
            </button>
            <button type="button" onClick={() => setLoupe((l) => Math.min(3, l * 1.25))} aria-label="Agrandir" className={bouton}><Plus className="h-4 w-4" /></button>
          </div>
          {projet && (
            <Link
              to={`/app/projects/${projet.id}/rapports`}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 pointer-coarse:min-h-11"
              title="Le PDF de la présentation se télécharge depuis les Rapports du dossier"
            >
              <FileText className="h-4 w-4" />
              Télécharger depuis Rapports
            </Link>
          )}
        </div>
      </header>

      <div className="safe-sides flex min-h-0 flex-1">
        <aside className="w-72 shrink-0 overflow-y-auto border-r bg-background p-3 pb-[calc(var(--safe-bottom)+1rem)]">
          <OptionsDeLaPresentation
            elements={p.elements}
            siaDisponible={p.siaDisponible}
            photosDisponibles={p.photosDisponibles}
            options={options}
            onOptions={setOptions}
          />
        </aside>
        <main className="min-w-0 flex-1 overflow-auto p-6 pb-[calc(var(--safe-bottom)+1.5rem)]">
          <div ref={mesurer} style={{ '--zoom-diapo': String(zoom) } as CSSProperties}>
            <MarqueDuRapport dossier={projet?.reportBranding ?? null} auteur={auteur}>
              {n > 0 ? (
                <PresentationMetres
                  diapositives={p.diapositives}
                  plans={p.plans}
                  attenue={options.attenue}
                  batiment={p.batiment}
                  adresse={p.adresse}
                  onPret={setPret}
                />
              ) : (
                <p className="mx-auto max-w-md py-24 text-center text-sm text-muted-foreground">
                  {p.elements.length
                    ? 'Cochez au moins un élément à présenter.'
                    : 'Aucun métré validé pour l’instant : validez des formes sur les feuilles, la présentation se compose d’elle-même.'}
                </p>
              )}
            </MarqueDuRapport>
          </div>
        </main>
      </div>
    </div>
  )
}
