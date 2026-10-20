import { useId, useMemo, useState, type FormEvent } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CONTACT } from '../contenu'
import { Apparition, Conteneur, FOCUS } from '../ui'
import { typo } from '../typo'

/**
 * Réserver une démo : la proposition du site, à la place d'un diagnostic
 * offert.
 *
 * Une grande carte bleue, comme l'offre d'essai d'avant : à gauche, « Votre
 * démo est offerte » et ce qu'elle apporte ; à droite, posée sur le bleu, la
 * carte blanche de réservation : les dix prochains jours ouvrables, six
 * créneaux, puis le nom et l'adresse e-mail. Le bouton prépare la demande dans la messagerie du
 * visiteur, adressée à Diagly (CONTACT) : rien n'est envoyé à un service
 * tiers, et le créneau est confirmé par retour d'e-mail. Quand un outil de
 * réservation sera choisi, c'est ce bouton qui changera.
 */

const CRENEAUX = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00']

const ATOUTS = [
  'Diagly en direct, du plan au rapport',
  'Vos questions, sur vos propres bâtiments',
  'Le tarif adapté à votre volume',
]

/** Les dix prochains jours ouvrables, à partir de demain. */
function prochainsJours(): Date[] {
  const jours: Date[] = []
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  while (jours.length < 10) {
    d.setDate(d.getDate() + 1)
    const j = d.getDay()
    if (j !== 0 && j !== 6) jours.push(new Date(d))
  }
  return jours
}

const JOUR_COURT = new Intl.DateTimeFormat('fr-CH', { weekday: 'short' })
const MOIS_COURT = new Intl.DateTimeFormat('fr-CH', { month: 'short' })
const DATE_LONGUE = new Intl.DateTimeFormat('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' })

