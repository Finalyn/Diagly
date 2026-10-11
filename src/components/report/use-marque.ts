/**
 * La marque du document en cours.
 *
 * Posée une fois autour du document par `MarqueDuRapport`, elle est lue ici
 * par les en-têtes de page, qui sont trop loin du dossier pour qu'on la leur
 * passe de main en main. Sans fournisseur, on retombe sur les réglages du
 * bureau : c'est le cas des écrans qui n'ont pas de dossier sous la main.
 */
import { createContext, useContext, useMemo } from 'react'
import { useAuth } from '@/stores/auth'
import { marqueDuRapport, type Marque } from '@/lib/marque'

export const ContexteMarque = createContext<Marque | null>(null)

export function useMarque(): Marque {
  const fournie = useContext(ContexteMarque)
  const bureau = useAuth((s) => s.user?.preferences?.company)
  const defaut = useMemo(() => marqueDuRapport(bureau, null), [bureau])
  return fournie ?? defaut
}
