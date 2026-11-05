import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as Pointeur, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Maquette } from '../ui'
import { PlanEtage } from './Plan'
import { CAGE, CLOISON, FENETRE_OUEST, L, MUR, MUR_CAGE, NORD, P, PALIERE, PORTES, PORTES_CLOISON, SUD, VUE, Y, miroir } from './geometrie'
import { GROUPES_COUTS, PIECES, SYNTHESE, nombreFr, surface, totalGroupe, type CategorieSia } from './donnees'

/**
 * Les scènes des fonctionnalités de l'accueil (sections/Atouts.tsx) : chaque
 * outil raconté en quelques secondes, sans fond, sur les données d'exemple
 * des maquettes (l'étage type et le chiffrage de la Résidence Les Tilleuls).
 *
 * Une scène se joue quand elle porte `joue` : chaque élément a sa classe
 * d'animation (sc-*, index.css) et son heure de départ, en secondes. Sans
 * `joue`, et en mouvement réduit, elle montre son image finale. Les tailles
 * suivent la largeur de la scène (cqw) : elle se lit pareil sur téléphone.
 */

/** L'heure de départ d'un élément, en secondes ; deux pour un élément qui entre puis sort. */
const a = (...s: number[]): CSSProperties => ({ animationDelay: s.map((x) => `${x}s`).join(', ') })

const PETIT = 'text-[clamp(9px,1.7cqw,12px)]'

function Scene({ joue, description, className, children }: { joue: boolean; description: string; className?: string; children: ReactNode }) {
  return (
    <Maquette description={description} className={cn('relative aspect-[4/3] w-full select-none [container-type:inline-size]', joue && 'sc-joue', className)}>
      {children}
    </Maquette>
  )
}

/* ---------- Métrés : le plan lu, puis le rez monté, chaque ouvrage à la couleur de son CFC ---------- */

const TEINTE: Record<CategorieSia, string> = { SUP: '#0167EA', SUS: '#7c3aed', SD: '#f59e0b' }

/*
 * La feuille du plan fait 92cqw de large et son dessin 94 % de la feuille,
 * pour les 23 m du cadre (VUE) : d'où la taille d'un mètre sur la scène, et
 * la place du bâtiment (20 m sur 11) sur la feuille, où ses murs montent.
 */
const FEUILLE = 92
const MARGE = FEUILLE * 0.03
const METRE = (FEUILLE * 0.94) / 23
const HAUT_FEUILLE = 14.4 * METRE + 2 * MARGE
const BATI: CSSProperties = { left: `${MARGE + 2 * METRE}cqw`, top: `${MARGE + 0.9 * METRE}cqw`, width: `${L * METRE}cqw`, height: `${P * METRE}cqw` }
/** Le centre du bâtiment sur la feuille : il tourne autour. */
const PIVOT = `${MARGE + 12 * METRE}cqw ${MARGE + 6.4 * METRE}cqw`
/** Une longueur du plan, en mètres, sur la scène. */
const m = (x: number) => `${x * METRE}cqw`

/** Les murs du rez font 2,75 m ; le haut des portes, sous leur linteau, et celui de leurs vantaux. */
const MURS = 2.75
const LINTEAU = 2.1
const VANTAIL = 2.05

/*
 * Les heures de la scène, en secondes : le plan apparaît, ses pièces se
 * posent avec leur surface, il se couche, les murs du rez montent sur son
 * dessin ; puis chaque groupe d'ouvrages prend la couleur de son CFC, l'un
 * après l'autre.
 */
const LECTURE = 0.5
const BASCULE = 3.4
const REZ = 5.1
/** Le temps que mettent les murs à monter (--d, index.css). */
const MONTEE = 1.4
const COULEURS = REZ + MONTEE + 0.3
const PAS = 0.45

/**
 * Les ouvrages du rez, chacun avec son CFC, comme dans le chiffrage
 * (donnees.ts). Au survol, on lit le code et le nom de l'ouvrage.
 */
