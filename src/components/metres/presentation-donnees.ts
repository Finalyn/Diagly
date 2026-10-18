/**
 * Ce que la présentation des métrés lit, pour l'espace Métrés comme pour les
 * rapports du dossier : le jeu de plans et ses quantités, les ouvrages du
 * relevé quand il y en a, la photo de garde.
 *
 * L'espace Métrés passe son propre jeu, celui que l'éditeur ouvert tient à
 * jour ; les rapports relisent celui du serveur. Les deux composent la même
 * présentation, par lib/plans/presentation.ts.
 *
 * Des hooks, dans leur propre fichier : un module qui exporte aussi des
 * composants casse le rafraîchissement à chaud de Vite.
 */
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ApiDiagnosticItem, ApiPlan, ApiProject, FeuillesPlan } from '@/lib/api-types'
import { categorieDuReleve } from '@/lib/base-cfc/comptages'
import { useBaseCfc } from '@/lib/base-cfc/requete'
import { photoDeGarde } from '@/lib/photo-de-garde'
import { feuillesDe, ordonnerPlans } from '@/lib/plans/feuilles'
import {
  composerPresentation, elementsMetres, nomDuPdf, photosDeLElement, type OptionsPresentation, type OuvragePresentation,
} from '@/lib/plans/presentation'
import { entreesSia416, panneauDesQuantites, type PanneauQuantites } from '@/lib/plans/quantites'
import { surfacesSia416, type Sia416 } from '@/lib/plans/sia416'

/** Les plans du jeu, entiers : la présentation en rend les fichiers. */
export type JeuDePlans = { plan: ApiPlan; feuilles: FeuillesPlan }[]

/** Le jeu de plans d'un dossier, tel que le serveur le tient, et ses quantités. Rien n'est lu sans `projectId`. */
export function useJeuDuDossier(projectId: string, hauteurDuDossier: number | null) {
  const q = useQuery({ queryKey: ['plans', projectId], queryFn: () => api.plans.list(projectId), enabled: !!projectId })
  const jeu: JeuDePlans = useMemo(
    () => ordonnerPlans(q.data?.plans ?? []).map((plan) => ({ plan, feuilles: feuillesDe(plan) })),
    [q.data],
  )
  const panneau = useMemo(() => panneauDesQuantites(jeu, { hauteurDuDossier }), [jeu, hauteurDuDossier])
  const sia = useMemo(() => surfacesSia416(entreesSia416(panneau)), [panneau])
  return { jeu, panneau, sia, chargement: q.isLoading, erreur: q.isError }
}

/** L'adresse en une ligne : « Rue des Essais 4, 1000 Lausanne ». */
export function adresseDu(projet: Pick<ApiProject, 'address' | 'postalCode' | 'city'> | null | undefined): string {
  if (!projet) return ''
  return [projet.address, [projet.postalCode, projet.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
}

export function usePresentation({ jeu, panneau, sia, projet, items, options }: {
  jeu: JeuDePlans
  panneau: PanneauQuantites
  sia: Sia416
  projet: ApiProject | null | undefined
  /** Les relevés du diagnostic ; aucun quand le métré vit seul. */
  items: ApiDiagnosticItem[]
  options: OptionsPresentation
}) {
  // La date du jour, une fois : l'aperçu et le PDF portent la même.
  const [date] = useState(() => new Date())
  const base = useBaseCfc()
  const articles = base.data?.articles
  const ouvrages: OuvragePresentation[] = useMemo(() => items.map((it) => ({
    id: it.id,
    cfcCode: it.cfcCode || null,
    libelle: it.cfcLabel,
    etat: it.state,
    photos: it.photos ?? [],
    // Même règle que la répartition des comptages : par l'article, sinon par le libellé.
    categorie: categorieDuReleve(it, articles ?? []),
  })), [items, articles])
  const elements = useMemo(() => elementsMetres(panneau, jeu, ouvrages), [panneau, jeu, ouvrages])
  const batiment = projet?.name ?? 'Bâtiment'
  const adresse = adresseDu(projet)
  const garde = useMemo(() => photoDeGarde(items, projet?.photoDeGarde) ?? null, [items, projet?.photoDeGarde])
  const diapositives = useMemo(
    () => composerPresentation(elements, sia, { batiment, adresse, date, ouvrages, photoDeGarde: garde }, options),
    [elements, sia, batiment, adresse, date, ouvrages, garde, options],
  )
  const plans = useMemo(() => new Map(jeu.map((x) => [x.plan.id, x.plan])), [jeu])
  const photosDisponibles = useMemo(() => elements.some((e) => photosDeLElement(e, ouvrages).length > 0), [elements, ouvrages])
  return {
    elements,
    diapositives,
    plans,
    batiment,
    adresse,
    photosDisponibles,
    siaDisponible: sia.etages.some((e) => e.pieces.length > 0),
    nomDuFichier: nomDuPdf(batiment, date),
  }
}
