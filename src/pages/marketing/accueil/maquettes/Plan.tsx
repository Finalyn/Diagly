import { cn } from '@/lib/utils'
import { PIECES } from './donnees'

/**
 * Le plan d'étage des maquettes, en vecteurs.
 *
 * C'est l'étage type des plans d'essai de l'outil Métrés
 * (lib/plans/plans-de-test.ts) : deux logements en miroir autour de la cage
 * d'escalier, 20 m sur 11, au 1:100. Ses cotes sont connues au centimètre,
 * les surfaces affichées par les maquettes en découlent : elles se
 * recalculent à la main, comme celles d'un vrai métré. Aucun plan de client.
 *
 * Coordonnées en mètres, origine au coin sud-ouest, l'axe y vers le nord ;
 * le SVG retourne l'axe à l'affichage.
 */

const L = 20
const P = 11
const MUR = 0.3
const CLOISON = 0.12
const MUR_CAGE = 0.25
const CAGE = { gauche: 8.5, droite: 11.5 }
const PALIERE = { y1: 1.6, y2: 2.5 }
const PORTES_CLOISON: [number, number][] = [[2.0, 2.8], [4.2, 4.9], [6.5, 7.3]]
const FENETRES_SUD: [number, number][] = [[1.5, 3.0], [5.0, 6.5]]
const FENETRES_NORD: [number, number][] = [[1.2, 2.4], [4.1, 4.9], [6.4, 7.6]]
const FENETRE_OUEST: [number, number] = [2.0, 3.4]

const miroir = (x: number) => L - x
const Y = (y: number) => P - y
const sym = (o: [number, number][]) => [...o, ...o.map(([a, b]) => [miroir(b), miroir(a)] as [number, number])]
const SUD = sym(FENETRES_SUD)
const NORD = sym(FENETRES_NORD)
const PORTES = sym(PORTES_CLOISON)

/** Les morceaux pleins d'un mur interrompu par des ouvertures. */
function pleins(debut: number, fin: number, ouvertures: [number, number][]): [number, number][] {
  const tri = [...ouvertures].sort((u, v) => u[0] - v[0])
  const r: [number, number][] = []
  let x = debut
  for (const [a, b] of tri) { if (a > x) r.push([x, a]); x = Math.max(x, b) }
  if (fin > x) r.push([x, fin])
  return r
}

const INDIGO = '#6366f1'
const AMBRE = '#f59e0b'
const SARCELLE = '#0f766e'