type Ouvrage = 'mur' | 'facade' | 'fenetre' | 'entree' | 'cloison' | 'palier' | 'porte' | 'marche' | 'sol'
const OUVRAGES: Record<Ouvrage, { cfc: string; nom: string }> = {
  mur: { cfc: '211.6', nom: 'Murs en maçonnerie' },
  facade: { cfc: '226.1', nom: 'Façade en crépi' },
  fenetre: { cfc: '221.0', nom: 'Fenêtres en bois' },
  entree: { cfc: '221', nom: 'Porte d’entrée' },
  cloison: { cfc: '271', nom: 'Cloisons en plâtre' },
  palier: { cfc: '273', nom: 'Portes palières en bois' },
  porte: { cfc: '273', nom: 'Portes intérieures en bois' },
  marche: { cfc: '211.5', nom: 'Escalier en béton armé' },
  sol: { cfc: '281', nom: 'Revêtements de sol' },
}
/** Une couleur par CFC, dans l'ordre où les ouvrages la prennent ; les portes palières et intérieures partagent la leur. */
const GROUPES: { couleur: string; ouvrages: Ouvrage[] }[] = [
  { couleur: '#64748b', ouvrages: ['mur'] },
  { couleur: '#d99a4e', ouvrages: ['facade'] },
  { couleur: '#0167EA', ouvrages: ['fenetre'] },
  { couleur: '#0d9488', ouvrages: ['entree'] },
  { couleur: '#8b5cf6', ouvrages: ['cloison'] },
  { couleur: '#b45309', ouvrages: ['palier', 'porte'] },
  { couleur: '#f59e0b', ouvrages: ['marche'] },
  { couleur: '#10b981', ouvrages: ['sol'] },
]
const groupe = (o: Ouvrage) => GROUPES.findIndex((g) => g.ouvrages.includes(o))
const FIN = COULEURS + (GROUPES.length - 1) * PAS + 0.6

/** Combien de groupes ont déjà leur couleur, et celui qu'on survole. */
interface Vue { etape: number; survol: number | null }
/** Un ouvrage est en couleur une fois son groupe passé, sauf quand on en survole un autre : il redevient blanc. */
const vif = (o: Ouvrage, v: Vue) => groupe(o) < v.etape && (v.survol === null || v.survol === groupe(o))
/** Une couleur éclaircie, mêlée de blanc dans la proportion `blanc`. */
function nuance(hex: string, blanc: number) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return `rgb(${c.map((x) => Math.round(x + (255 - x) * blanc)).join(' ')})`
}
/** La teinte d'un ouvrage : neutre, ou celle de son groupe éclaircie selon le côté. */
const teinte = (o: Ouvrage, blanc: number, v: Vue, neutre: string) => (vif(o, v) ? nuance(GROUPES[groupe(o)].couleur, blanc) : neutre)
const FONDU = 'background-color 0.5s, fill 0.5s, opacity 0.5s'

/** La porte d'entrée, au pied de la cage d'escalier. */
const ENTREE: [number, number] = [9.3, 10.7]

/*
 * Les murs du plan (Plan.tsx), pan par pan. Un pan est debout sur une ligne
 * du plan (y pour un pan tourné au sud ou au nord, x pour l'ouest ou l'est),
 * de `de` à `vers` le long de cette ligne, en mètres.
 */
type Sens = 's' | 'n' | 'o' | 'e'
interface Pan {
  sens: Sens
  ligne: number
  de: number
  vers: number
  ouvrage: Ouvrage
  fenetres?: [number, number][]
  /** Les portes percées dans le mur, sous leur linteau. */
  portes?: [number, number][]
  /** La porte d'entrée. */
  entree?: boolean
  /** Sa hauteur, si ce n'est pas celle des murs. */
  haut?: number
  /** Une contremarche : seule une bande de cette hauteur, en haut du pan, est pleine. */
  bande?: number
}
const pan = (sens: Sens, ligne: number, de: number, vers: number, ouvrage: Ouvrage, plus: Partial<Pan> = {}): Pan =>
  ({ sens, ligne, de, vers, ouvrage, ...plus })

const CAGES = [CAGE.gauche, CAGE.droite - MUR_CAGE]
const PALIER: [number, number] = [PALIERE.y1, PALIERE.y2]
/** Les cloisons qui ferment les chambres, de part et d'autre de la cage, avec leurs portes. */
const CLOISONS_H = [
  { de: MUR, vers: CAGE.gauche, portes: PORTES.filter(([x]) => x < 10) },
  { de: CAGE.droite, vers: L - MUR, portes: PORTES.filter(([x]) => x > 10) },
]
const CLOISONS_V = [3.5, 5.5].flatMap((x) => [x, miroir(x) - CLOISON])

/** Un vantail ouvert : deux faces dos à dos, debout sur sa ligne. */
const vantail = (cotes: [Sens, Sens], ligne: number, de: number, vers: number, ouvrage: Ouvrage): Pan[] =>
  cotes.map((s) => pan(s, ligne, de, vers, ouvrage, { haut: VANTAIL }))

/**
 * Les pans du rez : les façades vues de dehors, leur autre face, la cage et
 * ses portes palières, les cloisons et les portes des chambres. Les vantaux
 * sont ouverts comme sur le plan : les portes palières vers les logements,
 * celles des chambres vers le nord.
 */
