/**
 * Rattacher une zone du plan à un ouvrage du diagnostic.
 *
 * Une zone tracée connaît sa surface, un ouvrage attend une quantité : tant que
 * les deux ne se parlaient pas, la surface relevée au plan restait un nombre
 * affiché sur un calque et le devis continuait de travailler sur une estimation
 * déduite des dimensions du bâtiment.
 *
 * Le choix se fait parmi les ouvrages du relevé, mais aussi dans la base CFC du
 * bureau : on métré souvent les plans au bureau, avant d'être passé sur place.
 * Choisir un article de la base l'ajoute au relevé, sans état ni priorité,
 * exactement comme le ferait l'éditeur de diagnostic : même article, même
 * étape de visite, même quantité de départ tirée du bâtiment
 * (`resolutionDeQuantite`). L'ouvrage existe alors, la zone s'y rattache, et
 * la visite n'a plus qu'à lui donner son état.
 */
import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Search, Link2Off, Check, Plus } from 'lucide-react'
import { useOuvragesDuProjet } from './ouvrages'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { uniteCourte } from '@/lib/devis'
import { natureDeLUnite, type NatureQuantite } from '@/lib/plan-quantites'
import { useBaseCfc } from '@/lib/base-cfc/requete'
import { ouvrageDeLArticle, uniteEnClair } from '@/lib/base-cfc/pont'
import { quantiteALAjout } from '@/lib/base-cfc/quantite-comptee'
import { donneesDuBatiment } from '@/lib/base-cfc/batiment'
import { localisationDeLaZone } from '@/lib/base-cfc/catalogue'
import { stateLabels } from '@/data/mock'
import type { ApiArticle, ApiDiagnosticItem } from '@/lib/api-types'

/** Nombre d'articles du catalogue proposés : au-delà, la recherche sert mieux. */
const MAX_CATALOGUE = 25

