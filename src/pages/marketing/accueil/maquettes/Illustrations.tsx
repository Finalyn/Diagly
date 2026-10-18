import { cn } from '@/lib/utils'

/**
 * Les « photos » des maquettes, dessinées en vecteurs.
 *
 * Une vraie photo de relevé montre un immeuble et ses occupants : on n'en
 * publie pas. Ces dessins tiennent la place d'une photo de chantier, une porte
 * palière et une façade, sans rien montrer de réel.
 */

/** Une porte palière en bois, vue du palier. */
export function PhotoPorte({ className, id = 'porte' }: { className?: string; id?: string }) {
  return (
    <svg viewBox="0 0 120 160" preserveAspectRatio="xMidYMid slice" className={cn('block h-full w-full', className)}>
      <defs>
        <linearGradient id={`${id}-mur`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e9e4dc" />
          <stop offset="1" stopColor="#cfc7bb" />
        </linearGradient>
        <linearGradient id={`${id}-bois`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8a5a34" />
          <stop offset="0.55" stopColor="#a8723f" />
          <stop offset="1" stopColor="#7b4f2d" />
        </linearGradient>
        <linearGradient id={`${id}-sol`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b9b2a6" />
          <stop offset="1" stopColor="#8f887c" />
        </linearGradient>
      </defs>
      <rect width="120" height="160" fill={`url(#${id}-mur)`} />
      <rect y="136" width="120" height="24" fill={`url(#${id}-sol)`} />
      <rect x="30" y="22" width="60" height="116" fill="#f3efe8" />
      <rect x="34" y="26" width="52" height="110" fill={`url(#${id}-bois)`} />
      <rect x="40" y="34" width="40" height="40" rx="1.5" fill="none" stroke="#5f3b20" strokeOpacity="0.55" strokeWidth="1.4" />
      <rect x="40" y="82" width="40" height="46" rx="1.5" fill="none" stroke="#5f3b20" strokeOpacity="0.55" strokeWidth="1.4" />
      {/* Le vernis usé en partie basse : ce que le relevé doit voir. */}
      <path d="M36 118c8-3 14 2 22-1s14 1 26-2v19H36z" fill="#d9b48a" fillOpacity="0.45" />
      <rect x="77" y="78" width="4" height="12" rx="1.5" fill="#d6d3cd" />
      <circle cx="79" cy="94" r="1.6" fill="#57534e" />
      <rect x="54" y="52" width="12" height="3" rx="1" fill="#d6d3cd" fillOpacity="0.8" />
      <rect x="10" y="60" width="10" height="16" rx="1" fill="#f8f6f2" stroke="#bdb5a8" strokeWidth="0.8" />
    </svg>
  )
}

/** Un immeuble d'habitation de cinq niveaux, sous un ciel clair. */
export function PhotoImmeuble({ className, id = 'immeuble' }: { className?: string; id?: string }) {
  return (
    <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" className={cn('block h-full w-full', className)}>
      <defs>
        <linearGradient id={`${id}-ciel`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b9d7f5" />
          <stop offset="1" stopColor="#e8f1fb" />
        </linearGradient>
        <linearGradient id={`${id}-facade`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#efe9df" />
          <stop offset="1" stopColor="#ddd5c8" />
        </linearGradient>
        <linearGradient id={`${id}-vitre`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7d9ab6" />
          <stop offset="1" stopColor="#4d6782" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill={`url(#${id}-ciel)`} />
      <rect y="176" width="320" height="24" fill="#a3a99a" />
      <path d="M0 176c40-12 60-6 90-14v14z" fill="#7f9a6b" />
      <path d="M250 176c20-16 50-14 70-10v10z" fill="#7f9a6b" />
      <rect x="62" y="40" width="196" height="138" fill={`url(#${id}-facade)`} />
      <rect x="56" y="32" width="208" height="10" fill="#9a8f80" />
      <rect x="84" y="20" width="152" height="14" fill="#cfc6b8" />
      {[0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3, 4, 5].filter((c) => r < 3 || c < 2 || c > 3).map((c) => (
        <g key={`${r}${c}`}>
          <rect x={74 + c * 31} y={50 + r * 30} width="20" height="20" fill={`url(#${id}-vitre)`} />
          <rect x={72 + c * 31} y={70 + r * 30} width="24" height="2.5" fill="#b8ad9d" />
        </g>
      )))}
      <rect x="150" y="148" width="20" height="30" fill="#6b4a2f" />
      <rect x="146" y="144" width="28" height="4" fill="#9a8f80" />
    </svg>
  )
}