const PANS: Pan[] = [
  pan('s', 0, 0, L, 'facade', { fenetres: SUD, entree: true }), pan('n', P, 0, L, 'facade', { fenetres: NORD }),
  pan('o', 0, 0, P, 'facade', { fenetres: [FENETRE_OUEST] }), pan('e', L, 0, P, 'facade', { fenetres: [FENETRE_OUEST] }),
  pan('n', MUR, MUR, L - MUR, 'mur', { fenetres: SUD, entree: true }), pan('s', P - MUR, MUR, L - MUR, 'mur', { fenetres: NORD }),
  pan('e', MUR, MUR, P - MUR, 'mur', { fenetres: [FENETRE_OUEST] }), pan('o', L - MUR, MUR, P - MUR, 'mur', { fenetres: [FENETRE_OUEST] }),
  ...CAGES.flatMap((x) => [
    pan('o', x, MUR, P - MUR, 'mur', { portes: [PALIER] }), pan('e', x + MUR_CAGE, MUR, P - MUR, 'mur', { portes: [PALIER] }),
    pan('n', PALIERE.y1, x, x + MUR_CAGE, 'mur'), pan('s', PALIERE.y2, x, x + MUR_CAGE, 'mur'),
  ]),
  ...CLOISONS_H.flatMap(({ de, vers, portes }) => [pan('s', 6, de, vers, 'cloison', { portes }), pan('n', 6 + CLOISON, de, vers, 'cloison', { portes })]),
  ...CLOISONS_V.flatMap((x) => [pan('o', x, 6 + CLOISON, P - MUR, 'cloison'), pan('e', x + CLOISON, 6 + CLOISON, P - MUR, 'cloison')]),
  ...vantail(['s', 'n'], PALIERE.y1, CAGE.gauche - (PALIERE.y2 - PALIERE.y1), CAGE.gauche, 'palier'),
  ...vantail(['s', 'n'], PALIERE.y1, CAGE.droite, CAGE.droite + (PALIERE.y2 - PALIERE.y1), 'palier'),
  ...PORTES_CLOISON.flatMap(([g, d]) => [g, miroir(g)].flatMap((x) => vantail(['o', 'e'], x, 6 + CLOISON, 6 + CLOISON + d - g, 'porte'))),
]

/** Le dessus des murs, d'un seul tenant : les murs porteurs, puis les cloisons ; il passe sur les linteaux. */
type Rect = [number, number, number, number]
const PORTEURS: Rect[] = [
  [0, 0, L, MUR], [0, P - MUR, L, P], [0, MUR, MUR, P - MUR], [L - MUR, MUR, L, P - MUR],
  ...CAGES.map((x): Rect => [x, MUR, x + MUR_CAGE, P - MUR]),
]
const LEGERS: Rect[] = [
  ...CLOISONS_H.map(({ de, vers }): Rect => [de, 6, vers, 6 + CLOISON]),
  ...CLOISONS_V.map((x): Rect => [x, 6 + CLOISON, x + CLOISON, P - MUR]),
]

/*
 * L'escalier de la cage, en U, jusqu'au haut des murs : la volée ouest monte
 * vers le nord jusqu'au palier intermédiaire, la volée est repart vers le
 * sud, huit marches chacune. Les volées sont à jour : une contremarche ne
 * fait qu'une marche de haut, et le limon de la volée est, entre les deux,
 * dessine ses marches au-dessus de la paillasse.
 */
const MARCHES = 8
const PIED = 4.2
const REPOS = 9.5
const GIRON = (REPOS - PIED) / MARCHES
const CONTRE = MURS / 2 / MARCHES
const VOLEE_O = CAGE.gauche + MUR_CAGE
const AXE = (CAGE.gauche + CAGE.droite) / 2
const VOLEE_E = CAGE.droite - MUR_CAGE
const PAILLASSE = 0.3
const RANGS = Array.from({ length: MARCHES }, (_, i) => i + 1)
/** Le dessus de chaque marche, à sa hauteur, et le palier intermédiaire. */
const GIRONS: { r: Rect; z: number }[] = [
  ...RANGS.map((k) => ({ r: [VOLEE_O, PIED + (k - 1) * GIRON, AXE, PIED + k * GIRON] as Rect, z: k * CONTRE })),
  { r: [VOLEE_O, REPOS, VOLEE_E, P - MUR], z: MURS / 2 },
  ...RANGS.map((k) => ({ r: [AXE, REPOS - k * GIRON, VOLEE_E, REPOS - (k - 1) * GIRON] as Rect, z: MURS / 2 + k * CONTRE })),
]
const CONTREMARCHES: Pan[] = [
  ...RANGS.map((k) => pan('s', PIED + (k - 1) * GIRON, VOLEE_O, AXE, 'marche', { haut: k * CONTRE, bande: CONTRE })),
  ...RANGS.map((k) => pan('n', REPOS - (k - 1) * GIRON, AXE, VOLEE_E, 'marche', { haut: MURS / 2 + k * CONTRE, bande: CONTRE })),
  pan('s', PIED, AXE, VOLEE_E, 'marche', { haut: MURS, bande: PAILLASSE }),
]
/** Le profil du limon de la volée est (u depuis le pied, z en hauteur) : ses marches, puis le dessous de la paillasse. */
const LIMON = [
  ...RANGS.flatMap((k) => [[(k - 1) * GIRON, MURS - (k - 1) * CONTRE], [k * GIRON, MURS - (k - 1) * CONTRE]]),
  [MARCHES * GIRON, MURS / 2 - PAILLASSE],
  [0, MURS - PAILLASSE],
].map(([u, z]) => `${u},${z}`).join(' ')

