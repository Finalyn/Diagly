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
import { marqueDuRapport, type MarqueDuBureau, type MarqueDuDossier } from '@/lib/marque'
import { ContexteMarque } from './use-marque'

export function MarqueDuRapport({ dossier, auteur, bureau: bureauFourni, children }: {
  dossier?: MarqueDuDossier | null
  auteur?: string
  /** L'identité du bureau quand il n'y a pas de session : le lien de partage la reçoit du serveur. */
  bureau?: MarqueDuBureau | null
  children: ReactNode
}) {
  const duCompte = useAuth((s) => s.user?.preferences?.company)
  const bureau = bureauFourni ?? duCompte
  const marque = useMemo(
    () => marqueDuRapport(bureau, dossier, auteur),
    [bureau, dossier, auteur],
  )
  return <ContexteMarque.Provider value={marque}>{children}</ContexteMarque.Provider>
}
