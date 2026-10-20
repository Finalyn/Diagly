import { useEffect, useRef, useState } from 'react'
import { Check, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOCUS, MarqueIA } from '../ui'
import { PlanEtage } from './Plan'
import { CAGE, FENETRE_OUEST, L, MUR, MUR_CAGE, NORD, P, PALIERE, PORTES_CLOISON, SUD, VUE, Y, miroir } from './geometrie'
import { PIECES, nombreFr, surface } from './donnees'

/**
 * L'IA qui lit un plan d'étage, en interface : on la regarde travailler.
 *
 * Quand la carte arrive à l'écran, une bande bleue balaie la feuille, puis
 * les pièces se dessinent une à une avec leur surface, les fenêtres et les
 * portes palières se repèrent, et le panneau des quantités se remplit. Le
 * plan est l'étage type des
 * plans d'essai, dessiné en vecteurs : les surfaces affichées se recalculent
 * à la main depuis ses cotes.
 *
 * Avec le mouvement réduit, tout s'affiche d'emblée, sans animation.
 */

const INDIGO = '#6366f1'
const AMBRE = '#f59e0b'
const SARCELLE = '#0f766e'
const ROSE = '#db2777'

/** Les temps de l'animation : le balayage, les pièces, les ouvertures, puis les quantités. */
type Phase = 0 | 1 | 2 | 3 | 4
const DEBUT_PHASE: Record<Exclude<Phase, 0>, number> = { 1: 0, 2: 2300, 3: 3700, 4: 4600 }

const TOTAL_PIECES = Math.round(PIECES.reduce((s, p) => s + surface(p), 0) * 100) / 100
const NB_FENETRES = SUD.length + NORD.length + 2
const NB_PORTES_INT = PORTES_CLOISON.length * 2

function mouvementReduit() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function AnalysePlan() {
  // Avec le mouvement réduit, le résultat s'affiche d'emblée.
  const [phase, setPhase] = useState<Phase>(() => (mouvementReduit() ? 4 : 0))
  const [tour, setTour] = useState(0)
  const zone = useRef<HTMLDivElement>(null)

  // Le premier passage démarre quand la carte entre à l'écran ; « Revoir » relance un tour.
  useEffect(() => {
    const el = zone.current
    if (!el) return
    if (mouvementReduit()) return
    let minuteries: number[] = []
    const lancer = () => {
      minuteries = (Object.entries(DEBUT_PHASE) as [string, number][]).map(([p, t]) => window.setTimeout(() => setPhase(Number(p) as Phase), t))
    }
    if (tour > 0 || typeof IntersectionObserver === 'undefined') { lancer(); return () => minuteries.forEach(clearTimeout) }
    const o = new IntersectionObserver((e) => {
      if (e.some((x) => x.isIntersecting)) { o.disconnect(); lancer() }
    }, { rootMargin: '0px 0px -25% 0px' })
    o.observe(el)
    return () => { o.disconnect(); minuteries.forEach(clearTimeout) }
  }, [tour])

  const revoir = () => { setPhase(0); setTour((t) => t + 1) }

  return (
    <div ref={zone}>
      <FenetreAnalyse phase={phase} onRevoir={revoir} />
    </div>
  )
}