/** Chaque côté a sa teinte, comme sous une lumière venue du sud-est : en blanc, puis la part de blanc mêlée à la couleur. */
const JOUR: Record<Sens, string> = { s: '#f5f7fb', n: '#e3e8ef', o: '#d9e0ea', e: '#eef1f6' }
const CLAIR: Record<Sens, number> = { s: 0.56, n: 0.46, o: 0.36, e: 0.64 }
const VERRE = '#c4d6f0'
const TRAIT = '#8ea6c8'
const FACE: Record<Sens, string> = { s: 'sc-face-s', n: 'sc-face-n', o: 'sc-face-o', e: 'sc-face-e' }

/**
 * Pour chaque côté, de (u le long du pan, z en hauteur) au SVG du pan, couché
 * pour se relever sur son bord (sc-face-*, index.css).
 */
const COUCHE: Record<Sens, (long: number, haut: number) => string> = {
  s: (_, haut) => `matrix(1 0 0 -1 0 ${haut})`,
  n: () => 'matrix(1 0 0 1 0 0)',
  o: (long) => `matrix(0 -1 1 0 0 ${long})`,
  e: (long, haut) => `matrix(0 -1 -1 0 ${haut} ${long})`,
}

/** La place d'un pan couché sur le plan, avant qu'il ne se relève sur sa ligne. */
function place(sens: Sens, ligne: number, de: number, vers: number, haut: number): CSSProperties {
  return sens === 's' || sens === 'n'
    ? { left: m(de), top: m(P - ligne - (sens === 's' ? haut : 0)), width: m(vers - de), height: m(haut) }
    : { left: m(ligne - (sens === 'e' ? haut : 0)), top: m(P - vers), width: m(haut), height: m(vers - de) }
}

/**
 * Le plan d'étage lu par l'IA, ses pièces colorées avec leur surface ; puis
 * il se couche, et le rez monte sur son dessin, ses murs, ses portes et son
 * escalier, en blanc. Chaque groupe d'ouvrages prend ensuite la couleur de
 * son CFC. Le rez tourne alors doucement ; on le fait tourner du doigt ou à
 * la souris, et le survol d'un ouvrage (un toucher, au téléphone) donne son
 * CFC, son groupe seul restant en couleur.
 */
