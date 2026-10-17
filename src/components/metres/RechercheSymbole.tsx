/**
 * La carte de la recherche d'un symbole : où il a été retrouvé, feuille par
 * feuille, et de quoi en faire des repères de comptage.
 *
 * Chaque occurrence se coche ou se décoche après l'avoir regardée (« Voir »
 * ouvre sa feuille et la cadre) : une légende reprend souvent le symbole
 * qu'on compte, et ne doit pas entrer dans le compte. Les occurrences
 * cochées deviennent des repères de la catégorie choisie, déjà validés.
 */
import { Check, Eye, Loader2, ScanSearch, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CATEGORIE, CLES_CATEGORIES, type CategorieComptee } from '@/lib/base-cfc/comptages'
import { COULEURS_CATEGORIE } from '@/lib/plans/analyse-ia'

export interface ResultatSymbole {
  id: string
  planId: string
  page: number
  feuille: string
  x: number
  y: number
}

export function CarteRechercheSymbole({ progres, resultats, coches, categorie, onCocher, onVoir, onCategorie, onCompter, onFermer }: {
  /** La recherche tourne : feuilles parcourues sur le total. */
  progres: { fait: number; total: number } | null
  resultats: ResultatSymbole[]
  coches: ReadonlySet<string>
  categorie: CategorieComptee
  onCocher: (id: string) => void
  onVoir: (r: ResultatSymbole) => void
  onCategorie: (c: CategorieComptee) => void
  onCompter: () => void
  onFermer: () => void
}) {
  const parFeuille = new Map<string, ResultatSymbole[]>()
  for (const r of resultats) parFeuille.set(r.feuille, [...(parFeuille.get(r.feuille) ?? []), r])
  const n = resultats.filter((r) => coches.has(r.id)).length
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center p-3 pb-[calc(var(--safe-bottom)+0.75rem)]">
      <div role="dialog" aria-label="Recherche d’un symbole" className="pointer-events-auto flex max-h-[55vh] w-full max-w-xl flex-col rounded-2xl border bg-background p-3 shadow-2xl">
        <div className="flex items-center gap-2">
          <ScanSearch className="h-4 w-4" />
          <p className="min-w-0 flex-1 text-sm font-semibold">
            {progres ? `Recherche du symbole… ${progres.fait}/${progres.total} feuilles` : `${resultats.length} occurrence${resultats.length > 1 ? 's' : ''} du symbole`}
          </p>
          <button onClick={onFermer} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted pointer-coarse:h-11 pointer-coarse:w-11" title="Fermer">
            <X className="h-4 w-4" />
          </button>
        </div>
        {progres ? (
          <p className="flex items-center gap-2 py-3 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Lecture des traits de chaque feuille vectorielle…</p>
        ) : resultats.length === 0 ? (
          <p className="py-3 text-xs text-muted-foreground">Aucune occurrence : le symbole n’est dessiné qu’une fois, ou à une autre échelle sur les autres feuilles.</p>
        ) : (
          <>
            <p className="mt-0.5 text-xs text-muted-foreground">Décochez ce qui n’est pas à compter (une légende, un cartouche), puis comptez.</p>
            <div className="-mx-1 mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto px-1">
              {[...parFeuille.entries()].map(([feuille, rs]) => (
                <div key={feuille} className="rounded-lg border">
                  <p className="border-b bg-muted/40 px-2.5 py-1 text-[11px] font-medium">{feuille} · {rs.length}</p>
                  <ul className="flex flex-wrap gap-1 p-1.5">
                    {rs.map((r, i) => (
                      <li key={r.id} className={cn('flex items-center rounded-md border', coches.has(r.id) ? 'border-foreground' : 'opacity-50')}>
                        <button onClick={() => onCocher(r.id)} className="flex items-center gap-1 px-1.5 py-1 text-xs pointer-coarse:min-h-11" aria-pressed={coches.has(r.id)}>
                          <span className={cn('flex h-3.5 w-3.5 items-center justify-center rounded border', coches.has(r.id) && 'border-foreground bg-foreground text-background')}>
                            {coches.has(r.id) && <Check className="h-2.5 w-2.5" />}
                          </span>
                          {i + 1}
                        </button>
                        <button onClick={() => onVoir(r)} className="border-l px-1.5 py-1 text-muted-foreground hover:text-foreground pointer-coarse:min-h-11" title="Voir sur le plan">
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: COULEURS_CATEGORIE[categorie] }} aria-hidden />
              <select
                value={categorie}
                onChange={(e) => onCategorie(e.target.value as CategorieComptee)}
                className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-primary pointer-coarse:h-11"
                aria-label="Catégorie des repères"
              >
                {CLES_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORIE[c].libelle}</option>)}
              </select>
              <button
                onClick={onCompter}
                disabled={n === 0}
                className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-40 pointer-coarse:h-11"
              >
                <Check className="h-4 w-4" />Compter ({n})
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