export function Demo() {
  const jours = useMemo(() => prochainsJours(), [])
  const [jour, setJour] = useState<number | null>(null)
  const [creneau, setCreneau] = useState<string | null>(null)
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [bureau, setBureau] = useState('')
  const id = useId()
  const pret = jour !== null && creneau !== null && nom.trim() !== '' && /\S+@\S+\.\S+/.test(email)

  const envoyer = (e: FormEvent) => {
    e.preventDefault()
    if (!pret || jour === null) return
    const quand = `${DATE_LONGUE.format(jours[jour])} à ${creneau.replace(':', ' h ')}`
    const corps = [
      'Bonjour,',
      '',
      `Je souhaite une démo de Diagly le ${quand}.`,
      '',
      `Nom : ${nom.trim()}`,
      `E-mail : ${email.trim()}`,
      bureau.trim() ? `Bureau : ${bureau.trim()}` : null,
    ].filter((l) => l !== null).join('\n')
    window.location.href = `${CONTACT}?subject=${encodeURIComponent('Démo Diagly')}&body=${encodeURIComponent(corps)}`
  }

  const champ = cn('min-h-11 w-full rounded-xl border border-black/[0.1] bg-white px-3.5 text-[15px] text-[#0b1220] placeholder:text-[#9aa1ab] focus:border-[#0167EA] focus:outline-none focus:ring-2 focus:ring-[#0167EA]/20')

  return (
    <section id="demo" aria-labelledby="titre-demo" className="scroll-mt-24 bg-white py-16 sm:py-24">
      <Conteneur>
        <Apparition className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#0167EA] via-[#0b5bd3] to-[#0b3d8f] p-6 text-white sm:p-10 lg:p-14">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_80%_80%_at_15%_0%,#000_20%,transparent_75%)]" />
          <div className="relative grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center lg:gap-14">
            <div>
              <h2 id="titre-demo" className="max-w-[12ch] text-balance text-[clamp(2.2rem,4.8vw,3.6rem)] font-medium leading-[1.02] tracking-[-0.045em]">
                {typo('Votre démo est offerte.')}
              </h2>
              <p className="mt-5 max-w-[28rem] text-pretty text-[16.5px] leading-[1.65] text-white/75">
                {typo('Choisissez un créneau : nous vous montrons Diagly, du plan au rapport, et répondons à vos questions.')}
              </p>
              <ul className="mt-7 space-y-3">
                {ATOUTS.map((a) => (
                  <li key={a} className="flex items-center gap-3 text-[15.5px] font-medium text-white">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[#0167EA]">
                      <Check className="h-3.5 w-3.5" strokeWidth={2.8} aria-hidden="true" />
                    </span>
                    {typo(a)}
                  </li>
                ))}
              </ul>
            </div>

            <form onSubmit={envoyer} className="text-[#0b1220]">
              <div className="rounded-[24px] bg-white p-5 shadow-[0_30px_60px_-24px_rgba(4,20,60,0.55)] sm:p-7">
                <fieldset>
                  <legend className="text-[15px] font-semibold text-[#0b1220]">Quel jour&nbsp;?</legend>
                  <div className="mt-3 grid grid-cols-5 gap-2">
                    {jours.map((d, i) => (
                      <label key={d.toISOString()} className="relative">
                        <input type="radio" name={`${id}-jour`} className="peer sr-only" checked={jour === i} onChange={() => setJour(i)} />
                        <span className={cn(
                          'flex min-h-[68px] cursor-pointer flex-col items-center justify-center rounded-xl border px-1 text-center leading-tight transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#0167EA]',
                          jour === i ? 'border-[#0167EA] bg-[#0167EA] text-white' : 'border-black/[0.08] text-[#0b1220] hover:border-[#0167EA]/40',
                        )}>
                          <span className={cn('text-[10.5px] font-medium uppercase', jour === i ? 'text-white/80' : 'text-[#6b7280]')}>{JOUR_COURT.format(d).replace('.', '')}</span>
                          <span className="text-[18px] font-semibold tabular-nums">{d.getDate()}</span>
                          <span className={cn('text-[11px]', jour === i ? 'text-white/80' : 'text-[#6b7280]')}>{MOIS_COURT.format(d)}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="mt-6">
                  <legend className="text-[15px] font-semibold text-[#0b1220]">À quelle heure&nbsp;?</legend>
                  <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {CRENEAUX.map((c) => (
                      <label key={c} className="relative">
                        <input type="radio" name={`${id}-heure`} className="peer sr-only" checked={creneau === c} onChange={() => setCreneau(c)} />
                        <span className={cn(
                          'flex min-h-11 cursor-pointer items-center justify-center rounded-xl border text-[14px] font-semibold tabular-nums transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#0167EA]',
                          creneau === c ? 'border-[#0167EA] bg-[#0167EA] text-white' : 'border-black/[0.08] text-[#0b1220] hover:border-[#0167EA]/40',
                        )}>
                          {c.replace(':', ' h ')}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-[13px] font-medium text-[#4b5563]">Nom</span>
                    <input value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="name" required className={cn(champ, 'mt-1.5')} />
                  </label>
                  <label className="block">
                    <span className="text-[13px] font-medium text-[#4b5563]">E-mail</span>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required className={cn(champ, 'mt-1.5')} />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="text-[13px] font-medium text-[#4b5563]">Bureau <span className="font-normal text-[#9aa1ab]">(facultatif)</span></span>
                    <input value={bureau} onChange={(e) => setBureau(e.target.value)} autoComplete="organization" className={cn(champ, 'mt-1.5')} />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={!pret}
                  className={cn('mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0167EA] px-6 text-[15.5px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(1,103,234,0.6)] transition-colors hover:bg-[#0154c4] disabled:cursor-not-allowed disabled:bg-[#b9cdea] disabled:shadow-none', FOCUS)}
                >
                  Demander ce créneau<ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <p className="mt-3 text-center text-[12.5px] text-[#8a8f98]">
                  {jour !== null && creneau
                    ? `${DATE_LONGUE.format(jours[jour]).replace(/^./, (x) => x.toUpperCase())} à ${creneau.replace(':', ' h ')}. Votre messagerie s’ouvre avec la demande, nous vous confirmons par e-mail.`
                    : 'Votre messagerie s’ouvre avec la demande, nous vous confirmons le créneau par e-mail.'}
                </p>
              </div>
            </form>
          </div>
        </Apparition>
      </Conteneur>
    </section>
  )
}