export function SceneMetres({ joue }: { joue: boolean }) {
  const tour = useRef<HTMLDivElement>(null)
  const bulle = useRef<HTMLDivElement>(null)
  const glisse = useRef<{ x: number; depart: number } | null>(null)
  // L'angle donné à la main ; tant qu'on n'y a pas touché, il tourne seul.
  const [angle, setAngle] = useState<number | null>(null)
  const [etape, setEtape] = useState(joue ? 0 : GROUPES.length)
  const [survol, setSurvol] = useState<Ouvrage | null>(null)
  const pret = etape === GROUPES.length
  const vue: Vue = { etape, survol: survol && groupe(survol) }

  useEffect(() => {
    if (!joue) return
    const t = GROUPES.map((_, i) => window.setTimeout(() => setEtape(i + 1), (COULEURS + i * PAS) * 1000))
    return () => t.forEach((x) => window.clearTimeout(x))
  }, [joue])

  // L'ouvrage sous le pointeur, et l'étiquette qui le suit.
  const viser = (e: Pointeur<HTMLDivElement>) => {
    const o = (e.target as Element).closest('[data-ouvrage]')?.getAttribute('data-ouvrage') as Ouvrage | undefined
    setSurvol(o ?? null)
    const r = e.currentTarget.getBoundingClientRect()
    bulle.current?.style.setProperty('left', `${e.clientX - r.left}px`)
    bulle.current?.style.setProperty('top', `${e.clientY - r.top}px`)
  }
  const saisir = (e: Pointeur<HTMLDivElement>) => {
    const el = tour.current
    if (!pret || !el || (e.pointerType === 'mouse' && e.button !== 0)) return
    if (e.pointerType !== 'mouse') viser(e)
    const mat = new DOMMatrixReadOnly(getComputedStyle(el).transform)
    const depart = angle ?? (Math.atan2(mat.b, mat.a) * 180) / Math.PI
    glisse.current = { x: e.clientX, depart }
    setAngle(depart)
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const bouger = (e: Pointeur<HTMLDivElement>) => {
    const g = glisse.current
    if (g && Math.abs(e.clientX - g.x) > 3) {
      setSurvol(null)
      setAngle(g.depart - ((e.clientX - g.x) / e.currentTarget.clientWidth) * 300)
    } else if (!g && pret && e.pointerType === 'mouse') viser(e)
  }
  const lacher = () => { glisse.current = null }
  const sortir = (e: Pointeur<HTMLDivElement>) => { if (e.pointerType === 'mouse') setSurvol(null) }

  return (
    <Scene joue={joue} description="Un plan d’étage lu par l’IA : les pièces se colorent avec leur surface, puis le rez monte sur le plan, ses murs, ses portes et son escalier ; chaque ouvrage prend ensuite la couleur de son code CFC, que l’on lit en le survolant ; on peut faire tourner le rez.">
      {/* On le fait tourner en le glissant ; au téléphone, le défilement vertical reste à la page. */}
      <div
        className={cn('absolute inset-0 touch-pan-y [perspective:2600px]', pret && 'cursor-grab active:cursor-grabbing')}
        onPointerDown={saisir} onPointerMove={bouger} onPointerUp={lacher} onPointerCancel={lacher} onPointerLeave={sortir}
      >
        <div
          className="sc-plateau absolute [transform-style:preserve-3d]"
          style={{ left: `${(100 - FEUILLE) / 2}cqw`, top: `${(75 - HAUT_FEUILLE) / 2}cqw`, width: `${FEUILLE}cqw`, height: `${HAUT_FEUILLE}cqw`, ...a(BASCULE) }}
        >
          <div className="sc-pivote absolute inset-0 [transform-style:preserve-3d]" style={{ transformOrigin: PIVOT, ...a(BASCULE) }}>
            <div
              ref={tour}
              className={cn('absolute inset-0 [transform-style:preserve-3d]', angle === null && 'sc-tourne')}
              style={angle === null ? { transformOrigin: PIVOT, ...a(FIN) } : { transformOrigin: PIVOT, transform: `rotateZ(${angle}deg)` }}
            >
              {etape === 0 && (
                <div className="sc-efface absolute inset-0 p-[3%]" style={a(REZ - 0.1)}>
                  <div className="sc-fondu relative" style={a(0)}>
                    <PlanEtage />
                    <Pieces anime />
                  </div>
                </div>
              )}
              <Rez vue={vue} />
            </div>
          </div>
        </div>
      </div>
      {/* L'étiquette de l'ouvrage survolé, au-dessus du pointeur. */}
      <div
        ref={bulle}
        className={cn(
          'pointer-events-none absolute z-10 inline-flex -translate-x-1/2 -translate-y-[calc(100%+14px)] items-center gap-[1cqw] whitespace-nowrap rounded-lg bg-white px-3 py-2 text-[#0b1220] shadow-[0_10px_28px_-14px_rgba(11,31,68,0.4)] ring-1 ring-black/[0.06] transition-opacity',
          PETIT, survol ? 'opacity-100' : 'opacity-0',
        )}
      >
        {survol && (
          <>
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: GROUPES[groupe(survol)].couleur }} />
            <span className="font-semibold">CFC {OUVRAGES[survol].cfc}</span>
            <span className="text-[#5b6472]">{OUVRAGES[survol].nom}</span>
          </>
        )}
      </div>
    </Scene>
  )
}

/**
 * Les pièces de l'étage type, colorées par catégorie SIA. Sur le plan qui
 * apparaît (`anime`), elles se posent une à une, chaque séjour et chaque chambre avec
 * sa surface, qui s'efface avant que le plan ne se couche.
 */
function Pieces({ anime = false, style }: { anime?: boolean; style?: CSSProperties }) {
  return (
    <svg viewBox={VUE} className="absolute inset-0 h-full w-full" style={style} fontFamily="Inter Variable, Inter, system-ui, sans-serif">
      {PIECES.map((p, i) => {
        const [x1, y1, x2, y2] = p.r
        return (
          <rect
            key={p.numero}
            className={anime ? 'sc-fondu' : undefined}
            style={anime ? a(LECTURE + i * 0.1) : undefined}
            x={x1} y={Y(y2)} width={x2 - x1} height={y2 - y1}
            fill={TEINTE[p.sia]} fillOpacity={0.16} stroke={TEINTE[p.sia]} strokeWidth={0.05}
          />
        )
      })}
      {anime && PIECES.filter((p) => p.sia === 'SUP').map((p, i) => (
        <text
          key={p.numero}
          className="sc-passe"
          style={a(LECTURE + 0.3 + i * 0.12, BASCULE - 0.3)}
          x={(p.r[0] + p.r[2]) / 2} y={Y((p.r[1] + p.r[3]) / 2 - 0.62)}
          fontSize={0.5} fontWeight={600} fill="#0154c4" textAnchor="middle"
        >
          {nombreFr(surface(p))} m²
        </text>
      ))}
    </svg>
  )
}

