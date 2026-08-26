import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/**
 * Coquille d'authentification — style "liquid glass" épuré (blanc / noir / gris) :
 * fond neutre avec halos flous, panneau translucide en verre dépoli.
 */
export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="relative min-h-dvh flex items-center justify-center overflow-hidden bg-gradient-to-b from-white to-[#eef0f3] px-4 py-10">
      <div className="relative w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <img src="/diagly-logo.svg" alt="Diagly" className="h-9 w-auto" />
          <span className="text-[10px] font-semibold uppercase tracking-wider bg-foreground text-white px-1.5 py-0.5 rounded-md">Pro</span>
        </Link>

        {/* Panneau verre dépoli */}
        <div className="rounded-[28px] border border-black/[0.06] bg-white/80 backdrop-blur-2xl shadow-[0_24px_70px_-24px_rgba(0,0,0,0.20)] p-7 sm:p-9">
          <div className="text-center mb-7">
            <h1 className="text-[26px] font-semibold tracking-tight text-neutral-900">{title}</h1>
            {subtitle && <p className="text-sm text-neutral-500 mt-2 leading-relaxed">{subtitle}</p>}
          </div>
          {children}
        </div>

        <p className="text-center text-xs text-neutral-400 mt-6">Diagnostic de bâtiment · Suisse</p>
      </div>
    </div>
  )
}