/** La fenêtre de l'outil Métrés, réduite : la feuille et ses quantités. */
function FenetreAnalyse({ phase, onRevoir }: { phase: Phase; onRevoir: () => void }) {
  const pret = phase === 4
  return (
    <figure
      aria-label="Un plan d’étage type lu par l’IA : l’échelle vérifiée, les pièces dessinées avec leur surface, les fenêtres et les portes palières repérées, puis les quantités de l’étage."
      className="@container overflow-hidden rounded-3xl border border-black/[0.06] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03),0_24px_60px_-28px_rgba(15,23,42,0.35)]"
    >
      {/* La barre de la feuille, comme dans l'espace Métrés. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-black/[0.06] px-4 py-3 sm:px-5">
        <p className="text-[14px] font-semibold text-[#111827]">102 · Étage type <span className="font-normal text-[#6b7280]">(1er au 3e)</span></p>
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium transition-opacity duration-500', phase >= 1 ? 'opacity-100' : 'opacity-0', 'bg-[#e8f7ee] text-[#15803d]')}>
          <Check className="h-3 w-3" aria-hidden="true" />Échelle 1:100 vérifiée
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[12.5px] text-[#6b7280]">
          <MarqueIA className="h-3.5 w-3.5" />
          {phase === 0 ? 'En attente' : phase < 4 ? 'L’IA lit la feuille…' : 'Analyse terminée'}
        </span>
      </div>

      <div>
        {/* La feuille : le dessin, puis les calques de l'IA par-dessus. */}
        <div className="relative overflow-hidden bg-[#fbfbfc] px-2 py-3 sm:px-4 sm:py-4">
          <div className="relative">
            <PlanEtage />
            <svg viewBox={VUE} className="absolute inset-0 h-full w-full" aria-hidden="true" fontFamily="Inter Variable, Inter, system-ui, sans-serif">
              {/* Les pièces, une à une. */}
              {PIECES.map((p, i) => {
                const [x1, y1, x2, y2] = p.r
                const visible = phase >= 2
                return (
                  <g
                    key={p.numero}
                    style={{ transitionDelay: visible ? `${i * 110}ms` : '0ms', transformOrigin: 'center', transformBox: 'fill-box' }}
                    className={cn('transition-[opacity,transform] duration-500', visible ? 'opacity-100' : 'scale-95 opacity-0')}
                  >
                    <rect x={x1} y={Y(y2)} width={x2 - x1} height={y2 - y1} fill={INDIGO} fillOpacity={0.16} stroke={INDIGO} strokeWidth={0.06} />
                    <text
                      x={(x1 + x2) / 2} y={Y((y1 + y2) / 2) + 0.14}
                      fontSize={x2 - x1 < 2.2 ? 0.36 : 0.5} fontWeight={700} fill="#3730a3" textAnchor="middle"
                      stroke="#fff" strokeWidth={0.12} paintOrder="stroke"
                    >
                      {nombreFr(surface(p))} m²
                    </text>
                  </g>
                )
              })}

              {/* Les fenêtres, en ambre, puis les portes palières et intérieures, numérotées. */}
              <g className={cn('transition-opacity duration-500', phase >= 3 ? 'opacity-100' : 'opacity-0')} fill={AMBRE} fillOpacity={0.6} stroke={AMBRE} strokeWidth={0.03}>
                {SUD.map(([a, b]) => <rect key={`s${a}`} x={a} y={Y(MUR)} width={b - a} height={MUR} />)}
                {NORD.map(([a, b]) => <rect key={`n${a}`} x={a} y={Y(P)} width={b - a} height={MUR} />)}
                <rect x={0} y={Y(FENETRE_OUEST[1])} width={MUR} height={FENETRE_OUEST[1] - FENETRE_OUEST[0]} />
                <rect x={L - MUR} y={Y(FENETRE_OUEST[1])} width={MUR} height={FENETRE_OUEST[1] - FENETRE_OUEST[0]} />
              </g>
              {[CAGE.gauche + MUR_CAGE / 2, CAGE.droite - MUR_CAGE / 2].map((x, i) => (
                <Repere key={`p${x}`} x={x} y={Y((PALIERE.y1 + PALIERE.y2) / 2)} couleur={SARCELLE} numero={i + 1} visible={phase >= 3} delai={300 + i * 150} />
              ))}
              {PORTES_CLOISON.flatMap(([a, b]) => [(a + b) / 2, miroir((a + b) / 2)]).map((x, i) => (
                <Repere key={`i${x}`} x={x} y={Y(6.06)} couleur={ROSE} numero={i + 1} visible={phase >= 3} delai={600 + i * 90} petit />
              ))}
            </svg>

            {/* La bande qui balaie la feuille pendant la lecture. */}
            {phase === 1 && (
              <div aria-hidden="true" className="accueil-balayage pointer-events-none absolute inset-y-0 left-0 w-[18%]">
                <div className="h-full w-full bg-gradient-to-r from-transparent via-[#0167EA]/15 to-[#0167EA]/30" />
                <div className="absolute inset-y-0 right-0 w-[2px] bg-[#0167EA] shadow-[0_0_18px_4px_rgba(1,103,234,0.45)]" />
              </div>
            )}
          </div>
        </div>

        {/* Les quantités de l'étage, qui se remplissent sous la feuille. */}
        <div className="border-t border-black/[0.06] px-4 py-4 sm:px-5">
          <ul className="grid grid-cols-2 gap-x-4 gap-y-3 @md:grid-cols-4">
            <Ligne couleur={INDIGO} libelle="Pièces" valeur={TOTAL_PIECES} unite="m²" decimales={2} actif={phase >= 2} />
            <Ligne couleur={AMBRE} libelle="Fenêtres" valeur={NB_FENETRES} unite="pce" actif={phase >= 3} />
            <Ligne couleur={SARCELLE} libelle="Portes palières" valeur={2} unite="pce" actif={phase >= 3} />
            <Ligne couleur={ROSE} libelle="Portes intérieures" valeur={NB_PORTES_INT} unite="pce" actif={phase >= 3} />
          </ul>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className={cn('rounded-full px-3 py-1.5 text-[13px] transition-colors duration-500', pret ? 'bg-[#eef4ff] text-[#0b3d8f]' : 'bg-[#f5f7fa] text-[#8a8f98]')}>
              × 3 étages identiques{pret && <> : <span className="font-semibold">{nombreFr(TOTAL_PIECES * 3)} m² de pièces</span></>}
            </p>
            <button
              type="button"
              onClick={onRevoir}
              disabled={!pret}
              className={cn('inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-[13.5px] font-medium text-[#0167EA] transition-opacity disabled:opacity-0', FOCUS)}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />Revoir l’analyse
            </button>
          </div>
        </div>
      </div>
    </figure>
  )
}

