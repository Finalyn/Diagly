/**
 * Enregistrer les éléments comptés d'un dossier, et ce qui en découle.
 *
 * Les rapports lisent la quantité et le coût écrits sur chaque relevé, pas un
 * calcul refait à l'affichage. Corriger six portes palières en huit doit donc
 * réécrire les relevés concernés au moment même, sans attendre qu'on rouvre
 * chacun d'eux dans l'éditeur : c'est ce que fait l'enregistrement, après
 * avoir écrit le comptage au dossier. Les relevés partent par la file
 * d'envoi, comme toute saisie : à l'écran tout de suite, au serveur dès que
 * possible.
 *
 * Dans son propre fichier parce que c'est un hook et non un composant : un
 * module qui exporte les deux casse le rafraîchissement à chaud de Vite.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ApiDiagnostic, ApiProject } from '@/lib/api-types'
import { donneesDuBatiment } from '@/lib/base-cfc/batiment'
import { CLES_CATEGORIES, comptagesDuDossier, type CategorieComptee, type Comptages } from '@/lib/base-cfc/comptages'
import { recalculsDesComptages } from '@/lib/base-cfc/quantite-comptee'
import { saisir } from '@/lib/hors-ligne/file-envoi'

type ProjetEnCache = { project: ApiProject; diagnostics: ApiDiagnostic[] }

/** Les catégories dont le comptage diffère entre deux jeux : ajouté, retiré ou changé. */
export function categoriesChangees(avant: Comptages, apres: Comptages): CategorieComptee[] {
  return CLES_CATEGORIES.filter((c) => {
    const a = avant[c]
    const b = apres[c]
    if (!a || !b) return !!a !== !!b
    return a.nombre !== b.nombre || (a.surface ?? null) !== (b.surface ?? null)
  })
}

/**
 * Écrit des comptages au dossier, puis réécrit la quantité et le coût des
 * relevés qu'ils touchent.
 *
 * `modifier` reçoit les comptages actuels du dossier et rend les nouveaux :
 * on part de la dernière version connue, pour qu'une catégorie changée ici
 * n'efface pas celle qu'on vient de changer ailleurs.
 */
export function useEnregistrerComptages(projectId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (modifier: (actuels: Comptages) => Comptages) => {
      const enCache = qc.getQueryData<ProjetEnCache>(['project', projectId])
      const avant = comptagesDuDossier(enCache?.project.comptages)
      const apres = modifier(avant)
      const vide = Object.keys(apres).length === 0
      const { project } = await api.projects.update(projectId!, { comptages: vide ? null : apres })
      return { project, changees: categoriesChangees(avant, apres) }
    },
    onSuccess: async ({ project, changees }) => {
      qc.setQueryData<ProjetEnCache>(['project', projectId], (v) => (v ? { ...v, project } : v))
      void qc.invalidateQueries({ queryKey: ['projects'] })
      if (changees.length === 0) return
      const diagnosticId = qc.getQueryData<ProjetEnCache>(['project', projectId])?.diagnostics[0]?.id
      if (!diagnosticId) return
      const [base, releves] = await Promise.all([
        qc.fetchQuery({ queryKey: ['base-cfc'], queryFn: () => api.cfc.base(), staleTime: 60 * 60 * 1000 }),
        qc.fetchQuery({ queryKey: ['diagnostic-items', diagnosticId], queryFn: () => api.diagnostics.listItems(diagnosticId) }),
      ])
      const recalculs = recalculsDesComptages(releves.items, base.articles, donneesDuBatiment(project), changees)
      for (const r of recalculs) {
        await saisir({ type: 'modifier', diagnosticId, releveId: r.releveId, corps: r.patch })
      }
    },
  })
}
