/**
 * La marque employée par les documents, pendant qu'on les affiche.
 *
 * Les en-têtes de rapport se trouvent à plusieurs endroits, dont certains très
 * loin du dossier : une page imprimée porte son en-tête, et ce composant-là ne
 * sait rien du projet. Plutôt que de faire descendre la marque de main en main
 * à travers dix composants, elle est posée une fois autour du document.
 */
import { useMemo, type ReactNode } from 'react'
import { useAuth } from '@/stores/auth'
import { marqueDuRapport, type MarqueDuDossier } from '@/lib/marque'
import { ContexteMarque } from './use-marque'

export function MarqueDuRapport({ dossier, auteur, children }: {
  dossier?: MarqueDuDossier | null
  auteur?: string
  children: ReactNode
}) {
  const bureau = useAuth((s) => s.user?.preferences?.company)
  const marque = useMemo(
    () => marqueDuRapport(bureau, dossier, auteur),
    [bureau, dossier, auteur],
  )
  return <ContexteMarque.Provider value={marque}>{children}</ContexteMarque.Provider>
}
