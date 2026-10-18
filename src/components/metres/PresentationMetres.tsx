/**
 * La présentation des métrés, à l'écran et à l'impression.
 *
 * Les diapositives viennent de lib/plans/presentation.ts, déjà composées :
 * ce module les dessine. Chacune mesure 1280 × 720, le 16:9 des
 * présentations ; à l'écran, la page qui l'accueille la réduit à sa colonne
 * (zoom, voir index.css), à l'impression elle remplit exactement sa page.
 *
 * Le plan d'un repérage est l'image de la feuille cadrée (rendu-feuilles.ts),
 * en retrait ou non, et par-dessus, en vecteurs, les seules formes de
 * l'élément dans sa couleur, numérotées comme au tableau, avec l'échelle
 * graphique. Les vecteurs restent nets à l'impression comme au projecteur.
 *
 * Imprimer une présentation, c'est imprimer autre chose que la page : une
 * copie des diapositives est posée à la racine du document, et tant que la
 * présentation est affichée, <html> porte la classe qui ne garde qu'elle à
 * l'impression, avec une taille de page 16:9 sans marges. Les rapports A4
 * gardent leur format : cette taille n'existe que pendant ce temps-là.
 */
import { useEffect, useMemo, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { stateColors, stateLabels } from '@/data/mock'
import type { ApiPlan, ElementState } from '@/lib/api-types'
import { cn } from '@/lib/utils'
import { useMarque } from '@/components/report/use-marque'
import {
  CLE_SIA416, DIAPO, PLACE_DU_PLAN, echelleGraphique, feuillesARendre,
  type DiapoExistant, type DiapoRecapitulatif, type DiapoReperage, type DiapoSiaPlan, type DiapoSiaTableau, type DiapoTableau,
  type DiapoTitre, type Diapositive, type ElementMetre, type FeuilleMetre, type FormeReperee, type OptionsPresentation, type SyntheseTableau,
} from '@/lib/plans/presentation'
import { quantiteLisible } from '@/lib/plans/quantites'
import { cleDuRendu, useRendusFeuilles } from './rendu-feuilles'

interface Rendus { urls: Record<string, string>; erreurs: Record<string, true> }

interface Commun {
  numero: number
  total: number
  batiment: string
  adresse: string
  rendus: Rendus
  attenue: boolean
}

/**
 * Les diapositives empilées, et leur copie pour l'impression. `onPret` dit
 * quand tous les plans sont rendus : l'export attend ce moment.
 */
export function PresentationMetres({ diapositives, plans, attenue, batiment, adresse, onPret }: {
  diapositives: Diapositive[]
  plans: ReadonlyMap<string, ApiPlan>
  attenue: boolean
  batiment: string
  adresse: string
  onPret?: (pret: boolean) => void
}) {
  const demandes = useMemo(() => feuillesARendre(diapositives, attenue).flatMap(({ feuille, attenue: enRetrait }) => {
    const plan = plans.get(feuille.planId)
    return plan ? [{ cle: cleDuRendu(feuille.planId, feuille.page, feuille.cadre, enRetrait), plan, page: feuille.page, cadre: feuille.cadre, attenue: enRetrait }] : []
  }), [diapositives, plans, attenue])
  const { urls, erreurs, pret } = useRendusFeuilles(demandes)
  useEffect(() => { onPret?.(pret) }, [pret, onPret])
  useImpressionDiapositives()

  const rendus = useMemo(() => ({ urls, erreurs }), [urls, erreurs])
  const diapo = (d: Diapositive, i: number) => (
    <Diapo key={d.cle} d={d} numero={i + 1} total={diapositives.length} batiment={batiment} adresse={adresse} rendus={rendus} attenue={attenue} />
  )
  return (
    <>
      <div className="diapos-ecran">
        {diapositives.map((d, i) => <div key={d.cle} className="diapo-ecran">{diapo(d, i)}</div>)}
      </div>
      {createPortal(<div className="diapos-impression" aria-hidden>{diapositives.map(diapo)}</div>, document.body)}
    </>
  )
}

/** Tant que la présentation est affichée, l'impression ne garde qu'elle, en pages 16:9 sans marges. */
function useImpressionDiapositives() {
  useEffect(() => {
    const racine = document.documentElement
    racine.classList.add('impression-diapositives')
    // Posée après les feuilles de style de l'app, elle l'emporte sur le A4 des rapports.
    const style = document.createElement('style')
    style.setAttribute('data-diapositives', '')
    style.textContent = `@page { size: ${DIAPO.largeur}px ${DIAPO.hauteur}px; margin: 0; }`
    document.head.appendChild(style)
    return () => {
      racine.classList.remove('impression-diapositives')
      style.remove()
    }
  }, [])
}

function Diapo({ d, ...c }: Commun & { d: Diapositive }) {
  switch (d.type) {
    case 'titre': return <DiapoDeTitre d={d} {...c} />
    case 'reperage': return <DiapoDeReperage d={d} {...c} />
    case 'tableau': return <DiapoDeTableau d={d} {...c} />
    case 'sia-plan': return <DiapoSiaDePlan d={d} {...c} />
    case 'sia-tableau': return <DiapoSiaDeTableau d={d} {...c} />
    case 'existant': return <DiapoDeLExistant d={d} {...c} />
    case 'recapitulatif': return <DiapoDeRecapitulatif d={d} {...c} />
  }
}

// ---------------------------------------------------------------- le cadre commun

function Logo({ className }: { className?: string }) {
  const marque = useMarque()
  // « Aucun logo » est un choix du dossier : la raison sociale tient sa place.
  if (marque.sansLogo) return marque.name ? <span className="text-[15px] font-semibold text-neutral-700">{marque.name}</span> : null
  return <img src={marque.logo || '/diagly-logo.svg'} alt={marque.name || 'Diagly'} className={cn('w-auto object-contain', className)} />
}

/** La diapositive : en-tête discret (le bâtiment, le logo), le contenu, et le pied (le document, le numéro). */
function Cadre({ numero, total, batiment, adresse, children }: Pick<Commun, 'numero' | 'total' | 'batiment' | 'adresse'> & { children: ReactNode }) {
  const marque = useMarque()
  return (
    <section className="diapo" aria-label={`Diapositive ${numero} sur ${total}`}>
      <header className="absolute inset-x-12 top-6 flex h-8 items-center justify-between gap-8">
        <p className="min-w-0 truncate text-[14px] text-neutral-500">
          <span className="font-semibold text-neutral-700">{batiment}</span>{adresse && <> · {adresse}</>}
        </p>
        <Logo className="h-7 max-w-[220px]" />
      </header>
      <div className="absolute inset-x-12 top-[76px] bottom-[52px] flex flex-col">{children}</div>
      <footer className="absolute inset-x-12 bottom-4 flex items-center justify-between gap-8 border-t border-neutral-200 pt-2 text-[12px] text-neutral-500">
        <span className="truncate">Plans de repérage et métrés{marque.name ? ` · ${marque.name}` : ''}</span>
        <span className="shrink-0 tabular-nums">{numero} / {total}</span>
      </footer>
    </section>
  )
}

function Pastille({ couleur, className }: { couleur: string; className?: string }) {
  return <span className={cn('inline-block shrink-0 rounded-full', className ?? 'h-4 w-4')} style={{ background: couleur }} aria-hidden />
}

function TitreDiapo({ couleur, titre, sousTitre }: { couleur?: string | null; titre: string; sousTitre?: string | null }) {
  return (
    <div className="flex h-[64px] shrink-0 items-start gap-3">
      {couleur && <Pastille couleur={couleur} className="mt-[10px] h-4 w-4" />}
      <div className="min-w-0">
        <h2 className="truncate text-[28px] font-semibold leading-[36px] tracking-[-0.01em] text-neutral-900">{titre}</h2>
        {sousTitre && <p className="truncate text-[15px] leading-5 text-neutral-500">{sousTitre}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- le plan

const metres = (m: number) => `${String(m).replace('.', ',')} m`

/**
 * Le plan cadré, ses formes en vecteurs et leurs numéros. `largeur` et
 * `hauteur` sont la place du plan sur la diapositive, au format du cadre.
 */
function PlanCadre({ feuille, formes, rendus, attenue, largeur, hauteur, numeros = true, echelle = true, discret = false }: {
  feuille: FeuilleMetre
  formes: FormeReperee[]
  rendus: Rendus
  attenue: boolean
  largeur: number
  hauteur: number
  numeros?: boolean
  echelle?: boolean
  /** Une teinte légère, pour la page de titre : le dessin d'abord. */
  discret?: boolean
}) {
  const c = feuille.cadre
  const cle = cleDuRendu(feuille.planId, feuille.page, c, attenue)
  const url = rendus.urls[cle]
  // Unités du repère des annotations par pixel de la diapositive : les traits
  // et les numéros gardent la même taille, quel que soit le cadrage.
  const k = c.largeur / largeur
  const barre = echelle && feuille.echelle ? echelleGraphique(feuille.echelle, k) : null
  return (
    <div className="relative shrink-0 overflow-hidden rounded-xl border border-neutral-200 bg-white" style={{ width: largeur, height: hauteur }}>
      {url
        ? <img src={url} alt="" className="absolute inset-0 h-full w-full" />
        : (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-[14px] text-neutral-400">
            {rendus.erreurs[cle] ? 'Plan indisponible' : <><Loader2 className="h-4 w-4 animate-spin" />Préparation du plan…</>}
          </div>
        )}
      <svg viewBox={`${c.x} ${c.y} ${c.largeur} ${c.hauteur}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        {formes.map((f) => <Forme key={f.id} f={f} k={k} discret={discret} />)}
        {numeros && formes.map((f) => <Numero key={`n-${f.id}`} f={f} k={k} />)}
        {barre && (
          <g>
            <rect x={c.x + 12 * k} y={c.y + c.hauteur - 46 * k} width={barre.longueur * k + 32 * k} height={34 * k} rx={6 * k} fill="#ffffff" fillOpacity={0.92} />
            <rect x={c.x + 28 * k} y={c.y + c.hauteur - 24 * k} width={(barre.longueur * k) / 2} height={6 * k} fill="#111827" />
            <rect x={c.x + 28 * k + (barre.longueur * k) / 2} y={c.y + c.hauteur - 24 * k} width={(barre.longueur * k) / 2} height={6 * k} fill="#ffffff" stroke="#111827" strokeWidth={1.2 * k} />
            <text x={c.x + 28 * k} y={c.y + c.hauteur - 30 * k} fontSize={11 * k} fill="#374151">0</text>
            <text x={c.x + 28 * k + barre.longueur * k} y={c.y + c.hauteur - 30 * k} fontSize={11 * k} fill="#374151" textAnchor="end">{metres(barre.metres)}</text>
          </g>
        )}
      </svg>
    </div>
  )
}

function Forme({ f, k, discret }: { f: FormeReperee; k: number; discret?: boolean }) {
  if (f.nature === 'comptage') {
    const p = f.points[0]
    return <circle cx={p.x} cy={p.y} r={11 * k} fill={f.couleur} stroke="#ffffff" strokeWidth={2 * k} />
  }
  if (f.nature === 'longueur') {
    const pts = f.points.map((p) => `${p.x},${p.y}`).join(' ')
    return (
      <g>
        <polyline points={pts} fill="none" stroke="#ffffff" strokeWidth={8 * k} strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={pts} fill="none" stroke={f.couleur} strokeWidth={4 * k} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    )
  }
  // Les découpes restent vides : un seul chemin, rempli pair-impair.
  const d = [f.points, ...f.trous].map((c) => `M${c.map((p) => `${p.x},${p.y}`).join('L')}Z`).join('')
  return <path d={d} fillRule="evenodd" fill={f.couleur} fillOpacity={discret ? 0.1 : 0.3} stroke={f.couleur} strokeWidth={(discret ? 1.6 : 2.2) * k} strokeLinejoin="round" />
}

function Numero({ f, k }: { f: FormeReperee; k: number }) {
  const texte = String(f.numero)
  const p = f.ancre
  // Un repère porte son numéro dans sa pastille ; une zone ou une longueur, dans un rond posé sur elle.
  const r = (f.nature === 'comptage' ? 11 : 10 + Math.max(0, texte.length - 1) * 3) * k
  return (
    <g>
      {f.nature !== 'comptage' && <circle cx={p.x} cy={p.y} r={r} fill={f.couleur} stroke="#ffffff" strokeWidth={2 * k} />}
      <text x={p.x} y={p.y + 4.4 * k} fontSize={(texte.length > 2 ? 10.5 : 12.5) * k} fontWeight={700} textAnchor="middle" fill="#ffffff">{texte}</text>
    </g>
  )
}

/** La place d'un cadre dans une boîte, à son format. */
function ajuster(feuille: FeuilleMetre, largeurMax: number, hauteurMax: number) {
  const ratio = feuille.cadre.largeur / feuille.cadre.hauteur
  return largeurMax / hauteurMax > ratio
    ? { largeur: Math.round(hauteurMax * ratio), hauteur: hauteurMax }
    : { largeur: largeurMax, hauteur: Math.round(largeurMax / ratio) }
}

// ---------------------------------------------------------------- les diapositives

function DiapoDeTitre({ d, rendus, numero, total }: Commun & { d: DiapoTitre }) {
  const marque = useMarque()
  const ligne2 = [marque.postalCode, marque.city].filter(Boolean).join(' ')
  const place = d.image?.genre === 'plan' ? ajuster(d.image.feuille, 552, 520) : null
  return (
    <section className="diapo" aria-label={`Diapositive ${numero} sur ${total}`}>
      <div className="absolute bottom-14 left-16 top-14 flex w-[540px] flex-col">
        <Logo className="h-11 max-w-[260px] self-start" />
        <div className="mt-auto">
          <p className="text-[14px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Métrés</p>
          <h1 className="mt-2 text-[46px] font-bold leading-[52px] tracking-[-0.02em] text-neutral-900">{d.titre}</h1>
          <div className="mt-5 h-1 w-24 rounded-full" style={{ background: marque.accentColor ?? '#111827' }} />
          <p className="mt-6 text-[28px] font-semibold leading-tight text-neutral-900">{d.batiment}</p>
          {d.adresse && <p className="mt-1 text-[18px] text-neutral-500">{d.adresse}</p>}
          <p className="mt-4 text-[16px] text-neutral-600">{d.date}{marque.auteur ? ` · établi par ${marque.auteur}` : ''}</p>
        </div>
        <div className="mt-auto pt-8">
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {d.sommaire.map((s) => (
              <li key={s.cle} className="flex items-center gap-1.5 text-[13px] text-neutral-600"><Pastille couleur={s.couleur} className="h-2.5 w-2.5" />{s.titre}</li>
            ))}
          </ul>
          {(marque.name || marque.address) && (
            <p className="mt-5 border-t border-neutral-200 pt-3 text-[13px] text-neutral-500">
              {[marque.name, marque.address, ligne2].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>
      <div className="absolute bottom-14 right-16 top-14 flex w-[552px] items-center justify-center">
        {/* La photo garde son format, centrée : rien n'en est coupé. */}
        {d.image?.genre === 'photo' && <img src={d.image.src} alt="" className="max-h-full max-w-full rounded-2xl object-contain shadow-sm ring-1 ring-black/5" />}
        {d.image?.genre === 'plan' && place && (
          <figure className="flex flex-col items-center gap-3">
            <PlanCadre feuille={d.image.feuille} formes={d.image.formes} rendus={rendus} attenue={false} largeur={place.largeur} hauteur={place.hauteur} numeros={false} echelle={false} discret />
            <figcaption className="text-[13px] text-neutral-500">{d.image.feuille.libelle}</figcaption>
          </figure>
        )}
      </div>
    </section>
  )
}

function DiapoDeReperage({ d, rendus, attenue, ...c }: Commun & { d: DiapoReperage }) {
  const premier = d.formes[0]?.numero
  const dernier = d.formes[d.formes.length - 1]?.numero
  return (
    <Cadre {...c}>
      <TitreDiapo couleur={d.element.couleur} titre={d.titre} sousTitre={d.sousTitre} />
      <div className="mt-2 flex min-h-0 flex-1 gap-6">
        <PlanCadre feuille={d.feuille} formes={d.formes} rendus={rendus} attenue={attenue} largeur={PLACE_DU_PLAN.largeur} hauteur={PLACE_DU_PLAN.hauteur} />
        <aside className="flex min-w-0 flex-1 flex-col">
          <div className="rounded-xl bg-neutral-50 px-5 py-4">
            <p className="flex items-center gap-2 text-[15px] font-semibold text-neutral-800"><Pastille couleur={d.element.couleur} className="h-3 w-3" />{d.element.titre}</p>
            <p className="mt-3 text-[34px] font-semibold leading-none tracking-[-0.01em] text-neutral-900 tabular-nums">{d.quantite}</p>
            <p className="mt-1.5 text-[13px] text-neutral-500">{d.etages ? 'par étage, sur cette feuille' : 'sur cette feuille'}</p>
            {d.etages && <p className="mt-2 text-[15px] font-medium text-neutral-800 tabular-nums">{d.etages}</p>}
            {d.detail.length > 0 && <p className="mt-2 text-[13px] text-neutral-600 tabular-nums">{d.detail.join(' · ')}{d.etages ? ', par étage' : ''}</p>}
            {premier != null && (
              <p className="mt-2 text-[13px] text-neutral-500">N° {premier === dernier ? premier : `${premier} à ${dernier}`}, repris au tableau</p>
            )}
          </div>
          {d.liste.length > 0 && (
            <ol className="mt-3 space-y-[3px]">
              {d.liste.map((l) => (
                <li key={l.numero} className="flex items-center gap-2 text-[13px] leading-[20px]">
                  <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1 text-[11px] font-bold text-white" style={{ background: d.element.couleur }}>{l.numero}</span>
                  <span className="min-w-0 flex-1 truncate text-neutral-800">{l.nom}</span>
                  <span className="shrink-0 tabular-nums text-neutral-600">{l.quantite}</span>
                </li>
              ))}
              {d.autres > 0 && <li className="pl-7 text-[12px] text-neutral-500">et {d.autres} autre{d.autres > 1 ? 's' : ''}</li>}
            </ol>
          )}
          <p className="mt-auto text-[12px] leading-4 text-neutral-500">
            {d.feuille.echelleImprimee ? `Feuille au 1:${d.feuille.echelleImprimee}. ` : ''}
            {attenue ? 'Plan en retrait, seul l’élément en couleur.' : 'Seul l’élément est tracé.'}
          </p>
        </aside>
      </div>
    </Cadre>
  )
}

/**
 * Les tailles d'un tableau de diapositive : grandes tant qu'il a peu de
 * lignes, pour qu'il se lise au fond d'une salle ; plus serrées au-delà, pour
 * qu'il tienne.
 */
const TAILLES = {
  // Un ou deux niveaux à côté de la carte du total : de quoi occuper la diapositive.
  tresGrande: {
    entete: 'py-4 text-[17px]', cellule: 'py-5', niveau: 'text-[34px] leading-[42px]', detail: 'text-[17px] leading-6',
    valeur: 'text-[34px] leading-[42px]', numero: 'text-[22px] leading-[42px]', secondaire: 'text-[17px] leading-6', total: 'py-6 text-[38px] leading-[46px]',
  },
  grande: {
    entete: 'py-3 text-[15px]', cellule: 'py-3', niveau: 'text-[25px] leading-8', detail: 'text-[15px] leading-5',
    valeur: 'text-[25px] leading-8', numero: 'text-[20px] leading-8', secondaire: 'text-[15px] leading-5', total: 'py-4 text-[28px] leading-9',
  },
  serree: {
    entete: 'py-2.5 text-[13px]', cellule: 'py-2', niveau: 'text-[20px] leading-7', detail: 'text-[13px] leading-4',
    valeur: 'text-[20px] leading-7', numero: 'text-[16px] leading-7', secondaire: 'text-[13px] leading-4', total: 'py-3 text-[22px] leading-8',
  },
} as const
type Taille = typeof TAILLES[keyof typeof TAILLES]

/** Un tableau de diapositive : en-têtes discrets, lignes fines, total appuyé. */
function Tableau({ entetes, children, total, taille }: { entetes: ReactNode; children: ReactNode; total?: ReactNode; taille: Taille }) {
  return (
    <table className="w-full table-fixed border-collapse text-left tabular-nums">
      <thead>
        <tr className={cn('border-b-2 border-neutral-900 font-semibold uppercase tracking-[0.06em] text-neutral-500', taille.entete)}>{entetes}</tr>
      </thead>
      <tbody>{children}</tbody>
      {total && <tfoot><tr className="border-t-2 border-neutral-900">{total}</tr></tfoot>}
    </table>
  )
}

/** La taille du grand chiffre : il tient dans sa carte, quelle que soit sa longueur. */
const tailleDuTotal = (t: string, grand: boolean) => (t.length <= 7 ? 64 : t.length <= 10 ? 52 : 42) * (grand ? 1.3 : 1)

/**
 * Le total général en grand, dans la couleur de l'élément, et la part de
 * chaque niveau en barres : les mêmes chiffres que le tableau, vus d'un coup
 * d'œil. À côté d'un tableau étroit, en colonne ; sous un tableau large, en
 * bandeau.
 */
function CarteDuTotal({ s, couleur, bandeau, largeur, grand = false }: {
  s: SyntheseTableau
  couleur: string
  bandeau?: boolean
  largeur?: number
  /** Peu de niveaux : la carte prend de la hauteur, le chiffre aussi. */
  grand?: boolean
}) {
  const serrees = s.barres.length > 4
  return (
    <div
      className={cn('overflow-hidden rounded-2xl text-white', bandeau ? 'flex items-center gap-10 p-6' : 'flex shrink-0 flex-col justify-between', !bandeau && (grand ? 'min-h-[400px] p-8' : 'p-6'))}
      style={{ background: couleur, width: bandeau ? undefined : largeur }}
    >
      <div className={cn(bandeau && 'w-[340px] shrink-0')}>
        <p className={cn('font-semibold uppercase tracking-[0.12em] text-white/80', grand ? 'text-[16px]' : 'text-[14px]')}>Total général</p>
        <p className="mt-2 font-bold leading-none tracking-[-0.02em] tabular-nums" style={{ fontSize: tailleDuTotal(s.total, grand) }}>{s.total}</p>
        <p className={cn('mt-3 text-white/85', grand ? 'text-[17px]' : 'text-[15px]')}>{s.libelle}, étages identiques compris</p>
        {s.autres.length > 0 && <p className={cn('mt-1 font-medium tabular-nums text-white/90', grand ? 'text-[17px]' : 'text-[15px]')}>{s.autres.join(' · ')}</p>}
      </div>
      <ul className={cn(bandeau ? 'min-w-0 flex-1' : 'mt-6', serrees ? 'space-y-2' : 'space-y-3.5')}>
        {s.barres.map((b) => (
          <li key={b.cle}>
            <div className={cn('flex items-baseline justify-between gap-3', serrees ? 'text-[13px]' : grand ? 'text-[18px]' : 'text-[16px]')}>
              <span className="min-w-0 truncate font-medium">{b.niveau}{b.multiplicateur > 1 ? ` · × ${b.multiplicateur}` : ''}</span>
              <span className="shrink-0 font-semibold tabular-nums">{b.valeur}</span>
            </div>
            <div className={cn('mt-1.5 overflow-hidden rounded-full bg-white/25', serrees ? 'h-2' : grand ? 'h-3' : 'h-2.5')}>
              <div className="h-full rounded-full bg-white" style={{ width: `${b.part > 0 ? Math.max(b.part * 100, 1.5) : 0}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function DiapoDeTableau({ d, ...c }: Commun & { d: DiapoTableau }) {
  const sousTitre = ['Par niveau, étages identiques compris', d.partie ? `${d.partie.n} sur ${d.partie.sur}` : null].filter(Boolean).join(' · ')
  const n = d.lignes.length
  const colonnes = d.colonnes.length + (d.avecCfc ? 1 : 0)
  const s = d.synthese
  // La carte du total va sous un tableau large quand il a peu de lignes, à côté sinon.
  const bandeau = !!s && colonnes >= 3 && n <= 2
  const aCote = !!s && !bandeau
  const tresGrande = aCote && n <= 2 && colonnes <= 2
  const taille = tresGrande ? TAILLES.tresGrande : n <= 4 && !(aCote && colonnes >= 3) ? TAILLES.grande : TAILLES.serree
  return (
    <Cadre {...c}>
      <TitreDiapo couleur={d.element.couleur} titre={d.titre} sousTitre={sousTitre} />
      {/* Peu de niveaux : le bloc se tient au milieu de la diapositive, pas en haut. */}
      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <div className={cn('flex gap-8', bandeau ? 'flex-col' : 'items-center')}>
          <div className="min-w-0 flex-1">
            <Tableau
              taille={taille}
              entetes={<>
                <th className="w-[34%] pr-4">Niveau</th>
                <th className="w-[13%] pr-4">N°</th>
                <th className="w-[11%] pr-4 text-right">Étages</th>
                {d.colonnes.map((col) => <th key={col.cle} className="pl-4 text-right">{col.libelle}</th>)}
                {d.avecCfc && <th className="w-[14%] pl-8">CFC</th>}
              </>}
              total={d.total && <>
                <td colSpan={3} className={cn('pr-4 font-bold text-neutral-900', taille.total)}>Total général</td>
                {d.total.map((v, i) => <td key={i} className={cn('pl-4 text-right font-bold text-neutral-900', taille.total)}>{v}</td>)}
                {d.avecCfc && <td />}
              </>}
            >
              {d.lignes.map((l) => (
                <tr key={l.cle} className="border-b border-neutral-200 align-top">
                  <td className={cn('pr-4', taille.cellule)}>
                    <p className={cn('truncate font-semibold text-neutral-900', taille.niveau)}>{l.niveau}</p>
                    {l.feuille !== l.niveau && <p className={cn('truncate text-neutral-500', taille.detail)}>{l.feuille}</p>}
                  </td>
                  <td className={cn('whitespace-nowrap pr-4 text-neutral-600', taille.cellule, taille.numero)}>{l.numeros}</td>
                  <td className={cn('whitespace-nowrap pr-4 text-right text-neutral-700', taille.cellule, taille.numero)}>{l.multiplicateur > 1 ? `× ${l.multiplicateur}` : '1'}</td>
                  {l.cellules.map((cel, i) => (
                    <td key={i} className={cn('pl-4 text-right', taille.cellule)}>
                      <p className={cn('font-semibold text-neutral-900', taille.valeur)}>{cel.total}</p>
                      {cel.parEtage && <p className={cn('text-neutral-500', taille.secondaire)}>{cel.parEtage}</p>}
                    </td>
                  ))}
                  {d.avecCfc && <td className={cn('truncate pl-8 text-neutral-500', taille.cellule, taille.secondaire)}>{l.cfc}</td>}
                </tr>
              ))}
            </Tableau>
            {d.notes.length > 0 && (
              <ul className="mt-3 space-y-0.5 text-[14px] text-neutral-500">{d.notes.map((note) => <li key={note}>{note}</li>)}</ul>
            )}
          </div>
          {s && <CarteDuTotal s={s} couleur={d.element.couleur} bandeau={bandeau} largeur={colonnes >= 3 ? 360 : 420} grand={tresGrande} />}
        </div>
      </div>
    </Cadre>
  )
}

function DiapoSiaDePlan({ d, rendus, attenue, ...c }: Commun & { d: DiapoSiaPlan }) {
  return (
    <Cadre {...c}>
      <TitreDiapo titre={d.titre} sousTitre={d.sousTitre} />
      <div className="mt-2 flex min-h-0 flex-1 gap-6">
        <PlanCadre feuille={d.feuille} formes={d.formes} rendus={rendus} attenue={attenue} largeur={PLACE_DU_PLAN.largeur} hauteur={PLACE_DU_PLAN.hauteur} />
        <aside className="flex min-w-0 flex-1 flex-col">
          <p className="text-[15px] font-semibold text-neutral-800">Affectation des pièces</p>
          <p className="text-[13px] text-neutral-500">{d.feuille.multiplicateur > 1 ? 'm² par étage' : 'm²'}</p>
          <ul className="mt-3 space-y-2">
            {d.legende.map((l) => (
              <li key={l.cle} className="flex items-start gap-2.5">
                <span className="mt-[3px] h-3.5 w-3.5 shrink-0 rounded-[3px]" style={{ background: l.couleur }} aria-hidden />
                <span className="min-w-0 flex-1 text-[14px] leading-5 text-neutral-800">
                  {l.cle !== 'non' && <span className="font-semibold">{l.cle} </span>}{l.nom}
                </span>
                <span className="shrink-0 text-[14px] font-semibold tabular-nums text-neutral-900">{l.surface}</span>
              </li>
            ))}
          </ul>
          <p className="mt-auto rounded-lg bg-amber-50 px-3 py-2 text-[12px] leading-4 text-amber-900">
            {d.mention}. Affectation d’après le nom du local, corrigée pièce par pièce dans les Métrés.
          </p>
        </aside>
      </div>
    </Cadre>
  )
}

function DiapoSiaDeTableau({ d, ...c }: Commun & { d: DiapoSiaTableau }) {
  const n = d.lignes.length
  const grande = n <= 2
  // Le tableau a huit colonnes de chiffres : un corps un peu plus petit que celui des éléments.
  const valeur = grande ? 'text-[21px] leading-8' : 'text-[17px] leading-6'
  const cellule = grande ? 'py-3' : 'py-2'
  const syn = d.synthese
  return (
    <Cadre {...c}>
      <TitreDiapo titre={d.titre} sousTitre="Par niveau, en m², étages identiques compris" />
      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <table className="w-full table-fixed border-collapse text-left tabular-nums">
          <thead>
            <tr className={cn('border-b-2 border-neutral-900 font-semibold uppercase tracking-[0.06em] text-neutral-500', grande ? 'py-3 text-[15px]' : 'text-[13px]')}>
              <th className={cn('w-[16%] pr-3', grande ? 'py-3' : 'py-2.5')}>Niveau</th>
              <th className="w-[8%] pr-3 text-right">Étages</th>
              {d.colonnes.map((col) => (
                <th key={col.cle} className="pl-3 text-right">
                  <span className="inline-flex items-center gap-1.5">{col.couleur && <span className="h-3 w-3 rounded-[2px]" style={{ background: col.couleur }} aria-hidden />}{col.libelle}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.lignes.map((l) => (
              <tr key={l.cle} className="border-b border-neutral-200 align-top">
                <td className={cn('truncate pr-3 font-semibold text-neutral-900', cellule, grande ? 'text-[24px] leading-8' : 'text-[19px] leading-6')}>{l.niveau}</td>
                <td className={cn('pr-3 text-right text-neutral-700', cellule, valeur)}>{l.multiplicateur > 1 ? `× ${l.multiplicateur}` : '1'}</td>
                {l.cellules.map((cel, i) => (
                  <td key={i} className={cn('pl-3 text-right', cellule)}>
                    <p className={cn('font-semibold text-neutral-900', valeur)}>{cel.total}</p>
                    {cel.parEtage && <p className="text-[13px] leading-4 text-neutral-500">{cel.parEtage}</p>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-neutral-900">
              <td colSpan={2} className={cn('pr-3 font-bold text-neutral-900', grande ? 'py-4 text-[24px]' : 'py-3 text-[19px]')}>Total</td>
              {d.total.map((v, i) => <td key={i} className={cn('pl-3 text-right font-bold text-neutral-900', grande ? 'py-4 text-[21px]' : 'py-3 text-[17px]')}>{v}</td>)}
            </tr>
          </tfoot>
        </table>
        {/* Peu de niveaux : les totaux en grand, et la SN partagée entre ses catégories. */}
        {n <= 3 && (
          <div className="mt-7 flex items-center gap-10 rounded-2xl bg-neutral-50 px-7 py-6">
            {([['SP', 'Surface de plancher', syn.sp], ['SN', 'Surface nette', syn.sn], ['SC', 'Surface de construction', syn.sc]] as const).map(([cle, nom, v]) => (
              <div key={cle} className="shrink-0">
                <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-neutral-500">{cle} · {nom}</p>
                <p className="mt-1 text-[34px] font-bold leading-none tracking-[-0.01em] tabular-nums text-neutral-900">{v}</p>
              </div>
            ))}
            {syn.parts.length > 0 && (
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-neutral-500">SN par catégorie</p>
                <div className="mt-2 flex h-4 overflow-hidden rounded-full bg-neutral-200">
                  {syn.parts.map((p) => <div key={p.cle} style={{ width: `${p.part * 100}%`, background: p.couleur }} />)}
                </div>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {syn.parts.map((p) => (
                    <li key={p.cle} className="flex items-center gap-1.5 text-[14px] text-neutral-700">
                      <span className="h-3 w-3 rounded-[2px]" style={{ background: p.couleur }} aria-hidden /><span className="font-semibold">{p.libelle}</span><span className="tabular-nums">{p.valeur}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <p className="mt-4 text-[14px] font-medium text-amber-800">
          {d.mention}. SP sur l’emprise au nu extérieur, SN sur les pièces validées, SC par différence ; SU = SUP + SUS.
        </p>
        {d.alertes.length > 0 && <ul className="mt-1 space-y-0.5 text-[13px] text-neutral-500">{d.alertes.map((x) => <li key={x}>{x}</li>)}</ul>}
      </div>
    </Cadre>
  )
}

function Etat({ etat }: { etat: ElementState }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-neutral-700">
      <span className={cn('h-2.5 w-2.5 rounded-full', stateColors[etat])} aria-hidden />{stateLabels[etat]}
    </span>
  )
}

function DiapoDeLExistant({ d, ...c }: Commun & { d: DiapoExistant }) {
  const n = d.photos.length
  const colonnes = n <= 3 ? n : n === 4 ? 2 : 3
  const rangees = Math.ceil(n / colonnes)
  // Une seule rangée garde le format des photos (4:3) plutôt que de les étirer en hauteur ;
  // deux rangées remplissent la place, chaque photo recadrée sur son centre.
  const auFormat = rangees === 1 && n > 1
  const legende = (p: DiapoExistant['photos'][number]) => (
    <figcaption className="flex shrink-0 items-center justify-between gap-3 px-3 py-2">
      <span className="min-w-0 truncate text-[13px] text-neutral-800">{p.legende}</span>
      {p.etat && <Etat etat={p.etat} />}
    </figcaption>
  )
  return (
    <Cadre {...c}>
      <TitreDiapo couleur={d.element.couleur} titre={d.titre} sousTitre="Photos des relevés rattachés aux formes" />
      {n === 1 ? (
        <div className="mt-2 flex min-h-0 flex-1 justify-center">
          <figure className="flex min-h-0 max-w-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white">
            <img src={d.photos[0].src} alt="" className="min-h-0 w-auto max-w-full flex-1 object-contain" />
            {legende(d.photos[0])}
          </figure>
        </div>
      ) : (
        <div
          className={cn('mt-2 grid min-h-0 flex-1 gap-4', auFormat && 'content-center')}
          style={{ gridTemplateColumns: `repeat(${colonnes}, minmax(0, 1fr))`, gridTemplateRows: auFormat ? undefined : `repeat(${rangees}, minmax(0, 1fr))` }}
        >
          {d.photos.map((p, i) => (
            <figure key={i} className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white">
              <img src={p.src} alt="" className={cn('w-full object-cover', auFormat ? 'aspect-[4/3]' : 'min-h-0 flex-1')} />
              {legende(p)}
            </figure>
          ))}
        </div>
      )}
    </Cadre>
  )
}

function DiapoDeRecapitulatif({ d, ...c }: Commun & { d: DiapoRecapitulatif }) {
  const sousTitre = ['Tous les éléments, étages identiques compris', d.partie ? `${d.partie.n} sur ${d.partie.sur}` : null].filter(Boolean).join(' · ')
  const grande = d.lignes.length <= 5
  const cellule = grande ? 'py-4' : 'py-3'
  return (
    <Cadre {...c}>
      <TitreDiapo titre={d.titre} sousTitre={sousTitre} />
      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <Tableau taille={grande ? TAILLES.grande : TAILLES.serree} entetes={<>
          <th className="w-[40%] pr-4">Élément</th>
          <th className="w-[22%] pr-4 text-right">Total</th>
          <th className="pl-10">Détail</th>
        </>}>
          {d.lignes.map((l) => (
            <tr key={l.cle} className="border-b border-neutral-200">
              <td className={cn('pr-4', cellule)}>
                <span className={cn('flex items-center gap-3 font-semibold text-neutral-900', grande ? 'text-[23px]' : 'text-[20px]')}>
                  <Pastille couleur={l.couleur} className="h-4 w-4" /><span className="truncate">{l.titre}</span>
                </span>
              </td>
              <td className={cn('pr-4 text-right font-bold text-neutral-900', cellule, grande ? 'text-[25px]' : 'text-[21px]')}>{l.principal}</td>
              <td className={cn('truncate pl-10 text-neutral-500', cellule, grande ? 'text-[17px]' : 'text-[15px]')}>{l.autres.join(' · ')}</td>
            </tr>
          ))}
        </Tableau>
      </div>
    </Cadre>
  )
}

// ---------------------------------------------------------------- les réglages

/**
 * Ce qu'on règle avant d'exporter : les éléments retenus, la page de titre,
 * le plan en retrait, les photos de l'existant, le récapitulatif. Les photos
 * ne se proposent que si des relevés rattachés en ont.
 */
export function OptionsDeLaPresentation({ elements, siaDisponible, photosDisponibles, options, onOptions }: {
  elements: ElementMetre[]
  siaDisponible: boolean
  photosDisponibles: boolean
  options: OptionsPresentation
  onOptions: (o: OptionsPresentation) => void
}) {
  const exclus = new Set(options.exclus)
  const basculer = (cle: string) => {
    const n = new Set(exclus)
    if (n.has(cle)) n.delete(cle)
    else n.add(cle)
    onOptions({ ...options, exclus: [...n] })
  }
  const cles = [...elements.map((e) => e.cle as string), ...(siaDisponible ? [CLE_SIA416] : [])]
  const tous = cles.every((k) => !exclus.has(k))
  const ligne = 'flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted pointer-coarse:min-h-11'
  const caseACocher = 'h-4 w-4 shrink-0 accent-neutral-900'
  return (
    <div className="space-y-5">
      <section>
        <div className="mb-1.5 flex items-center justify-between px-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Éléments</p>
          <button type="button" onClick={() => onOptions({ ...options, exclus: tous ? cles : [] })} className="text-xs font-medium text-muted-foreground hover:text-foreground pointer-coarse:min-h-11">
            {tous ? 'Tout décocher' : 'Tout cocher'}
          </button>
        </div>
        <div className="space-y-0.5">
          {elements.map((e) => (
            <label key={e.cle} className={ligne}>
              <input type="checkbox" checked={!exclus.has(e.cle)} onChange={() => basculer(e.cle)} className={caseACocher} />
              <Pastille couleur={e.couleur} className="h-2.5 w-2.5" />
              <span className="min-w-0 flex-1 truncate">{e.titre}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{quantiteLisible(e.totaux[0].valeur, e.totaux[0].unite)}</span>
            </label>
          ))}
          {siaDisponible && (
            <label className={ligne}>
              <input type="checkbox" checked={!exclus.has(CLE_SIA416)} onChange={() => basculer(CLE_SIA416)} className={caseACocher} />
              <span className="flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-sm bg-slate-700" aria-hidden />
              <span className="min-w-0 flex-1 truncate">Surfaces SIA 416</span>
            </label>
          )}
        </div>
      </section>
      <section>
        <p className="mb-1.5 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mise en page</p>
        <div className="space-y-0.5">
          <label className={ligne}>
            <input type="checkbox" checked={options.titre} onChange={() => onOptions({ ...options, titre: !options.titre })} className={caseACocher} />
            <span className="flex-1">Page de titre</span>
          </label>
          <label className={ligne}>
            <input type="checkbox" checked={options.attenue} onChange={() => onOptions({ ...options, attenue: !options.attenue })} className={caseACocher} />
            <span className="flex-1">Plan en retrait<span className="block text-xs text-muted-foreground">Le dessin en gris clair, l’élément en couleur</span></span>
          </label>
          <label className={cn(ligne, !photosDisponibles && 'cursor-default opacity-60 hover:bg-transparent')}>
            <input type="checkbox" checked={photosDisponibles && options.photos} disabled={!photosDisponibles} onChange={() => onOptions({ ...options, photos: !options.photos })} className={caseACocher} />
            <span className="flex-1">Photos de l’existant
              <span className="block text-xs text-muted-foreground">
                {photosDisponibles ? 'Après le tableau des éléments rattachés à des relevés' : 'Aucun relevé avec photo n’est rattaché à ces métrés'}
              </span>
            </span>
          </label>
          <label className={ligne}>
            <input type="checkbox" checked={options.recapitulatif} onChange={() => onOptions({ ...options, recapitulatif: !options.recapitulatif })} className={caseACocher} />
            <span className="flex-1">Récapitulatif final</span>
          </label>
        </div>
      </section>
    </div>
  )
}