/** Un repère numéroté, posé sur un élément compté. */
function Repere({ x, y, couleur, numero, visible, delai, petit }: { x: number; y: number; couleur: string; numero: number; visible: boolean; delai: number; petit?: boolean }) {
  const r = petit ? 0.3 : 0.36
  return (
    <g
      style={{ transitionDelay: visible ? `${delai}ms` : '0ms', transformOrigin: 'center', transformBox: 'fill-box' }}
      className={cn('transition-[opacity,transform] duration-300', visible ? 'opacity-100' : 'scale-50 opacity-0')}
    >
      <circle cx={x} cy={y} r={r} fill={couleur} stroke="#fff" strokeWidth={0.07} />
      <text x={x} y={y + (petit ? 0.1 : 0.12)} fontSize={petit ? 0.28 : 0.34} fontWeight={700} fill="#fff" textAnchor="middle">{numero}</text>
    </g>
  )
}

/** Une ligne du panneau : le total monte de zéro à sa valeur quand son tour vient. */
function Ligne({ couleur, libelle, valeur, unite, decimales = 0, actif }: { couleur: string; libelle: string; valeur: number; unite: string; decimales?: number; actif: boolean }) {
  const affiche = useCompteur(valeur, actif)
  return (
    <li className={cn('transition-opacity duration-500', actif ? 'opacity-100' : 'opacity-40')}>
      <span className="flex items-center gap-2 text-[13px] text-[#6b7280]">
        <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: couleur }} />{libelle}
      </span>
      <span className="mt-0.5 block whitespace-nowrap text-[18px] font-semibold tabular-nums tracking-[-0.01em] text-[#111827]">{nombreFr(affiche, decimales)} {unite}</span>
    </li>
  )
}

/** Un compteur qui monte en 0,9 s, sans animation si le mouvement est réduit. */
function useCompteur(cible: number, actif: boolean) {
  const [v, setV] = useState(0)
  const reduit = mouvementReduit()
  useEffect(() => {
    if (!actif || reduit) return
    let image = 0
    const debut = performance.now()
    const pas = (t: number) => {
      const k = Math.min(1, (t - debut) / 900)
      setV(cible * (1 - Math.pow(1 - k, 3)))
      if (k < 1) image = requestAnimationFrame(pas)
    }
    image = requestAnimationFrame(pas)
    return () => cancelAnimationFrame(image)
  }, [cible, actif, reduit])
  if (!actif) return 0
  return reduit ? cible : v
}
