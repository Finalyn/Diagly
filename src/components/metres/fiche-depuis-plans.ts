/**
 * Les métrés des plans, reportés dans la fiche du bâtiment.
 *
 * Quand les plans du dossier sont analysés et toutes leurs formes validées,
 * la surface de plancher, la surface bâtie, la façade, la part vitrée, la
 * toiture et le nombre d'étages qu'ils donnent remplacent les valeurs de la
 * fiche, avec la mention « issu des plans » (lib/sources-dimensions.ts). Les
 * quantités du devis qui en dépendent se recalculent à la lecture suivante
 * (lib/devis-du-dossier.ts).
 *
 * Tant qu'une forme reste à valider, rien n'est reporté : un jeu à moitié
 * relu donnerait une surface de plancher à moitié comptée.
 *
 * Dans son propre fichier parce que c'est un hook et non un composant.
 */
import { useEffect, useMemo, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ApiDiagnostic, ApiProject } from '@/lib/api-types'
import type { PanneauQuantites } from '@/lib/plans/quantites'
import type { Sia416 } from '@/lib/plans/sia416'
import { dimensionsDesPlans, miseAJourDepuisPlans } from '@/lib/sources-dimensions'

type ProjetEnCache = { project: ApiProject; diagnostics: ApiDiagnostic[] }

export function useFicheDepuisPlans(
  projectId: string | undefined,
  project: ApiProject | undefined,
  panneau: PanneauQuantites | null,
  sia: Sia416 | null,
  /** Faux tant que le jeu se charge ou que des formes restent à valider. */
  pret: boolean,
) {
  const qc = useQueryClient()
  const dims = useMemo(() => (panneau && pret ? dimensionsDesPlans(panneau, sia) : {}), [panneau, sia, pret])
  const maj = useMemo(() => (project && pret ? miseAJourDepuisPlans(project, dims) : null), [project, dims, pret])

  // Un report par changement des plans, et après un court délai : valider dix
  // formes à la suite n'écrit qu'une fois.
  const envoye = useRef('')
  useEffect(() => {
    if (!maj || !projectId) return
    const signature = JSON.stringify(maj.patch) + JSON.stringify(Object.fromEntries(Object.entries(maj.sources).map(([k, v]) => [k, v?.valeur])))
    if (signature === envoye.current) return
    const minuteur = window.setTimeout(() => {
      envoye.current = signature
      void api.projects.update(projectId, { ...maj.patch, sources: maj.sources }).then(({ project: p }) => {
        qc.setQueryData<ProjetEnCache>(['project', projectId], (v) => (v ? { ...v, project: p } : v))
        void qc.invalidateQueries({ queryKey: ['projects'] })
      }).catch(() => { envoye.current = '' })
    }, 1500)
    return () => window.clearTimeout(minuteur)
  }, [maj, projectId, qc])

  return dims
}
