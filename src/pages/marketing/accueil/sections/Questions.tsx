import { useId, useState } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CONTACT, QUESTIONS } from '../contenu'
import { Conteneur, FOCUS } from '../ui'
import { typo } from '../typo'

/**
 * Les questions fréquentes, en accordéon : chaque question est un bouton dans
 * un titre, qui dit s'il est ouvert et quelle réponse il commande. Plusieurs
 * réponses peuvent rester ouvertes à la fois.
 */
export function Questions() {
  const [ouvertes, setOuvertes] = useState<ReadonlySet<number>>(() => new Set([0]))
  const base = useId()
  const basculer = (i: number) => setOuvertes((o) => {
    const n = new Set(o)
    if (n.has(i)) n.delete(i)
    else n.add(i)
    return n
  })
  return (
    <section id="faq" aria-labelledby="titre-faq" className="scroll-mt-16 bg-white py-20 sm:py-28">
      <Conteneur>
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-4">
            <h2 id="titre-faq" className="text-balance text-[clamp(2.1rem,4.2vw,3.1rem)] font-medium leading-[1.06] tracking-[-0.04em] text-[#0b1220]">
              Questions fréquentes
            </h2>
            <p className="mt-4 text-[15.5px] leading-[1.6] text-[#6b7280]">
              Une autre question&nbsp;? <a href={CONTACT} className={cn('font-medium text-[#0167EA] underline-offset-4 hover:underline', FOCUS)}>Écrivez-nous</a>.
            </p>
          </div>
          <div className="lg:col-span-8">
            <div className="border-t border-black/[0.09]">
              {QUESTIONS.map((item, i) => {
                const ouverte = ouvertes.has(i)
                const idQ = `${base}-q${i}`
                const idR = `${base}-r${i}`
                return (
                  <div key={item.q} className="border-b border-black/[0.09]">
                    <h3 className="m-0">
                      <button
                        type="button"
                        id={idQ}
                        aria-expanded={ouverte}
                        aria-controls={idR}
                        onClick={() => basculer(i)}
                        className={cn('flex min-h-14 w-full items-center justify-between gap-6 py-4 text-left text-[17px] font-medium leading-snug text-[#1d1d1f] hover:text-[#0167EA]', FOCUS)}
                      >
                        {typo(item.q)}
                        <Plus className={cn('h-5 w-5 shrink-0 text-[#0167EA] transition-transform duration-200', ouverte && 'rotate-45')} aria-hidden="true" />
                      </button>
                    </h3>
                    <div id={idR} role="region" aria-labelledby={idQ} hidden={!ouverte}>
                      <p className="pb-6 pr-10 text-[16px] leading-relaxed text-[#545458]">{typo(item.r)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Conteneur>
    </section>
  )
}