export function PlanEtage({ pieces = false, numeros = false, fenetres = false, portes = false, aValider = false, retrait = false, cotes = true, className }: {
  pieces?: boolean
  numeros?: boolean
  fenetres?: boolean
  /** Les portes palières, comptées comme éléments. */
  portes?: boolean
  /**
   * Les portes intérieures du logement B, posées par l'IA et pas encore
   * validées : des repères en pointillé, le premier cerné par la revue.
   */
  aValider?: boolean
  /** Le dessin en retrait, pour que seules les formes ressortent. */
  retrait?: boolean
  cotes?: boolean
  className?: string
}) {
  const trait = retrait ? '#9ca3af' : '#1f2937'
  const plein = retrait ? '#d1d5db' : '#8e9097'
  const cloison = retrait ? '#e5e7eb' : '#c3c5ca'
  const texte = retrait ? '#9ca3af' : '#4b5563'
  const pave = (x: number, y: number, l: number, h: number, k: string) =>
    <rect key={`${k}${x}-${y}`} x={x} y={Y(y + h)} width={l} height={h} />

  return (
    <svg viewBox="-2 -0.9 23 14.4" className={cn('block h-auto w-full', className)} fontFamily="Inter Variable, Inter, system-ui, sans-serif">
      {/* Murs porteurs et façades, interrompus aux ouvertures. */}
      <g fill={plein}>
        {pleins(0, L, SUD).map(([a, b]) => pave(a, 0, b - a, MUR, 's'))}
        {pleins(0, L, NORD).map(([a, b]) => pave(a, P - MUR, b - a, MUR, 'n'))}
        {pleins(MUR, P - MUR, [FENETRE_OUEST]).flatMap(([a, b]) => [pave(0, a, MUR, b - a, 'o'), pave(L - MUR, a, MUR, b - a, 'e')])}
        {pleins(MUR, P - MUR, [[PALIERE.y1, PALIERE.y2]]).flatMap(([a, b]) => [
          pave(CAGE.gauche, a, MUR_CAGE, b - a, 'cg'), pave(CAGE.droite - MUR_CAGE, a, MUR_CAGE, b - a, 'cd'),
        ])}
      </g>
      <g fill={cloison}>
        {pleins(MUR, CAGE.gauche, PORTES.filter(([x]) => x < 10)).map(([a, b]) => pave(a, 6, b - a, CLOISON, 'k'))}
        {pleins(CAGE.droite, L - MUR, PORTES.filter(([x]) => x > 10)).map(([a, b]) => pave(a, 6, b - a, CLOISON, 'K'))}
        {[3.5, 5.5].flatMap((x) => [
          pave(x, 6 + CLOISON, CLOISON, P - MUR - 6 - CLOISON, 'v'),
          pave(miroir(x) - CLOISON, 6 + CLOISON, CLOISON, P - MUR - 6 - CLOISON, 'V'),
        ])}
      </g>

      {/* Les pièces : ce que l'IA a dessiné, ce qui attend d'être validé. */}
      {pieces && PIECES.map((p) => {
        const [x1, y1, x2, y2] = p.r
        return (
          <rect
            key={p.numero}
            x={x1} y={Y(y2)} width={x2 - x1} height={y2 - y1}
            fill={INDIGO} fillOpacity={0.2} stroke={INDIGO} strokeWidth={0.05}
          />
        )
      })}

      {/* Contour, fenêtres, portes, escalier : le trait du dessinateur. */}
      <g fill="none" stroke={trait} strokeLinecap="round">
        <rect x={0} y={0} width={L} height={P} strokeWidth={0.05} />
        <g strokeWidth={0.02}>
          {SUD.map(([a, b]) => <Fenetre key={`fs${a}`} a={a} b={b} y={Y(MUR)} ep={MUR} />)}
          {NORD.map(([a, b]) => <Fenetre key={`fn${a}`} a={a} b={b} y={Y(P)} ep={MUR} />)}
          <FenetreV a={FENETRE_OUEST[0]} b={FENETRE_OUEST[1]} x={0} ep={MUR} />
          <FenetreV a={FENETRE_OUEST[0]} b={FENETRE_OUEST[1]} x={L - MUR} ep={MUR} />
        </g>
        <g strokeWidth={0.018}>
          <Porte hx={CAGE.gauche} hy={PALIERE.y1} l={PALIERE.y2 - PALIERE.y1} mur={90} vantail={180} />
          <Porte hx={CAGE.droite} hy={PALIERE.y1} l={PALIERE.y2 - PALIERE.y1} mur={90} vantail={0} />
          {PORTES_CLOISON.flatMap(([a, b]) => [
            <Porte key={`p${a}`} hx={a} hy={6 + CLOISON} l={b - a} mur={0} vantail={90} />,
            <Porte key={`P${a}`} hx={miroir(a)} hy={6 + CLOISON} l={b - a} mur={180} vantail={90} />,
          ])}
          {/* Escalier : deux volées et leurs marches. */}
          <line x1={10} y1={Y(4.2)} x2={10} y2={Y(10.4)} />
          {Array.from({ length: 23 }, (_, i) => 4.2 + i * 0.28).map((y) => (
            <line key={y} x1={CAGE.gauche + MUR_CAGE} y1={Y(y)} x2={CAGE.droite - MUR_CAGE} y2={Y(y)} />
          ))}
          {/* Cuisines contre la cage, salles de bain entre les cloisons. */}
          {[CAGE.gauche - 0.6, CAGE.droite].map((x) => (
            <g key={x}>
              <rect x={x} y={Y(5.6)} width={0.6} height={2.6} />
              <rect x={x + 0.1} y={Y(4.5)} width={0.4} height={0.5} />
            </g>
          ))}
          {[1, -1].map((sens) => {
            const r = (x0: number, y0: number, l: number, h: number) => {
              const x = sens === 1 ? x0 : miroir(x0 + l)
              return <rect key={`${sens}${x0}${y0}`} x={x} y={Y(y0 + h)} width={l} height={h} rx={0.06} />
            }
            return (
              <g key={sens}>
                {r(3.7, 9.85, 1.7, 0.75)}{r(3.85, 9.95, 1.4, 0.55)}
                {r(5.0, 7.2, 0.45, 0.6)}{r(3.7, 7.4, 0.4, 0.2)}{r(3.75, 7.6, 0.3, 0.55)}
              </g>
            )
          })}
        </g>
      </g>

      {/* Noms des locaux, comme sur le plan d'origine. */}
      {!numeros && (
        <g fill={texte} fontSize={0.34} textAnchor="middle">
          <text x={4.4} y={Y(3.0)}>Séjour</text>
          <text x={15.6} y={Y(3.0)}>Séjour</text>
          <text x={7.3} y={Y(5.2)} fontSize={0.26}>Cuisine</text>
          <text x={12.7} y={Y(5.2)} fontSize={0.26}>Cuisine</text>
          <text x={1.9} y={Y(8.4)}>Chambre</text>
          <text x={7.06} y={Y(8.4)}>Chambre</text>
          <text x={12.94} y={Y(8.4)}>Chambre</text>
          <text x={18.1} y={Y(8.4)}>Chambre</text>
          <text x={4.56} y={Y(8.6)} fontSize={0.26}>Bain</text>
          <text x={15.44} y={Y(8.6)} fontSize={0.26}>Bain</text>
          <text x={10} y={Y(3.0)} fontSize={0.26}>Palier</text>
        </g>
      )}

      {/* Fenêtres repérées, en ambre. */}
      {fenetres && (
        <g fill={AMBRE} fillOpacity={0.55} stroke={AMBRE} strokeWidth={0.03}>
          {SUD.map(([a, b]) => <rect key={`as${a}`} x={a} y={Y(MUR)} width={b - a} height={MUR} />)}
          {NORD.map(([a, b]) => <rect key={`an${a}`} x={a} y={Y(P)} width={b - a} height={MUR} />)}
          <rect x={0} y={Y(FENETRE_OUEST[1])} width={MUR} height={FENETRE_OUEST[1] - FENETRE_OUEST[0]} />
          <rect x={L - MUR} y={Y(FENETRE_OUEST[1])} width={MUR} height={FENETRE_OUEST[1] - FENETRE_OUEST[0]} />
        </g>
      )}

      {/* Portes palières comptées : un repère par porte. */}
      {portes && [CAGE.gauche + MUR_CAGE / 2, CAGE.droite - MUR_CAGE / 2].map((x, i) => (
        <g key={x}>
          <circle cx={x} cy={Y((PALIERE.y1 + PALIERE.y2) / 2)} r={0.36} fill={SARCELLE} stroke="#fff" strokeWidth={0.07} />
          <text x={x} y={Y((PALIERE.y1 + PALIERE.y2) / 2) + 0.12} fontSize={0.34} fontWeight={700} fill="#fff" textAnchor="middle">{i + 1}</text>
        </g>
      ))}

      {/* Repères proposés, en attente de validation. */}
      {aValider && PORTES_CLOISON.map(([a, b], i) => {
        const cx = miroir((a + b) / 2)
        const cy = Y(6 + CLOISON / 2)
        return (
          <g key={`v${a}`}>
            {i === 0 && <circle cx={cx} cy={cy} r={0.62} fill="none" stroke="#1d1d1f" strokeWidth={0.06} />}
            <circle cx={cx} cy={cy} r={0.36} fill="#ffffff" fillOpacity={0.85} stroke={SARCELLE} strokeWidth={0.07} strokeDasharray="0.16 0.1" />
          </g>
        )
      })}

      {/* Numéros des pièces, posés au centre de chacune. */}
      {pieces && numeros && PIECES.map((p) => {
        const cx = (p.r[0] + p.r[2]) / 2
        const cy = Y((p.r[1] + p.r[3]) / 2)
        return (
          <g key={`n${p.numero}`}>
            <circle cx={cx} cy={cy} r={0.38} fill={INDIGO} stroke="#fff" strokeWidth={0.07} />
            <text x={cx} y={cy + 0.13} fontSize={0.36} fontWeight={700} fill="#fff" textAnchor="middle">{p.numero}</text>
          </g>
        )
      })}

      {/* Chaînes de cotes au sud et à l'ouest. */}
      {cotes && (
        <g stroke={texte} strokeWidth={0.015} fill={texte} fontSize={0.3} textAnchor="middle">
          <Cote x1={0} x2={L} y={Y(-1.2)} texte="20.00" />
          <Cote x1={0} x2={CAGE.gauche} y={Y(-0.6)} texte="8.50" />
          <Cote x1={CAGE.gauche} x2={CAGE.droite} y={Y(-0.6)} texte="3.00" />
          <Cote x1={CAGE.droite} x2={L} y={Y(-0.6)} texte="8.50" />
          <line x1={-1.2} y1={Y(0)} x2={-1.2} y2={Y(P)} />
          <line x1={-1.32} y1={Y(0) - 0.12} x2={-1.08} y2={Y(0) + 0.12} />
          <line x1={-1.32} y1={Y(P) - 0.12} x2={-1.08} y2={Y(P) + 0.12} />
          <text x={-1.4} y={Y(P / 2)} stroke="none" transform={`rotate(-90 -1.4 ${Y(P / 2)})`}>11.00</text>
        </g>
      )}
    </svg>
  )
}