/**
 * Le rez : son ombre, le plan à son sol, sans les cotes, puis ses murs qui
 * montent ensemble, leur dessus avec eux (sc-leve, sc-arase), ses portes et
 * son escalier. Le sol prend sa couleur avec les autres revêtements : les
 * pièces du plan s'effacent alors.
 */
function Rez({ vue }: { vue: Vue }) {
  const s = a(REZ)
  const sol = vif('sol', vue)
  return (
    <div className="absolute [transform-style:preserve-3d]" style={{ ...BATI, '--h': m(MURS), '--d': `${MONTEE}s` } as CSSProperties}>
      <div className="sc-fondu absolute -inset-[3%] rounded-[2cqw] bg-[#0b1f44]/[0.14] blur-[1.6cqw]" style={s} />
      <div data-ouvrage="sol" className="sc-fondu absolute inset-0 overflow-hidden" style={{ ...a(REZ - 0.1), background: sol ? nuance(GROUPES[groupe('sol')].couleur, 0.8) : '#ffffff', transition: FONDU }}>
        <div className="absolute left-[-10%] top-[-8.18%] w-[115%]">
          <PlanEtage cotes={false} />
          <Pieces style={{ opacity: groupe('sol') < vue.etape ? 0 : 1, transition: FONDU }} />
        </div>
      </div>
      {[...PANS, ...CONTREMARCHES].map((p, i) => <Face key={i} pan={p} vue={vue} style={s} />)}
      <Arases rects={PORTEURS} ouvrage="mur" neutre="#8e9097" vue={vue} />
      <Arases rects={LEGERS} ouvrage="cloison" neutre="#b9bcc3" vue={vue} />
      {GIRONS.map(({ r: [x1, y1, x2, y2], z }) => (
        <div
          key={`${x1}-${y1}`} data-ouvrage="marche" className="sc-arase absolute"
          style={{ left: m(x1), top: m(P - y2), width: m(x2 - x1), height: m(y2 - y1), background: teinte('marche', 0.55, vue, '#fbfcfd'), transition: FONDU, ...s, '--h': m(z) } as CSSProperties}
        />
      ))}
      <svg
        data-ouvrage="marche" viewBox={`0 0 ${MURS} ${REPOS - PIED}`} preserveAspectRatio="none"
        className="sc-leve sc-face-o pointer-events-none absolute" style={{ ...place('o', AXE, PIED, REPOS, MURS), ...s }}
      >
        <polygon className="pointer-events-auto" transform={COUCHE.o(REPOS - PIED, MURS)} points={LIMON} style={{ fill: teinte('marche', CLAIR.o, vue, JOUR.o), transition: FONDU }} />
      </svg>
    </div>
  )
}

/** Le dessus d'un groupe de murs, qui monte avec eux : la teinte du plan, puis celle du CFC. Entre les murs, le pointeur passe au travers. */
function Arases({ rects, ouvrage, neutre, vue }: { rects: Rect[]; ouvrage: Ouvrage; neutre: string; vue: Vue }) {
  return (
    <svg
      data-ouvrage={ouvrage} viewBox={`0 0 ${L} ${P}`} preserveAspectRatio="none"
      className="sc-arase pointer-events-none absolute inset-0 h-full w-full" style={{ ...a(REZ), fill: teinte(ouvrage, 0.1, vue, neutre), transition: FONDU }}
    >
      {rects.map(([x1, y1, x2, y2]) => <rect key={`${x1}-${y1}`} className="pointer-events-auto" x={x1} y={Y(y2)} width={x2 - x1} height={y2 - y1} />)}
    </svg>
  )
}

/**
 * Un pan debout sur sa ligne du plan : un mur, percé de ses portes sous leur
 * linteau, avec ses fenêtres (allège à 0,9 m, 1,5 m de haut) et la porte
 * d'entrée, chacune à sa place sur le plan ; un vantail, ou une contremarche,
 * pleine sur sa seule bande. Un pan plein, sans rien dessus, est un simple
 * aplat. Le pan et ses fenêtres prennent chacun la couleur de leur CFC ; le
 * pointeur passe au travers des portes et sous les contremarches.
 */
