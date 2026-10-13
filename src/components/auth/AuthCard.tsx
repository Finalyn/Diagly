import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/**
 * Coquille d'authentification, style « liquid glass » épuré (blanc, noir, gris) :
 * fond neutre avec halos flous, panneau translucide en verre dépoli.
 */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    // Les marges de l'écran sont sur le bloc intérieur : posées ici, à côté de
    // safe-top et safe-sides (des classes hors des utilitaires, qui l'emportent),
    // elles étaient annulées, et sur iPhone le formulaire touchait les bords.
    <div className="safe-sides relative flex min-h-dvh items-center justify-center overflow-x-hidden bg-gradient-to-b from-white to-[#eef0f3]">
      <div className="ecran-auth relative w-full max-w-md px-6 pb-10 pt-[calc(var(--safe-top)+2.5rem)] sm:px-4">
        {/* Le logo de l'app, comme dans le menu de gauche (Sidebar.tsx). Le badge
            « Pro » d'une ancienne offre a disparu : il n'y a qu'un Diagly. */}
        <Link to="/" aria-label="Diagly" className="mb-10 flex items-center justify-center gap-2.5 sm:mb-8">
          <img src="/diagly-mark.svg" alt="" className="h-10 w-auto" />
          <span className="text-[27px] font-semibold leading-none tracking-tight text-neutral-900">Diagly</span>
        </Link>

        {/* Panneau verre dépoli. Sur téléphone, pas de cadre : le formulaire
            occupe l'écran comme dans une app, sans carte coincée entre deux bords. */}
        <div className="sm:rounded-[28px] sm:border sm:border-black/[0.06] sm:bg-white/80 sm:p-9 sm:shadow-[0_24px_70px_-24px_rgba(0,0,0,0.20)] sm:backdrop-blur-2xl">
          <div className="mb-8 text-center sm:mb-7">
            <h1 className="text-[28px] font-semibold tracking-tight text-neutral-900 sm:text-[26px]">{title}</h1>
            {subtitle && <p className="text-sm text-neutral-500 mt-2 leading-relaxed">{subtitle}</p>}
          </div>
          {children}
        </div>

        <p className="mt-8 text-center text-xs text-neutral-400 sm:mt-6">Diagnostic de bâtiment · Suisse</p>
      </div>
    </div>
  )
}
