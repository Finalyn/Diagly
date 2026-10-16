/**
 * Les éléments comptés du dossier, au bureau, sans attendre la visite.
 *
 * L'IA a compté six portes palières sur les plans ; le diagnostiqueur sait,
 * lui, que deux sont en bois et quatre en métal, parce que la gérance le lui
 * a dit ou qu'il connaît l'immeuble. Il le dit ici, catégorie par catégorie,
 * avec les mêmes compteurs que dans l'éditeur de relevé : le nombre, d'où il
 * vient (page, calcul, confiance), et sa répartition entre les types relevés.
 *
 * Corriger un nombre en fait une saisie et réécrit aussitôt la quantité et le
 * coût des relevés concernés (enregistrer.ts). Vider le champ retire le
 * comptage : la catégorie retombe sur la règle de la base, comme avant.
 */
import { useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { ApiDiagnosticItem, ApiProject } from '@/lib/api-types'
import { useBaseCfc } from '@/lib/base-cfc/requete'
import { donneesDuBatiment } from '@/lib/base-cfc/batiment'
import { ouvrageDuReleve } from '@/lib/base-cfc/pont'
import { patchDesUnites } from '@/lib/base-cfc/quantite-comptee'
import {
  CATEGORIES_COMPTEES, NOMBRE_MAX, comptageSaisi, repartitionsDuDossier, reparties,
  type CategorieComptee, type Comptage, type EtatRepartition,
} from '@/lib/base-cfc/comptages'
import { saisir } from '@/lib/hors-ligne/file-envoi'
import { CompteurUnites } from './Compteur'
import { useEnregistrerComptages } from './enregistrer'

const SOURCES: Record<Comptage['source'], string> = {
  plans: 'Lu sur les plans',
  analyse: 'Compté sur un plan',
  saisie: 'Saisi au dossier',
}

const nombreFr = (v: number) => v.toLocaleString('fr-CH', { maximumFractionDigits: 2 })

export function ElementsComptes({ project, diagnosticId, items }: {
  project: ApiProject
  diagnosticId: string | null
  items: ApiDiagnosticItem[]
}) {
  const base = useBaseCfc()
  const articles = base.data?.articles ?? []
  const batiment = donneesDuBatiment(project)
  const comptages = batiment.comptages ?? {}
  const repartitions = repartitionsDuDossier(comptages, items, articles)
  const enregistrer = useEnregistrerComptages(project.id)
  const [erreur, setErreur] = useState<string | null>(null)

  const poser = (categorie: CategorieComptee, nombre: number | null, surface?: number | null) => {
    setErreur(null)
    enregistrer.mutate((actuels) => {
      const suite = { ...actuels }
      if (nombre === null) delete suite[categorie]
      else suite[categorie] = comptageSaisi(categorie, nombre, actuels[categorie], surface)
      return suite
    }, { onError: () => setErreur('Le comptage n’a pas pu être enregistré. Réessayez.') })
  }

  /** Les unités d'un type, par la file d'envoi, avec la quantité et le coût qui en découlent. */
  const poserUnites = (repartition: EtatRepartition, releveId: string, unites: number) => {
    const item = items.find((i) => i.id === releveId)
    if (!item || !diagnosticId) return
    const ouvrage = ouvrageDuReleve(item, articles)
    const corps = ouvrage ? patchDesUnites(item, unites, ouvrage, batiment, repartition) : { unites }
    void saisir({ type: 'modifier', diagnosticId, releveId, corps }).catch(() => setErreur('Le nombre n’a pas pu être enregistré sur cet appareil.'))
  }

  const nbComptees = Object.keys(comptages).length
  const aVerifier = Object.values(comptages).filter((c) => c && !c.valide).length

  return (
    <Card data-visite="metres-elements-comptes">
      <CardHeader className="space-y-1 pb-3">
        <div className="flex items-center gap-2">
          <img src="/diagly-mark.svg" alt="" aria-hidden className="h-5 w-5 shrink-0" />
          <CardTitle className="text-base">Éléments comptés</CardTitle>
          {enregistrer.isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <p className="text-sm text-muted-foreground">
          Portes, fenêtres, balcons… comptés sur les plans ou saisis ici. Un nombre compté remplace la règle de la base
          (une porte palière par logement, par exemple) ; sa répartition entre les types donne la quantité de chacun.
          {nbComptees > 0 && aVerifier > 0 && (
            <span className="font-medium text-amber-700"> {aVerifier} compte{aVerifier > 1 ? 's' : ''} lu{aVerifier > 1 ? 's' : ''} par l’IA à vérifier.</span>
          )}
        </p>
        {erreur && <p className="text-sm text-red-700">{erreur}</p>}
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          {CATEGORIES_COMPTEES.map((def) => {
            const c = comptages[def.cle]
            const r = repartitions.find((x) => x.categorie === def.cle) ?? null
            return (
              <LigneCategorie
                key={`${def.cle}-${c?.majLe ?? ''}`}
                categorie={def.cle}
                libelle={def.libelle}
                avecSurface={def.unite === 'm2'}
                comptage={c ?? null}
                repartition={r}
                occupe={enregistrer.isPending}
                onNombre={(n, surface) => poser(def.cle, n, surface)}
                onConfirmer={() => c && poser(def.cle, c.nombre, c.surface ?? null)}
                onUnites={(releveId, u) => r && poserUnites(r, releveId, u)}
              />
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

function LigneCategorie({ categorie, libelle, avecSurface, comptage, repartition, occupe, onNombre, onConfirmer, onUnites }: {
  categorie: CategorieComptee
  libelle: string
  avecSurface: boolean
  comptage: Comptage | null
  repartition: EtatRepartition | null
  occupe: boolean
  onNombre: (nombre: number | null, surface?: number | null) => void
  onConfirmer: () => void
  onUnites: (releveId: string, unites: number) => void
}) {
  const lire = (brut: string, entier: boolean): number | null | 'faux' => {
    const t = brut.trim().replace(',', '.')
    if (!t) return null
    const v = Number(t)
    if (!Number.isFinite(v) || v < 0 || (entier && (!Number.isInteger(v) || v > NOMBRE_MAX))) return 'faux'
    return v
  }

  return (
    <li className={cn('px-4 py-3.5 md:px-6', comptage && !comptage.valide && 'bg-amber-50/50')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
            {libelle}
            {comptage && !comptage.valide && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">à vérifier</span>
            )}
          </p>
          {comptage ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {comptage.source === 'analyse' && <img src="/diagly-mark.svg" alt="" aria-hidden className="mr-1 inline h-3 w-3 align-[-2px]" />}
              {[
                SOURCES[comptage.source],
                comptage.pages.length ? comptage.pages.join(', ') : null,
                comptage.confiance && `confiance ${comptage.confiance}`,
              ].filter(Boolean).join(' · ')}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">Non compté : la quantité suit la règle de la base.</p>
          )}
          {comptage?.detail && <p className="mt-0.5 text-xs">{comptage.detail}</p>}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Input
            type="number" inputMode="numeric" min={0} max={NOMBRE_MAX} step={1}
            defaultValue={comptage?.nombre ?? ''}
            placeholder="nombre"
            aria-label={`Nombre de ${libelle.toLowerCase()}`}
            disabled={occupe}
            className="h-11 w-28 text-right text-base tabular-nums"
            onBlur={(e) => {
              const v = lire(e.target.value, true)
              if (v === 'faux') { e.target.value = String(comptage?.nombre ?? ''); return }
              if (v === (comptage?.nombre ?? null)) return
              onNombre(v)
            }}
          />
          {avecSurface && comptage && (
            <span className="flex items-center gap-1.5">
              <Input
                type="number" inputMode="decimal" min={0} step="any"
                defaultValue={comptage.surface ?? ''}
                placeholder="surface"
                aria-label="Surface totale des fenêtres"
                disabled={occupe}
                className="h-11 w-28 text-right text-base tabular-nums"
                onBlur={(e) => {
                  const v = lire(e.target.value, false)
                  if (v === 'faux') { e.target.value = String(comptage.surface ?? ''); return }
                  const surface = v === null || v === 0 ? null : v
                  if (surface === (comptage.surface ?? null)) return
                  onNombre(comptage.nombre, surface)
                }}
              />
              <span className="text-xs text-muted-foreground">m²</span>
            </span>
          )}
          {comptage && !comptage.valide && (
            <button
              type="button"
              onClick={onConfirmer}
              disabled={occupe}
              className="flex h-11 items-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
            >
              <Check className="h-4 w-4" />Confirmer
            </button>
          )}
          {comptage && (
            <button
              type="button"
              onClick={() => onNombre(null)}
              disabled={occupe}
              title="Retirer ce comptage : la quantité revient à la règle de la base"
              aria-label={`Retirer le comptage des ${libelle.toLowerCase()}`}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {comptage && repartition && (
        <div className="mt-3 space-y-2">
          {repartition.types.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucun type relevé : à préciser pendant la visite.</p>
          ) : (
            <>
              <div className="space-y-2 rounded-xl border bg-muted/30 p-2.5">
                {repartition.types.map((t) => (
                  <CompteurUnites
                    key={t.id}
                    libelle={t.nom}
                    valeur={t.effectives}
                    total={comptage.nombre}
                    onChange={(u) => onUnites(t.id, u)}
                  />
                ))}
              </div>
              <p className={cn('text-xs', repartition.complet ? 'text-muted-foreground' : 'font-medium text-amber-800')}>
                {[
                  ...repartition.types.map((t) => `${t.effectives == null ? '?' : t.effectives}/${comptage.nombre} ${t.nom}`),
                  repartition.reste >= 0
                    ? `${repartition.reste} à préciser`
                    : `${-repartition.reste} ${reparties(-repartition.reste, categorie)} en trop`,
                ].join(' · ')}
              </p>
            </>
          )}
          {avecSurface && comptage.surface == null && repartition.types.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Sans surface mesurée, la surface de fenêtres du dossier se partage au prorata du nombre ({nombreFr(comptage.nombre)}).
            </p>
          )}
        </div>
      )}
    </li>
  )
}