function Face({ pan: { sens, ligne, de, vers, ouvrage, fenetres = [], portes = [], entree, haut = MURS, bande }, vue, style }: { pan: Pan; vue: Vue; style: CSSProperties }) {
  const long = vers - de
  const fond = teinte(ouvrage, CLAIR[sens], vue, JOUR[sens])
  const classe = cn('sc-leve absolute', FACE[sens])
  const ici = place(sens, ligne, de, vers, haut)
  if (!fenetres.length && !portes.length && !entree && !bande) {
    return <div data-ouvrage={ouvrage} className={classe} style={{ ...ici, background: fond, transition: FONDU, ...style }} />
  }
  const debout = sens === 's' || sens === 'n'
  // Le mur, et ses portes découpées dedans jusqu'au linteau ; ou la seule bande d'une contremarche.
  const mur = bande
    ? `M0 ${haut - bande}H${long}V${haut}H0Z`
    : `M0 0H${long}V${haut}H0Z` + portes.map(([g, d]) => `M${g - de} 0H${d - de}V${LINTEAU}H${g - de}Z`).join('')
  return (
    <svg data-ouvrage={ouvrage} viewBox={debout ? `0 0 ${long} ${haut}` : `0 0 ${haut} ${long}`} preserveAspectRatio="none" className={cn(classe, 'pointer-events-none')} style={{ ...ici, ...style }}>
      <g className="pointer-events-auto" transform={COUCHE[sens](long, haut)} stroke={TRAIT} strokeWidth={0.05}>
        <path d={mur} fillRule="evenodd" stroke="none" style={{ fill: fond, transition: FONDU }} />
        {fenetres.map(([g, d]) => (
          <g key={g} data-ouvrage="fenetre" style={{ fill: teinte('fenetre', 0.35, vue, VERRE), transition: FONDU }}>
            <rect x={g - de} y={0.9} width={d - g} height={1.5} />
            <path d={`M${(g + d) / 2 - de} 0.9v1.5`} fill="none" />
          </g>
        ))}
        {entree && (
          <rect
            data-ouvrage="entree" x={ENTREE[0] - de} width={ENTREE[1] - ENTREE[0]} height={2.2}
            style={{ fill: teinte('entree', 0.1, vue, VERRE), transition: FONDU }}
          />
        )}
      </g>
    </svg>
  )
}

/* ---------- Rapport : ses premières pages, en éventail ---------- */

/** La part de chaque priorité dans le devis, pour la page de synthèse. */
const PRIORITES = GROUPES_COUTS.map((g, i) => ({
  p: g.p,
  teinte: ['#ef4444', '#f59e0b', '#16a34a'][i],
  part: totalGroupe(g) / SYNTHESE.ht,
}))
const chf = (v: number) => `${nombreFr(v, 0)} CHF`
const MINI = 'text-[clamp(6px,1.05cqw,9px)]'

/** Les chapitres du rapport complet, dans son ordre (components/report/RapportComplet.tsx). */
const CHAPITRES = ['Comment ce rapport est réalisé', 'Synthèse du diagnostic', 'Données du projet', 'Rapport photo', 'Devis estimatif ±15 %']

/**
 * L'en-tête que le bureau règle une fois (Personnaliser le rapport) et que
 * chaque page répète : sa raison sociale et son adresse, la place de son
 * logo à droite, puis un filet à sa couleur.
 */
function EnTeteBureau() {
  return (
    <div>
      <div className="flex items-center justify-between gap-[1cqw]">
        <div className={cn('leading-tight text-[#6b7280]', MINI)}>
          <p className="font-semibold text-[#0b1220]">Votre bureau</p>
          <p>Rue, NPA Ville</p>
        </div>
        <span className={cn('flex h-[3.4cqw] w-[9cqw] shrink-0 items-center justify-center rounded-[0.6cqw] border border-dashed border-[#0167EA]/60 bg-[#0167EA]/[0.06] font-semibold text-[#0167EA]', MINI)}>
          Votre logo
        </span>
      </div>
      <div className="mt-[1.1cqw] h-[0.3cqw] rounded-full bg-[#0167EA]" />
    </div>
  )
}

/**
 * Une page A4 de l'éventail, tournée autour d'un point sous le paquet : les
 * pages du dessous ne montrent que leur haut droit, là où sont leur logo et
 * leur titre.
 */
function Feuillet({ angle, children }: { angle: number; children: ReactNode }) {
  return (
    <div
      className="absolute left-[18%] top-[5%] flex aspect-[1/1.414] w-[28%] origin-[50%_160%] flex-col rounded-[1cqw] bg-white p-[1.9cqw] shadow-[0_18px_40px_-22px_rgba(11,31,68,0.45)] ring-1 ring-black/[0.07]"
      style={{ transform: `rotate(${angle}deg)` }}
    >
      <EnTeteBureau />
      <div className="mb-[1cqw] flex min-h-0 flex-1 flex-col">{children}</div>
      <p className={cn('border-t border-black/[0.06] pt-[0.8cqw] text-right text-[#9ca3af]', MINI)}>Résidence Les Tilleuls</p>
    </div>
  )
}

