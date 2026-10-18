import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Echelle } from '../ui'

/**
 * Les cadres d'appareils, dessinés en CSS.
 *
 * Un cadre en image se brouille dès qu'on l'agrandit et pèse autant qu'une
 * photo. Ceux-ci sont des boîtes arrondies : nets à toutes les tailles,
 * quelques octets. L'écran de chacun reçoit une maquette dessinée à la taille
 * réelle de l'appareil (1440 × 900, 820 × 1180, 393 × 852) puis réduite.
 */

/** Un ordinateur portable : l'écran 16:10 et son socle. */
export function Ordinateur({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <div className="relative rounded-t-[18px] rounded-b-[4px] bg-[#0e0f12] p-[10px] pb-[12px] shadow-[0_40px_80px_-30px_rgba(16,36,80,0.45),0_0_0_1px_rgba(0,0,0,0.6)]">
        <span className="absolute left-1/2 top-[3.5px] h-[4px] w-[4px] -translate-x-1/2 rounded-full bg-[#2b2d33]" />
        <div className="overflow-hidden rounded-[4px] bg-white">
          <Echelle largeur={1440} hauteur={900}>{children}</Echelle>
        </div>
      </div>
      {/* Le socle déborde de l'écran, comme sur la machine. */}
      <div className="relative -mx-[7%] h-[13px] rounded-b-[16px] rounded-t-[2px] bg-[linear-gradient(180deg,#e7e8ec_0%,#cfd1d7_55%,#a9acb4_100%)] shadow-[0_18px_30px_-16px_rgba(16,36,80,0.5)]">
        <span className="absolute left-1/2 top-0 h-[5px] w-[15%] -translate-x-1/2 rounded-b-[7px] bg-[#b6b8bf]" />
      </div>
    </div>
  )
}

/** Un iPad debout. */
export function Tablette({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-[30px] bg-[#0e0f12] p-[10px] shadow-[0_40px_80px_-30px_rgba(16,36,80,0.5),0_0_0_1px_rgba(0,0,0,0.55),inset_0_0_0_1.5px_#2c2e34]', className)}>
      <div className="overflow-hidden rounded-[21px] bg-white">
        <Echelle largeur={820} hauteur={1180}>{children}</Echelle>
      </div>
    </div>
  )
}

/** Un iPhone : l'île dynamique et la barre d'état font partie du cadre. */
export function Telephone({ children, className, sombre }: { children: ReactNode; className?: string; sombre?: boolean }) {
  return (
    <div className={cn('rounded-[48px] bg-[#0e0f12] p-[9px] shadow-[0_40px_80px_-30px_rgba(16,36,80,0.55),0_0_0_1px_rgba(0,0,0,0.55),inset_0_0_0_1.5px_#2c2e34]', className)}>
      <div className="overflow-hidden rounded-[39px] bg-white">
        <Echelle largeur={393} hauteur={852}>
          <div className="relative h-full w-full">
            {children}
            <BarreEtat sombre={sombre} />
            <span className="absolute left-1/2 top-[11px] h-[35px] w-[124px] -translate-x-1/2 rounded-full bg-black" />
          </div>
        </Echelle>
      </div>
    </div>
  )
}

/** L'heure à gauche, le réseau et la batterie à droite, comme sur l'iPhone. */
function BarreEtat({ sombre }: { sombre?: boolean }) {
  const c = sombre ? '#ffffff' : '#111111'
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-[54px] items-center justify-between px-[34px] pt-[6px]">
      <span className="w-[54px] text-center text-[17px] font-semibold tracking-[-0.02em]" style={{ color: c }}>9:41</span>
      <svg width="78" height="14" viewBox="0 0 78 14" fill={c}>
        <rect x="0" y="9" width="3.4" height="4.6" rx="1" />
        <rect x="5" y="6.5" width="3.4" height="7.1" rx="1" />
        <rect x="10" y="4" width="3.4" height="9.6" rx="1" />
        <rect x="15" y="1.4" width="3.4" height="12.2" rx="1" />
        <path d="M31 4.2a10.6 10.6 0 0 1 14.4 0l1.3-1.4a12.5 12.5 0 0 0-17 0zM33.6 7a6.8 6.8 0 0 1 9.2 0l1.3-1.4a8.7 8.7 0 0 0-11.8 0zM38.2 12.4l2.8-3a4 4 0 0 0-5.6 0z" />
        <rect x="52.5" y="1.2" width="22" height="11.6" rx="3.6" fill="none" stroke={c} strokeOpacity="0.4" />
        <rect x="54.4" y="3.1" width="16.4" height="7.8" rx="2" />
        <path d="M76 5v4a2 2 0 0 0 0-4z" fillOpacity="0.45" />
      </svg>
    </div>
  )
}
