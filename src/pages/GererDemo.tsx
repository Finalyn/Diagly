import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CalendarCheck, CalendarX, Loader2, Mail, Phone, MessageSquare } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import type { DemoReservee } from '@/lib/api-types'
import { cn } from '@/lib/utils'
import { FOCUS } from '@/pages/marketing/accueil/ui'
import { ChoixDuCreneau } from '@/pages/marketing/accueil/ChoixDuCreneau'
import type { Creneau, JourLibre } from '@/pages/marketing/accueil/creneaux'

/**
 * La page d'une démo réservée, ouverte depuis le lien de l'e-mail : le jeton
 * du lien tient lieu de compte. Le visiteur y déplace ou annule son rendez-vous ;
 * l'hôte (avec son propre lien) y voit en plus qui il reçoit.
 *
 * `?annuler` ouvre directement l'annulation : c'est le lien « Annuler » des
 * e-mails.
 */

type Vue = 'resume' | 'deplacer' | 'annuler'

const capitale = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** « mercredi 28 octobre 2026, de 14 h 30 à 15 h 00 » : le jour, puis les heures. */
function enDeuxLignes(quand: string) {
  const i = quand.lastIndexOf(', de ')
  return i < 0 ? [capitale(quand), ''] : [capitale(quand.slice(0, i)), quand.slice(i + 2)]
}

export function GererDemo() {
  const { jeton = '' } = useParams<{ jeton: string }>()
  const [params] = useSearchParams()
  const [demo, setDemo] = useState<DemoReservee | null>(null)
  const [introuvable, setIntrouvable] = useState(false)
  const [vue, setVue] = useState<Vue>(params.has('annuler') ? 'annuler' : 'resume')
  const [annonce, setAnnonce] = useState<string | null>(null)

  // Une page personnelle : ni titre de vitrine, ni indexation.
  useEffect(() => {
    const titre = document.title
    document.title = 'Votre démo Diagly'
    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex, nofollow'
    document.head.appendChild(robots)
    return () => { document.title = titre; robots.remove() }
  }, [])

  const charger = () => api.demo.get(jeton)
    .then(setDemo)
    .catch(() => setIntrouvable(true))
  useEffect(() => { void charger() }, [jeton]) // eslint-disable-line react-hooks/exhaustive-deps

  const modifiable = demo?.statut === 'CONFIRMEE' && !demo.passee
  const vueReelle: Vue = modifiable ? vue : 'resume'

  return (
    <div className="min-h-screen bg-[#f5f7fb] px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-[560px]">
        <Link to="/" className={cn('inline-block rounded', FOCUS)}>
          <img src="/diagly-logo.svg" alt="Diagly" width={101} height={32} className="h-8 w-auto" />
        </Link>

        <div className="mt-8 rounded-[24px] bg-white p-6 shadow-[0_20px_50px_-30px_rgba(4,20,60,0.35)] ring-1 ring-black/[0.04] sm:p-8">
          {introuvable ? (
            <Message
              icone={<CalendarX className="h-7 w-7" aria-hidden="true" />}
              titre="Réservation introuvable"
              texte="Ce lien ne correspond à aucune démo. Vérifiez qu’il est complet, ou réservez un nouveau créneau."
              action={<LienRetour>Réserver une démo</LienRetour>}
            />
          ) : !demo ? (
            <div className="flex min-h-[14rem] items-center justify-center gap-2 text-[14px] text-[#6b7280]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Chargement…
            </div>
          ) : vueReelle === 'deplacer' ? (
            <Deplacer
              jeton={jeton}
              demo={demo}
              onRetour={() => setVue('resume')}
              onFait={(quand) => { setAnnonce(`Démo déplacée au ${quand}. La nouvelle invitation part par e-mail.`); setVue('resume'); void charger() }}
            />
          ) : vueReelle === 'annuler' ? (
            <Annuler
              jeton={jeton}
              demo={demo}
              onRetour={() => setVue('resume')}
              onFait={() => { setAnnonce(null); setVue('resume'); void charger() }}
            />
          ) : (
            <Resume demo={demo} annonce={annonce} modifiable={modifiable} onDeplacer={() => { setAnnonce(null); setVue('deplacer') }} onAnnuler={() => { setAnnonce(null); setVue('annuler') }} />
          )}
        </div>

        <p className="mt-6 text-center text-[12.5px] text-[#8a8f98]">
          Une question ? <a href="mailto:contact@diagly.ch" className="font-medium text-[#0167EA] hover:underline">contact@diagly.ch</a>
        </p>
      </div>
    </div>
  )
}

