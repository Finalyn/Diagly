import { useState } from 'react'
import { ArrowUpRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CONTACT, PLANS, type Plan } from '../contenu'
import { Apparition, Bouton, Conteneur, FOCUS } from '../ui'
import { typo } from '../typo'
import { EnTeteSection } from './blocs'

/**
 * Les tarifs. Montants, plans et conditions sont ceux de la version
 * précédente de la page, inchangés (contenu.ts). La bascule mensuel ou annuel
 * est un groupe de deux boutons à état : un lecteur d'écran annonce celui qui
 * est enfoncé, et la note qui suit change avec lui.
 */
export function Tarifs() {
  const [annuel, setAnnuel] = useState(false)
  return (
    <section id="tarifs" aria-labelledby="titre-tarifs" className="scroll-mt-16 bg-[#f5f7fa] py-20 sm:py-28">
      <Conteneur>
        <EnTeteSection
          id="titre-tarifs"
          centre
          surtitre="Tarifs"
          titre="Commencez gratuitement."
          chapo="Le plan Découverte est gratuit, sans carte bancaire : un diagnostic offert pour juger sur votre propre immeuble. Passez à un plan payant quand Diagly devient votre outil de relevé."
        />

        <div className="mt-10 flex flex-col items-center gap-3">
          <div role="group" aria-label="Période de facturation" className="inline-flex rounded-full bg-white p-1 ring-1 ring-black/[0.08]">
            {([false, true] as const).map((v) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => setAnnuel(v)}
                aria-pressed={annuel === v}
                className={cn('min-h-11 rounded-full px-6 text-[15px] font-medium transition-colors', FOCUS,
                  annuel === v ? 'bg-[#1d1d1f] text-white' : 'text-[#48484a] hover:text-[#1d1d1f]')}
              >
                {v ? 'Annuel' : 'Mensuel'}
              </button>
            ))}
          </div>
          <p className="text-[14px] text-[#545458]" aria-live="polite">
            {annuel ? 'Deux mois offerts sur l’année.' : 'Sans engagement, résiliable sans préavis.'}
          </p>
        </div>

        <ul className="mx-auto mt-12 grid max-w-[1120px] gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((p, i) => (
            <Apparition as="li" key={p.nom} delai={i * 60} className="flex">
              <CartePlan plan={p} annuel={annuel} />
            </Apparition>
          ))}
        </ul>

        <p className="mx-auto mt-10 max-w-[680px] text-center text-[15px] leading-relaxed text-[#545458]">
          {typo('Ce qui sépare les plans : le nombre de diagnostics, le nombre d’utilisateurs, et les sorties. Le chiffrage détaillé par poste, l’export Excel et les rapports à votre logo commencent au plan Pro.')}
        </p>
      </Conteneur>
    </section>
  )
}

function CartePlan({ plan, annuel }: { plan: Plan; annuel: boolean }) {
  const montant = annuel ? plan.annuel : plan.mensuel
  return (
    <article className={cn('flex w-full flex-col rounded-[22px] bg-white p-7',
      plan.phare ? 'ring-2 ring-[#0167EA] shadow-[0_24px_60px_-34px_rgba(1,103,234,0.6)]' : 'ring-1 ring-black/[0.08]')}>
      <h3 className="text-[19px] font-semibold tracking-[-0.015em]">{plan.nom}</h3>
      <p className="mt-1.5 text-[14px] leading-snug text-[#545458] sm:min-h-[2.6rem]">{typo(plan.accroche)}</p>

      <p className="mt-6 flex items-baseline gap-1.5">
        {plan.surDevis ? (
          <span className="text-[30px] font-semibold tracking-[-0.03em]">Sur devis</span>
        ) : plan.gratuit ? (
          <span className="text-[30px] font-semibold tracking-[-0.03em]">Gratuit</span>
        ) : (
          <>
            <span className="text-[40px] font-semibold leading-none tracking-[-0.035em] tabular-nums">{montant?.toLocaleString('fr-CH')}</span>
            <span className="text-[15px] text-[#545458]">CHF {annuel ? 'par an' : 'par mois'}</span>
          </>
        )}
      </p>

      <ul className="mt-6 flex-1 space-y-3">
        {plan.points.map((pt) => (
          <li key={pt} className="flex gap-3">
            <Check className="mt-[3px] h-4 w-4 shrink-0 text-[#0167EA]" aria-hidden="true" />
            <span className="text-[15px] leading-snug">{pt}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8">
        {plan.surDevis ? (
          <a href={CONTACT} className={cn('flex min-h-11 w-full items-center justify-center gap-2 rounded-full text-[15px] font-medium text-[#0167EA] ring-1 ring-inset ring-[#0167EA] transition-colors hover:bg-[#0167EA]/[0.06]', FOCUS)}>
            {plan.cta}<ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </a>
        ) : (
          <Bouton to="/register" variante={plan.phare ? 'plein' : 'contour'} className="w-full">{plan.cta}</Bouton>
        )}
      </div>
    </article>
  )
}
