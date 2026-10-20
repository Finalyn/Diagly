import { cn } from '@/lib/utils'
import { LIEN_APP_STORE } from './contenu'
import { FOCUS } from './ui'

/**
 * Le badge « Télécharger dans l'App Store », redessiné en SVG pour rester net
 * à toutes les tailles. Il mène à l'App Store dès que LIEN_APP_STORE est
 * renseigné (contenu.ts) ; sans adresse, ce n'est qu'une image.
 */
export function BadgeAppStore({ className }: { className?: string }) {
  const contenu = (
    <>
      <svg viewBox="0 0 384 512" className="h-[26px] w-[26px] shrink-0 fill-current" aria-hidden="true">
        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
      </svg>
      <span className="text-left leading-none" aria-hidden="true">
        <span className="block text-[10px] text-white/85">Télécharger dans</span>
        <span className="mt-[3px] block text-[18px] font-semibold tracking-[-0.02em]">l’App Store</span>
      </span>
    </>
  )
  const styles = cn('inline-flex min-h-11 items-center gap-2.5 rounded-[12px] bg-black px-4 py-2 text-white ring-1 ring-white/20', className)
  if (!LIEN_APP_STORE) return <span role="img" aria-label="Télécharger dans l’App Store" className={styles}>{contenu}</span>
  return (
    <a href={LIEN_APP_STORE} aria-label="Télécharger Diagly dans l’App Store" className={cn(styles, 'transition-opacity hover:opacity-90', FOCUS)}>
      {contenu}
    </a>
  )
}
