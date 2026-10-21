import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Loader2, CalendarCheck } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { CONTACT } from '../contenu'
import { Apparition, Conteneur, FOCUS } from '../ui'
import { typo } from '../typo'
import { ChoixDuCreneau } from '../ChoixDuCreneau'
import { creneauLisible, type Creneau, type JourLibre } from '../creneaux'

/**
 * Réserver une démo : la proposition du site, à la place d'un diagnostic
 * offert.
 *
 * Une grande carte bleue : à gauche, « Votre démo est offerte » et ce qu'elle
 * apporte ; à droite, posée sur le bleu, la carte blanche de réservation. Les
 * jours et les heures sont les vrais créneaux libres (du lundi au vendredi,
 * de 8 h à 18 h, hors agenda de l'hôte) : réserver inscrit la démo dans
 * l'agenda de Finalyn et envoie la confirmation par e-mail, avec l'invitation
 * pour l'agenda du visiteur. Rien ne passe par un service tiers.
 */

const ATOUTS = [
  'Diagly en direct, du plan au rapport',
  'Vos questions, sur vos propres bâtiments',
  'Le tarif adapté à votre volume',
]

type Etat =
  | { type: 'chargement' }
  | { type: 'indisponible' }
  | { type: 'pret'; jours: JourLibre[]; duree: number }

