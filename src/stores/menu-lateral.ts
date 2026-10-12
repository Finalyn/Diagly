/**
 * Le menu de gauche, replié ou déplié (bouton en haut à gauche de la page).
 *
 * Sur iPad, il prend un quart de l'écran : on doit pouvoir le replier pour
 * travailler, et le rouvrir. Le choix est retenu d'une session à l'autre.
 *
 * L'éditeur du relevé, sur tablette, le replie d'office : on y travaille un
 * panneau à la fois, comme sur téléphone. Le rouvrir là ne vaut que pour la
 * page en cours, et ne change pas le choix fait pour le reste de l'app.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useLocation } from 'react-router-dom'
import { useEstTablette } from '@/lib/use-mobile'

interface MenuLateralState {
  /** Replié par choix, sur toutes les pages. */
  replie: boolean
  /** Page où le menu, replié d'office, a été rouvert. */
  rouvertSur: string | null
  basculer: (page: string, replieDOffice: boolean) => void
}

export const useMenuLateral = create<MenuLateralState>()(
  persist(
    (set, get) => ({
      replie: false,
      rouvertSur: null,
      basculer: (page, replieDOffice) => {
        if (replieDOffice) set({ rouvertSur: get().rouvertSur === page ? null : page })
        else set({ replie: !get().replie })
      },
    }),
    { name: 'diagly.menu-lateral', partialize: (s) => ({ replie: s.replie }) },
  ),
)

/** L'éditeur du relevé, dans un dossier ou ouvert seul. */
const EDITEUR_RELEVE = /^\/app\/(projects\/[^/]+\/diagnostic|diagnostic\/[^/]+)$/

/** Le menu de la page en cours : affiché ou non, et de quoi le basculer. */
export function useMenuDeLaPage(): { visible: boolean; basculer: () => void } {
  const { pathname } = useLocation()
  const replieDOffice = useEstTablette() && EDITEUR_RELEVE.test(pathname)
  const visible = useMenuLateral((s) => (replieDOffice ? s.rouvertSur === pathname : !s.replie))
  const basculer = useMenuLateral((s) => s.basculer)
  return { visible, basculer: () => basculer(pathname, replieDOffice) }
}
