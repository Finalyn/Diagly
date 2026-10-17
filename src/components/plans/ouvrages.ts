/**
 * Les ouvrages du relevé, vus depuis les plans.
 *
 * Dans son propre fichier parce que c'est un hook et non un composant : un
 * module qui exporte les deux casse le rafraîchissement à chaud de Vite.
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ApiDiagnosticItem } from '@/lib/api-types'
import { computeCost, getMarketCoeff } from '@/lib/diagnostic-auto'

/**
 * Reporte une quantité relevée sur les plans sur son ouvrage. Même règle qu'à
 * la saisie : la quantité passe en « relevée », et le coût suit, sauf s'il a
 * été forcé à la main. L'onglet Plans du dossier et l'outil Métrés s'en
 * servent tous deux.
 */
export async function reporterSurLOuvrage(it: ApiDiagnosticItem, quantite: number) {
  const patch: Partial<ApiDiagnosticItem> = { area: quantite, quantityManual: true }
  if (!it.costManual && it.state) {
    const catalogue = it.catalogItemId != null ? (await api.cfc.item(it.catalogItemId)).item : null
    const cout = computeCost(catalogue, it.state, quantite)
    patch.estimatedCost = (cout ?? null) as unknown as string | null
    patch.costIndex = getMarketCoeff()
  }
  return api.diagnostics.updateItem(it.id, patch)
}

/** Les ouvrages du diagnostic en cours du projet. */
export function useOuvragesDuProjet(projectId: string) {
  const projet = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.projects.get(projectId),
    enabled: !!projectId,
  })
  const diagnosticId = projet.data?.diagnostics[0]?.id
  const ouvrages = useQuery({
    queryKey: ['diagnostic-items', diagnosticId],
    queryFn: () => api.diagnostics.listItems(diagnosticId!),
    enabled: !!diagnosticId,
  })
  return {
    items: useMemo(() => ouvrages.data?.items ?? [], [ouvrages.data]),
    // Le bâtiment sert à déduire la quantité d'un article ajouté depuis le plan,
    // comme le fait l'éditeur de diagnostic.
    project: projet.data?.project,
    diagnosticId,
    chargement: projet.isLoading || ouvrages.isLoading,
    aucunDiagnostic: !projet.isLoading && !diagnosticId,
  }
}
