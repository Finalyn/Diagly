/**
 * L'état d'une visite guidée.
 *
 * Il vit hors des écrans parce que la visite les traverse : elle commence dans
 * le centre d'aide, désigne un bouton de la barre latérale, puis emmène sur la
 * liste des diagnostics. Un état local à une page ne survivrait pas au premier
 * changement de route.
 *
 * Ce qui est retenu d'une session à l'autre tient en deux choses : les visites
 * déjà faites, et le fait qu'on veuille ou non entendre les étapes.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface VisiteState {
  /** Identifiant de la visite en cours, ou null. */
  visite: string | null
  etape: number
  /** L'étape est lue à voix haute. Éteint par défaut : on ne surprend personne. */
  parole: boolean
  /** Visites menées jusqu'au bout. */
  terminees: string[]
  /** Visites déjà proposées d'elles-mêmes : on ne les repropose pas. */
  proposees: string[]
  demarrer: (id: string) => void
  proposer: (id: string) => void
  aller: (n: number) => void
  quitter: () => void
  terminer: () => void
  basculerParole: () => void
}

export const useVisite = create<VisiteState>()(
  persist(
    (set) => ({
      visite: null,
      etape: 0,
      parole: false,
      terminees: [],
      proposees: [],
      demarrer: (id) => set({ visite: id, etape: 0 }),
      /**
       * Démarre une visite d'elle-même, une fois et une seule.
       *
       * Une visite qu'on a déjà vue, terminée ou abandonnée, ne doit pas
       * reparaître à chaque passage : on retient qu'elle a été proposée, et
       * c'est tout. Elle reste lançable à la main depuis le centre d'aide.
       */
      proposer: (id) => set((s) => (s.visite || s.terminees.includes(id) || s.proposees.includes(id)
        ? s
        : { visite: id, etape: 0, proposees: [...s.proposees, id] })),
      aller: (n) => set({ etape: Math.max(0, n) }),
      quitter: () => set({ visite: null, etape: 0 }),
      terminer: () => set((s) => ({
        visite: null,
        etape: 0,
        terminees: s.visite && !s.terminees.includes(s.visite) ? [...s.terminees, s.visite] : s.terminees,
      })),
      basculerParole: () => set((s) => ({ parole: !s.parole })),
    }),
    {
      name: 'diagly.visites',
      // La visite en cours ne se garde pas : revenir le lendemain au milieu
      // d'une étape, sans savoir pourquoi, n'aiderait personne.
      partialize: (s) => ({ parole: s.parole, terminees: s.terminees, proposees: s.proposees }) as VisiteState,
    },
  ),
)