export function Demo() {
  const [etat, setEtat] = useState<Etat>({ type: 'chargement' })
  const [creneau, setCreneau] = useState<Creneau | null>(null)
  const [nom, setNom] = useState('')
  const [email, setEmail] = useState('')
  const [bureau, setBureau] = useState('')
  const [telephone, setTelephone] = useState('')
  const [message, setMessage] = useState('')
  // Le piège à robots : invisible, personne ne le remplit.
  const [site, setSite] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [reservee, setReservee] = useState<{ quand: string; jeton?: string; email: string } | null>(null)

  const charger = () => api.demo.creneaux()
    .then((r) => {
      setEtat({ type: 'pret', jours: r.jours, duree: r.duree })
      // Le premier jour libre est déjà choisi : ses heures s'affichent d'emblée.
      setCreneau((c) => c ?? (r.jours[0] ? { date: r.jours[0].date, heure: '' } : null))
    })
    .catch(() => setEtat({ type: 'indisponible' }))
  useEffect(() => { void charger() }, [])

  const pret = creneau?.heure && nom.trim().length >= 2 && /\S+@\S+\.\S+/.test(email)

  const envoyer = async (e: FormEvent) => {
    e.preventDefault()
    if (!pret || !creneau || envoi) return
    setEnvoi(true)
    setErreur(null)
    try {
      const r = await api.demo.reserver({
        date: creneau.date, heure: creneau.heure, nom: nom.trim(), email: email.trim(),
        bureau: bureau.trim() || undefined, telephone: telephone.trim() || undefined, message: message.trim() || undefined, site,
      })
      setReservee({ quand: creneauLisible(creneau), jeton: r.jeton, email: email.trim() })
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setErreur('Ce créneau vient d’être pris. Choisissez-en un autre.')
        setCreneau(null)
        void charger()
      } else {
        setErreur('La réservation n’a pas abouti. Réessayez dans un instant, ou écrivez-nous.')
      }
    } finally {
      setEnvoi(false)
    }
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
                {typo(`Choisissez un créneau : en ${etat.type === 'pret' ? etat.duree : 30} minutes de visioconférence, nous vous montrons Diagly, du plan au rapport, et répondons à vos questions.`)}
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

            <div className="text-[#0b1220]">
              <div className="rounded-[24px] bg-white p-5 shadow-[0_30px_60px_-24px_rgba(4,20,60,0.55)] sm:p-7">
                {reservee ? (
                  <Confirmation {...reservee} />
                ) : etat.type === 'chargement' ? (
                  <div className="flex min-h-[22rem] items-center justify-center gap-2 text-[14px] text-[#6b7280]">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Chargement des disponibilités…
                  </div>
                ) : etat.type === 'indisponible' || etat.jours.length === 0 ? (
                  <div className="flex min-h-[18rem] flex-col items-center justify-center px-4 text-center">
                    <p className="text-[16px] font-semibold">{etat.type === 'indisponible' ? 'Les disponibilités ne se chargent pas' : 'Aucun créneau libre ces prochaines semaines'}</p>
                    <p className="mt-2 max-w-[22rem] text-[14px] leading-relaxed text-[#6b7280]">{typo('Écrivez-nous : nous vous proposons un rendez-vous par retour d’e-mail.')}</p>
                    <a href={`${CONTACT}?subject=${encodeURIComponent('Démo Diagly')}`} className={cn('mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#0167EA] px-6 text-[15px] font-semibold text-white hover:bg-[#0154c4]', FOCUS)}>
                      Écrire pour une démo<ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </a>
                  </div>
                ) : (
                  <form onSubmit={(e) => void envoyer(e)}>
                    <ChoixDuCreneau jours={etat.jours} valeur={creneau} onChange={setCreneau} />

                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-[13px] font-medium text-[#4b5563]">Nom</span>
                        <input value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="name" required className={cn(champ, 'mt-1.5')} />
                      </label>
                      <label className="block">
                        <span className="text-[13px] font-medium text-[#4b5563]">E-mail</span>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required className={cn(champ, 'mt-1.5')} />
                      </label>
                      <label className="block">
                        <span className="text-[13px] font-medium text-[#4b5563]">Bureau <span className="font-normal text-[#9aa1ab]">(facultatif)</span></span>
                        <input value={bureau} onChange={(e) => setBureau(e.target.value)} autoComplete="organization" className={cn(champ, 'mt-1.5')} />
                      </label>
                      <label className="block">
                        <span className="text-[13px] font-medium text-[#4b5563]">Téléphone <span className="font-normal text-[#9aa1ab]">(facultatif)</span></span>
                        <input type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} autoComplete="tel" className={cn(champ, 'mt-1.5')} />
                      </label>
                      <label className="block sm:col-span-2">
                        <span className="text-[13px] font-medium text-[#4b5563]">Ce que vous aimeriez voir <span className="font-normal text-[#9aa1ab]">(facultatif)</span></span>
                        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} className={cn(champ, 'mt-1.5 resize-none py-2.5')} />
                      </label>
                      <label className="sr-only" aria-hidden="true">
                        Site web
                        <input tabIndex={-1} autoComplete="off" value={site} onChange={(e) => setSite(e.target.value)} />
                      </label>
                    </div>

                    {erreur && <p role="alert" className="mt-4 rounded-xl bg-[#fdf2f2] px-3.5 py-2.5 text-[13.5px] text-[#b83232]">{erreur}</p>}

                    <button
                      type="submit"
                      disabled={!pret || envoi}
                      className={cn('mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0167EA] px-6 text-[15.5px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(1,103,234,0.6)] transition-colors hover:bg-[#0154c4] disabled:cursor-not-allowed disabled:bg-[#b9cdea] disabled:shadow-none', FOCUS)}
                    >
                      {envoi ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                      {creneau?.heure ? `Réserver : ${creneauLisible(creneau)}` : 'Réserver ce créneau'}
                      {!envoi && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                    </button>
                    <p className="mt-3 text-center text-[12.5px] text-[#8a8f98]">
                      {typo('La confirmation vous arrive par e-mail, avec l’invitation pour votre agenda.')}
                    </p>
                  </form>
                )}
              </div>
            </div>
          </div>
        </Apparition>
      </Conteneur>
    </section>
  )
}

/** Ce que voit le visiteur une fois la démo réservée. */
function Confirmation({ quand, jeton, email }: { quand: string; jeton?: string; email: string }) {
  return (
    <div role="status" className="flex min-h-[22rem] flex-col items-center justify-center px-2 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e7f0ff] text-[#0167EA]">
        <CalendarCheck className="h-7 w-7" aria-hidden="true" />
      </span>
      <p className="mt-5 text-[22px] font-semibold tracking-[-0.02em]">C’est réservé</p>
      <p className="mt-2 text-[16px] font-medium text-[#0b1220]">{quand}</p>
      <p className="mt-3 max-w-[24rem] text-pretty text-[14px] leading-relaxed text-[#6b7280]">
        {typo(`La confirmation vient de partir à ${email}, avec l’invitation pour votre agenda. À très bientôt.`)}
      </p>
      {jeton && (
        <Link to={`/demo/${jeton}`} className={cn('mt-5 text-[14px] font-medium text-[#0167EA] hover:underline', FOCUS)}>
          Déplacer ou annuler
        </Link>
      )}
    </div>
  )
}