function Fenetre({ a, b, y, ep }: { a: number; b: number; y: number; ep: number }) {
  return (
    <g>
      <line x1={a} y1={y} x2={a} y2={y + ep} />
      <line x1={b} y1={y} x2={b} y2={y + ep} />
      <line x1={a} y1={y + ep * 0.5} x2={b} y2={y + ep * 0.5} />
      <line x1={a} y1={y + ep * 0.38} x2={b} y2={y + ep * 0.38} />
    </g>
  )
}

function FenetreV({ a, b, x, ep }: { a: number; b: number; x: number; ep: number }) {
  return (
    <g>
      <line x1={x} y1={Y(a)} x2={x + ep} y2={Y(a)} />
      <line x1={x} y1={Y(b)} x2={x + ep} y2={Y(b)} />
      <line x1={x + ep * 0.5} y1={Y(a)} x2={x + ep * 0.5} y2={Y(b)} />
      <line x1={x + ep * 0.62} y1={Y(a)} x2={x + ep * 0.62} y2={Y(b)} />
    </g>
  )
}

/** Une porte : le vantail ouvert depuis sa charnière, et l'arc que décrit son bord. */
function Porte({ hx, hy, l, mur, vantail }: { hx: number; hy: number; l: number; mur: number; vantail: number }) {
  const rad = (a: number) => (a * Math.PI) / 180
  const vx = hx + l * Math.cos(rad(vantail))
  const vy = hy + l * Math.sin(rad(vantail))
  const mx = hx + l * Math.cos(rad(mur))
  const my = hy + l * Math.sin(rad(mur))
  // Retourné à l'affichage, le sens de l'arc s'inverse lui aussi.
  const balayage = ((mur - vantail + 360) % 360) < 180 ? 0 : 1
  return (
    <g>
      <line x1={hx} y1={Y(hy)} x2={vx} y2={Y(vy)} />
      <path d={`M${vx} ${Y(vy)} A${l} ${l} 0 0 ${balayage} ${mx} ${Y(my)}`} />
    </g>
  )
}

function Cote({ x1, x2, y, texte }: { x1: number; x2: number; y: number; texte: string }) {
  return (
    <g>
      <line x1={x1} y1={y} x2={x2} y2={y} />
      <line x1={x1 - 0.12} y1={y + 0.12} x2={x1 + 0.12} y2={y - 0.12} />
      <line x1={x2 - 0.12} y1={y + 0.12} x2={x2 + 0.12} y2={y - 0.12} />
      <text x={(x1 + x2) / 2} y={y - 0.12} stroke="none">{texte}</text>
    </g>
  )
}