function Resume({ demo, annonce, modifiable, onDeplacer, onAnnuler }: {
  demo: DemoReservee
  annonce: string | null
  modifiable: boolean
  onDeplacer: () => void
  onAnnuler: () => void
}) {
  const annulee = demo.statut === 'ANNULEE'
  const hote = demo.role === 'hote'
  const [jour, heures] = enDeuxLignes(demo.quand)
  const surtitre = annulee ? 'Démo annulée' : demo.passee ? 'Démo passée' : hote ? 'Démo réservée' : 'Votre démo est confirmée'

  return (
    <div>
      <span className={cn('flex h-12 w-12 items-center justify-center rounded-full', annulee ? 'bg-[#fdecec] text-[#c43d3d]' : 'bg-[#e7f0ff] text-[#0167EA]')}>
        {annulee ? <CalendarX className="h-6 w-6" aria-hidden="true" /> : <CalendarCheck className="h-6 w-6" aria-hidden="true" />}
      </span>
      <p className={cn('mt-5 text-[12.5px] font-semibold uppercase tracking-[0.08em]', annulee ? 'text-[#c43d3d]' : 'text-[#0167EA]')}>{surtitre}</p>
      <h1 className={cn('mt-1.5 text-[24px] font-semibold leading-tight tracking-[-0.02em] text-[#0b1220]', annulee && 'text-[#6b7280] line-through decoration-1')}>
        {jour}
        {heures && <span className="block text-[17px] font-medium tracking-normal text-[#4b5563]">{heures}</span>}
      </h1>
      {!(annulee && !hote) && (
        <p className="mt-3 text-[14.5px] text-[#4b5563]">
          {hote ? <>Avec {demo.nom}{demo.bureau ? `, ${demo.bureau}` : ''}.</> : <>Démo de Diagly en visioconférence, {demo.duree} minutes.</>}
        </p>
      )}

      {annonce && <p role="status" className="mt-5 rounded-xl bg-[#ecf7ef] px-3.5 py-2.5 text-[13.5px] text-[#1f7a3d]">{annonce}</p>}
      {annulee && !hote && (
        <p className="mt-5 text-[14px] leading-relaxed text-[#4b5563]">
          Un autre moment vous conviendrait&nbsp;? Choisissez un nouveau créneau, il ne prend qu’une minute.
        </p>
      )}

      {hote && (
        <dl className="mt-6 space-y-2.5 rounded-2xl bg-[#f5f7fb] p-4 text-[14px]">
          {demo.email && <Ligne icone={<Mail className="h-4 w-4" />}><a href={`mailto:${demo.email}`} className="text-[#0167EA] hover:underline">{demo.email}</a></Ligne>}
          {demo.telephone && <Ligne icone={<Phone className="h-4 w-4" />}><a href={`tel:${demo.telephone.replace(/\s/g, '')}`} className="text-[#0167EA] hover:underline">{demo.telephone}</a></Ligne>}
          {demo.message && <Ligne icone={<MessageSquare className="h-4 w-4" />}><span className="whitespace-pre-line">{demo.message}</span></Ligne>}
        </dl>
      )}

      {modifiable ? (
        <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
          <button type="button" onClick={onDeplacer} className={cn('inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-[#0167EA] px-5 text-[15px] font-semibold text-white hover:bg-[#0154c4]', FOCUS)}>
            Déplacer
          </button>
          <button type="button" onClick={onAnnuler} className={cn('inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-black/[0.1] px-5 text-[15px] font-semibold text-[#0b1220] hover:border-[#c43d3d]/50 hover:text-[#c43d3d]', FOCUS)}>
            Annuler la démo
          </button>
        </div>
      ) : annulee && !hote ? (
        <div className="mt-6"><LienRetour>Choisir un nouveau créneau</LienRetour></div>
      ) : null}
    </div>
  )
}

