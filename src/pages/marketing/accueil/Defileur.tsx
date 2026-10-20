import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Un chiffre qui défile comme un compteur : chaque chiffre fait un tour
 * complet avant de s'arrêter sur sa valeur, de gauche à droite. Les signes
 * (≈, <, la virgule, l'unité) restent fixes. Le texte exact est donné aux
 * lecteurs d'écran ; sans IntersectionObserver ou en mouvement réduit, la
 * valeur s'affiche d'emblée.
 */
export function Defileur({ texte }: { texte: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  // Sans IntersectionObserver, rien n'attend : tout s'affiche d'emblée.
  const [vu, setVu] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') return
    const o = new IntersectionObserver((e) => {
      if (e.some((x) => x.isIntersecting)) { setVu(true); o.disconnect() }
    }, { rootMargin: '0px 0px -10% 0px' })
    o.observe(el)
    return () => o.disconnect()
  }, [])

  let rang = 0
  return (
    <span ref={ref} className="inline-flex items-start align-bottom font-semibold leading-[1.6] text-[#0b1220] tabular-nums">
      <span className="sr-only">{texte}</span>
      {[...texte].map((c, i) => {
        if (!/\d/.test(c)) {
          return <span key={i} aria-hidden="true" className={cn('inline-block h-[1.6em]', c === ' ' && 'w-[0.25em]')}>{c === ' ' ? '' : c}</span>
        }
        const d = Number(c)
        const delai = rang++ * 140
        return (
          <span key={i} aria-hidden="true" className="relative inline-block h-[1.6em] overflow-hidden">
            <span
              className="block transition-transform duration-[1700ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
              style={{ transform: `translateY(-${vu ? (10 + d) * 1.6 : 0}em)`, transitionDelay: `${delai}ms` }}
            >
              {Array.from({ length: 20 }, (_, k) => <span key={k} className="block h-[1.6em]">{k % 10}</span>)}
            </span>
          </span>
        )
      })}
    </span>
  )
}
