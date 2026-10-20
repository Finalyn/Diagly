/**
 * Le dossier chiffré : le projet, ses relevés recalés, et le devis.
 *
 * Toutes les pages qui montrent un montant (Coûts, Rapports, Variantes)
 * passent par ce hook, qui passe par chiffrerLeDossier : un seul calcul.
 * Les relevés dont la quantité ne suit plus la fiche sont réécrits par la file
 * d'envoi, une fois par changement, comme une saisie.
 *
 * Dans son propre fichier parce que c'est un hook : un module qui exporte un
 * composant et un hook casse le rafraîchissement à chaud de Vite.
 */
import { useEffect, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useBaseCfc } from '@/lib/base-cfc/requete'
import { cfcLabelIndex } from '@/lib/cfc'
import { chiffrerLeDossier, type DossierChiffre } from '@/lib/devis-du-dossier'
import { saisir } from '@/lib/hors-ligne/file-envoi'
import type { ApiDiagnostic, ApiProject } from '@/lib/api-types'
import type { BaseDuDevis } from '@/lib/devis'

export interface DevisDuDossier extends Partial<DossierChiffre> {
  project: ApiProject | undefined
  diagnostic: ApiDiagnostic | undefined
  base: BaseDuDevis
  labels: Map<string, string>
  chargement: boolean
  erreur: boolean
}

export function useDevisDuDossier(projectId: string | undefined): DevisDuDossier {
  const projectQuery = useQuery({ queryKey: ['project', projectId], queryFn: () => api.projects.get(projectId!), enabled: !!projectId })
  const project = projectQuery.data?.project
  const diagnostic = projectQuery.data?.diagnostics[0]
  const itemsQuery = useQuery({
    queryKey: ['diagnostic-items', diagnostic?.id],
    queryFn: () => api.diagnostics.listItems(diagnostic!.id),
    enabled: !!diagnostic,
  })
  const cfcQuery = useQuery({ queryKey: ['cfc-catalog'], queryFn: () => api.cfc.catalog(), staleTime: 3.6e6 })
  const baseQuery = useBaseCfc()

  const labels = useMemo(() => cfcLabelIndex(cfcQuery.data?.entries ?? []), [cfcQuery.data])
  const base = useMemo<BaseDuDevis>(() => ({
    articles: baseQuery.data?.articles ?? [],
    postes: baseQuery.data?.postes ?? [],
    etapes: baseQuery.data?.etapes ?? [],
  }), [baseQuery.data])

  const chiffre = useMemo(() => {
    if (!project || !itemsQuery.data) return undefined
    return chiffrerLeDossier(project, itemsQuery.data.items, base, labels)
  }, [project, itemsQuery.data, base, labels])

  // Les relevés recalés sont réécrits une fois par changement : la même
  // signature ne repart pas à chaque rendu.
  const ecrits = useRef('')
  useEffect(() => {
    if (!chiffre || !diagnostic || chiffre.recalculs.length === 0) return
    const signature = JSON.stringify(chiffre.recalculs)
    if (signature === ecrits.current) return
    ecrits.current = signature
    void (async () => {
      for (const r of chiffre.recalculs) {
        await saisir({ type: 'modifier', diagnosticId: diagnostic.id, releveId: r.releveId, corps: r.patch })
      }
    })()
  }, [chiffre, diagnostic])

  return {
    project,
    diagnostic,
    base,
    labels,
    ...(chiffre ?? {}),
    chargement: projectQuery.isLoading || (!!diagnostic && itemsQuery.isLoading) || baseQuery.isLoading,
    erreur: projectQuery.isError,
  }
}