export function ChoixOuvrage({ projectId, nature, choisi, onChoisir, onFermer }: {
  projectId: string
  /** Ce que la zone sait mesurer : les ouvrages d'une autre grandeur sont signalés. */
  nature: NatureQuantite
  choisi: string | null
  onChoisir: (itemId: string | null) => void
  onFermer: () => void
}) {
  const queryClient = useQueryClient()
  const { items, chargement, aucunDiagnostic, diagnosticId, project } = useOuvragesDuProjet(projectId)
  const [recherche, setRecherche] = useState('')

  const base = useBaseCfc()

  /** Ajoute l'article au relevé, puis rattache la zone à l'ouvrage créé. */
  const ajouter = useMutation({
    mutationFn: async (article: ApiArticle) => {
      // Même ajout que depuis l'éditeur de diagnostic : ni état, ni coût tant que
      // personne n'a jugé l'ouvrage. Seule la quantité déduite du bâtiment est
      // posée, et c'est justement elle que la mesure du plan viendra remplacer.
      // L'article se relève à sa première étape de visite : celle où on le
      // retrouvera en passant sur place.
      const etape = [...article.etapes].sort((a, b) => a.etapeNumero - b.etapeNumero)[0]?.etapeNumero ?? null
      const ouvrage = ouvrageDeLArticle(article, etape)
      // Dans une catégorie comptée, le deuxième type arrive sans quantité et le
      // premier garde explicitement ses unités, comme depuis l'éditeur.
      const { quantity: quantite, aFixer } = quantiteALAjout(ouvrage, donneesDuBatiment(project ?? {}), items, base.data?.articles ?? [])
      for (const f of aFixer) await api.diagnostics.updateItem(f.id, { unites: f.unites })
      const zone = base.data?.etapes.find((e) => e.numero === etape)?.zone
      return api.diagnostics.createItem(diagnosticId!, {
        cfcCode: ouvrage.cfcCode,
        cfcLabel: ouvrage.description,
        articleId: ouvrage.articleId,
        etapeNumero: etape,
        localisation: zone ? localisationDeLaZone(zone) : null,
        state: null,
        priority: null,
        works: [],
        photos: [],
        area: quantite ?? null,
        unit: ouvrage.unit,
      })
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['diagnostic-items', diagnosticId] })
      onChoisir(r.item.id)
    },
  })

  const releve = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    const filtres = q ? items.filter((i) => `${i.cfcCode} ${i.cfcLabel}`.toLowerCase().includes(q)) : items
    // Les ouvrages dont l'unité correspond à ce qui est tracé passent devant :
    // ce sont les seuls sur lesquels la quantité pourra être reportée.
    return [...filtres].sort((a, b) => {
      const ca = natureDeLUnite(a.unit) === nature ? 0 : 1
      const cb = natureDeLUnite(b.unit) === nature ? 0 : 1
      if (ca !== cb) return ca - cb
      return (a.cfcCode ?? '').localeCompare(b.cfcCode ?? '', undefined, { numeric: true })
    })
  }, [items, recherche, nature])

  const articles = useMemo(() => {
    const tous = (base.data?.articles ?? []).filter((a) => a.actif)
    const q = recherche.trim().toLowerCase()
    // Un article déjà relevé n'est pas reproposé : il est dans la liste du dessus.
    const dejaLa = new Set(items.map((i) => i.articleId).filter((x): x is string => !!x))
    const filtres = tous.filter((a) => !dejaLa.has(a.id)
      && (!q || `${a.cfcCode} ${a.nom}`.toLowerCase().includes(q)))
    // Sans recherche, on ne déroule pas toute la base : on montre les articles
    // dont l'unité correspond à ce qui vient d'être tracé, les plus utiles ici.
    const unite = (a: ApiArticle) => natureDeLUnite(uniteEnClair(a.uniteEntretien))
    const pertinents = filtres.filter((a) => unite(a) === nature)
    const retenus = q ? filtres : pertinents
    return [...retenus]
      .sort((a, b) => {
        const ca = unite(a) === nature ? 0 : 1
        const cb = unite(b) === nature ? 0 : 1
        if (ca !== cb) return ca - cb
        return a.cfcCode.localeCompare(b.cfcCode, undefined, { numeric: true })
      })
      .slice(0, MAX_CATALOGUE)
  }, [base.data, items, recherche, nature])

  const vide = !chargement && releve.length === 0 && articles.length === 0

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
          ) : vide ? (
            <p className="px-3 py-10 text-center text-sm text-muted-foreground">Aucun ouvrage ne correspond.</p>
          ) : (
            <>
              {releve.length > 0 && (
                <>
                  <Section>Dans le relevé</Section>
                  {releve.map((it) => (
                    <LigneOuvrage key={it.id} it={it} nature={nature} actif={it.id === choisi} onChoisir={onChoisir} />
                  ))}
                </>
              )}

              {articles.length > 0 && (
                <>
                  <Section>
                    Dans la base CFC
                    <span className="ml-1.5 font-normal normal-case tracking-normal">
                      · l’article choisi est ajouté au relevé
                    </span>
                  </Section>
                  {articles.map((c) => (
                    <LigneArticle
                      key={c.id}
                      article={c}
                      nature={nature}
                      enCours={ajouter.isPending && ajouter.variables?.id === c.id}
                      onAjouter={() => ajouter.mutate(c)}
                    />
                  ))}
                </>
              )}
            </>
          )}

          {ajouter.isError && (
            <p className="px-3 py-2 text-sm text-destructive">
              L’ajout a échoué : {(ajouter.error as Error)?.message}
            </p>
          )}
        </div>

        {/* Au téléphone, la fenêtre est posée au bas de l'écran : ses boutons
            restent au-dessus de la barre d'accueil de l'iPhone. Centrée sur un
            écran plus large, elle n'en a pas besoin. */}
        <div className="flex items-center justify-between gap-2 border-t p-3 pb-[calc(var(--safe-bottom)+0.75rem)] sm:pb-3">
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

function Section({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
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

function LigneArticle({ article, nature, enCours, onAjouter }: {
  article: ApiArticle
  nature: NatureQuantite
  enCours: boolean
  onAjouter: () => void
}) {
  const unite = uniteEnClair(article.uniteEntretien)
  const compatible = natureDeLUnite(unite) === nature
  return (
    <button
      onClick={onAjouter}
      disabled={enCours}
      className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted disabled:opacity-60"
    >
      <span className="mt-0.5 w-14 shrink-0 font-mono text-xs text-muted-foreground">{article.cfcCode}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{article.nom}</span>
        <span className="block text-xs text-muted-foreground">
          Pas encore relevé{unite ? ` · ${unite}` : ''}
          {!compatible && <span className="text-amber-600"> · unité incompatible</span>}
        </span>
      </span>
      {enCours
        ? <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        : <Plus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
    </button>
  )
}