function Deplacer({ jeton, demo, onRetour, onFait }: {
  jeton: string
  demo: DemoReservee
  onRetour: () => void
  onFait: (quand: string) => void
}) {
  const [jours, setJours] = useState<JourLibre[] | null>(null)
  const [indisponible, setIndisponible] = useState(false)
  const [creneau, setCreneau] = useState<Creneau | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const charger = () => api.demo.creneauxPourDeplacer(jeton)
    .then((r) => {
      setJours(r.jours)
      setCreneau((c) => c ?? (r.jours[0] ? { date: r.jours[0].date, heure: '' } : null))
    })
    .catch(() => setIndisponible(true))
  useEffect(() => { void charger() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const valider = async () => {
    if (!creneau?.heure || envoi) return
    setEnvoi(true)
    setErreur(null)
    try {
      const r = await api.demo.deplacer(jeton, creneau)
      onFait(r.quand)
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'Le déplacement n’a pas abouti. Réessayez dans un instant.')
      if (err instanceof ApiError && err.status === 409) { setCreneau(null); void charger() }
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <div>
      <Retour onClick={onRetour} />
      <h1 className="mt-4 text-[22px] font-semibold tracking-[-0.02em] text-[#0b1220]">Déplacer la démo</h1>
      <p className="mt-1.5 text-[14px] text-[#6b7280]">Actuellement : {demo.quand}.</p>

      <div className="mt-6">
        {indisponible ? (
          <p className="rounded-xl bg-[#fdf2f2] px-3.5 py-2.5 text-[13.5px] text-[#b83232]">Les disponibilités ne se chargent pas. Réessayez dans un instant, ou écrivez-nous.</p>
        ) : !jours ? (
          <div className="flex min-h-[10rem] items-center justify-center gap-2 text-[14px] text-[#6b7280]"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Chargement des disponibilités…</div>
        ) : jours.length === 0 ? (
          <p className="text-[14px] text-[#6b7280]">Aucun autre créneau libre ces prochaines semaines. Écrivez-nous, nous trouverons un moment.</p>
        ) : (
          <ChoixDuCreneau jours={jours} valeur={creneau} onChange={setCreneau} />
        )}
      </div>

      {erreur && <p role="alert" className="mt-4 rounded-xl bg-[#fdf2f2] px-3.5 py-2.5 text-[13.5px] text-[#b83232]">{erreur}</p>}

      <button
        type="button"
        onClick={() => void valider()}
        disabled={!creneau?.heure || envoi}
        className={cn('mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0167EA] px-6 text-[15.5px] font-semibold text-white hover:bg-[#0154c4] disabled:cursor-not-allowed disabled:bg-[#b9cdea]', FOCUS)}
      >
        {envoi && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Confirmer ce créneau
      </button>
    </div>
  )
}

function Annuler({ jeton, demo, onRetour, onFait }: {
  jeton: string
  demo: DemoReservee
  onRetour: () => void
  onFait: () => void
}) {
  const [motif, setMotif] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const hote = demo.role === 'hote'

  const valider = async () => {
    if (envoi) return
    setEnvoi(true)
    setErreur(null)
    try {
      await api.demo.annuler(jeton, motif.trim() || undefined)
      onFait()
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : 'L’annulation n’a pas abouti. Réessayez dans un instant.')
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <div>
      <Retour onClick={onRetour} />
      <h1 className="mt-4 text-[22px] font-semibold tracking-[-0.02em] text-[#0b1220]">Annuler la démo</h1>
      <p className="mt-1.5 text-[14px] text-[#6b7280]">{capitale(demo.quand)}.</p>

      <label className="mt-6 block">
        <span className="text-[13px] font-medium text-[#4b5563]">
          {hote ? `Un mot pour ${demo.nom}` : 'Un mot pour nous'} <span className="font-normal text-[#9aa1ab]">(facultatif)</span>
        </span>
        <textarea
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          rows={3}
          maxLength={500}
          className="mt-1.5 w-full resize-none rounded-xl border border-black/[0.1] px-3.5 py-2.5 text-[15px] text-[#0b1220] focus:border-[#0167EA] focus:outline-none focus:ring-2 focus:ring-[#0167EA]/20"
        />
      </label>
      <p className="mt-2 text-[12.5px] text-[#8a8f98]">
        {hote ? `${demo.nom} reçoit l’annulation par e-mail, avec votre mot.` : 'Vous recevez la confirmation par e-mail, et le rendez-vous quitte votre agenda.'}
      </p>

      {erreur && <p role="alert" className="mt-4 rounded-xl bg-[#fdf2f2] px-3.5 py-2.5 text-[13.5px] text-[#b83232]">{erreur}</p>}

      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row-reverse">
        <button
          type="button"
          onClick={() => void valider()}
          disabled={envoi}
          className={cn('inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#c43d3d] px-5 text-[15px] font-semibold text-white hover:bg-[#a93232] disabled:opacity-60', FOCUS)}
        >
          {envoi && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Annuler la démo
        </button>
        <button type="button" onClick={onRetour} className={cn('inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-black/[0.1] px-5 text-[15px] font-semibold text-[#0b1220] hover:border-[#0167EA]/40', FOCUS)}>
          Garder le rendez-vous
        </button>
      </div>
    </div>
  )
}

function Ligne({ icone, children }: { icone: ReactNode; children: ReactNode }) {
  return (
    <div className="flex gap-2.5">
      <dt className="mt-0.5 shrink-0 text-[#8a8f98]" aria-hidden="true">{icone}</dt>
      <dd className="min-w-0 break-words text-[#0b1220]">{children}</dd>
    </div>
  )
}

function Retour({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn('inline-flex items-center gap-1.5 rounded text-[13.5px] font-medium text-[#6b7280] hover:text-[#0b1220]', FOCUS)}>
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />Retour
    </button>
  )
}

function LienRetour({ children }: { children: ReactNode }) {
  return (
    <Link to={{ pathname: '/', hash: '#demo' }} className={cn('inline-flex min-h-11 items-center justify-center rounded-full bg-[#0167EA] px-6 text-[15px] font-semibold text-white hover:bg-[#0154c4]', FOCUS)}>
      {children}
    </Link>
  )
}

function Message({ icone, titre, texte, action }: { icone: ReactNode; titre: string; texte: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center py-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f1f3f6] text-[#6b7280]">{icone}</span>
      <h1 className="mt-5 text-[20px] font-semibold text-[#0b1220]">{titre}</h1>
      <p className="mt-2 max-w-[22rem] text-[14px] leading-relaxed text-[#6b7280]">{texte}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
