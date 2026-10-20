/**
 * Le classeur Excel du métré (récapitulatif, détail, SIA 416), téléchargé
 * depuis la page Rapports avec les autres documents du dossier.
 */
import { api, saveBlob } from '../api'
import type { ApiPlan, ApiProject, FeuillesPlan } from '../api-types'
import { exportDuMetre, nomDuClasseur } from './export-metres'
import { feuilleDe, libelleFeuille } from './feuilles'
import type { PanneauQuantites } from './quantites'
import type { Sia416 } from './sia416'

export async function telechargerLeClasseur(
  projectId: string,
  projet: Pick<ApiProject, 'name' | 'address' | 'postalCode' | 'city'> | undefined,
  jeu: { plan: ApiPlan; feuilles: FeuillesPlan }[],
  panneau: PanneauQuantites,
  sia: Sia416,
): Promise<void> {
  const parId = new Map(jeu.map((x) => [x.plan.id, x]))
  const m = exportDuMetre(panneau, sia, {
    batiment: projet?.name ?? 'Bâtiment',
    adresse: [projet?.address, [projet?.postalCode, projet?.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    feuille: (planId, page) => {
      const x = parId.get(planId)
      return x ? libelleFeuille(feuilleDe(x.feuilles, page), page, x.plan.name) : `Page ${page}`
    },
    annotation: (planId, id) => parId.get(planId)?.plan.annotations.find((a) => a.id === id) ?? null,
  })
  const { blob } = await api.export.metres(projectId, m)
  saveBlob(blob, nomDuClasseur(projet?.name ?? 'batiment'))
}