/** Le titre court d'une page, à droite : c'est ce qui dépasse de l'éventail. */
const TitrePage = ({ children }: { children: ReactNode }) => (
  <p className="mt-[1.8cqw] text-right text-[clamp(6px,1.45cqw,11px)] font-semibold text-[#0b1220]">{children}</p>
)

/** Des lignes de texte, en gris, calées à droite. */
function Lignes({ n, className }: { n: number; className?: string }) {
  return (
    <div className={cn('flex flex-col items-end gap-[0.8cqw]', className)}>
      {Array.from({ length: n }, (_, i) => <div key={i} className="h-[0.7cqw] rounded-full bg-[#e5e9f0]" style={{ width: `${[92, 78, 86, 64, 88, 70][i % 6]}%` }} />)}
    </div>
  )
}

/**
 * Les premières pages du rapport complet, en éventail et dans son ordre,
 * chacune sous l'en-tête du bureau : la page de garde devant, avec la place
 * de l'image de garde, puis le sommaire, la méthode, la synthèse, les données
 * du projet, le rapport photo et le devis. Une image fixe : ici, pas
 * d'animation.
 */
export function SceneRapport({ joue }: { joue: boolean }) {
  return (
    <Scene joue={joue} description="Les premières pages d’un rapport de diagnostic, en éventail : la page de garde, le sommaire, la méthode, la synthèse, les données du projet, le rapport photo et le devis estimatif, chacune avec en tête la raison sociale du bureau et la place de son logo.">
      <Feuillet angle={52}>
        <TitrePage>Devis</TitrePage>
        <Lignes n={6} className="mt-[1.4cqw]" />
        <div className={cn('mt-auto flex justify-between border-t border-black/[0.06] pt-[0.9cqw] font-semibold text-[#0b1220]', MINI)}>
          <span>Total TTC</span><span className="tabular-nums text-[#0167EA]">{chf(SYNTHESE.total)}</span>
        </div>
      </Feuillet>
      <Feuillet angle={42}>
        <TitrePage>Photos</TitrePage>
        <div className="mt-[1.4cqw] grid grid-cols-2 gap-[0.9cqw]">
          {Array.from({ length: 6 }, (_, i) => <div key={i} className="aspect-[4/3] rounded-[0.5cqw] bg-[#e5e9f0]" />)}
        </div>
      </Feuillet>
      <Feuillet angle={32}>
        <TitrePage>Données</TitrePage>
        <Lignes n={8} className="mt-[1.4cqw]" />
      </Feuillet>
      <Feuillet angle={22}>
        <TitrePage>Synthèse</TitrePage>
        <div className="mt-[1.4cqw] flex flex-col items-end gap-[0.9cqw]">
          {PRIORITES.map((x) => (
            <span key={x.p} className="h-[1.1cqw] rounded-full" style={{ width: `${Math.max(x.part, 0.08) * 70}%`, backgroundColor: x.teinte }} />
          ))}
        </div>
        <Lignes n={5} className="mt-[1.8cqw]" />
      </Feuillet>
      <Feuillet angle={12}>
        <TitrePage>Méthode</TitrePage>
        <Lignes n={9} className="mt-[1.4cqw]" />
      </Feuillet>
      <Feuillet angle={2}>
        <TitrePage>Sommaire</TitrePage>
        <div className="mt-[1.4cqw] space-y-[0.9cqw]">
          {CHAPITRES.map((c) => (
            <div key={c} className={cn('flex items-baseline gap-[0.8cqw] text-[#4b5563]', MINI)}>
              <span className="truncate">{c}</span>
              <span className="min-w-[2cqw] flex-1 border-b border-dotted border-[#cbd2dc]" />
            </div>
          ))}
        </div>
      </Feuillet>
      <Feuillet angle={-8}>
        <p className={cn('mt-[2.2cqw] font-semibold uppercase tracking-wide text-[#6b7280]', MINI)}>Diagnostic de bâtiment</p>
        <p className="mt-[0.4cqw] text-[clamp(10px,2cqw,16px)] font-semibold leading-tight tracking-[-0.02em] text-[#0b1220]">Rapport de diagnostic</p>
        <p className={cn('mt-[0.8cqw] font-medium text-[#0b1220]', MINI)}>Résidence Les Tilleuls</p>
        <p className={cn('text-[#6b7280]', MINI)}>Rue des Tilleuls 14, 1004 Lausanne</p>
        {/* La place de l'image de garde : celle que le bureau choisit pour le dossier. */}
        <div className={cn('mt-[1.4cqw] flex min-h-0 flex-1 items-center justify-center rounded-[0.7cqw] border border-dashed border-[#0167EA]/50 bg-[#0167EA]/[0.05] text-center font-semibold text-[#0167EA]', MINI)}>
          Votre image de garde
        </div>
      </Feuillet>
    </Scene>
  )
}
