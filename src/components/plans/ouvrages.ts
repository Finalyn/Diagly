/**
 * Les ouvrages du relevé, vus depuis les plans.
 *
 * Dans son propre fichier parce que c'est un hook et non un composant : un
 * module qui exporte les deux casse le rafraîchissement à chaud de Vite.
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

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
