/**
 * Illustrations de la page publique.
 *
 * Dessinées en formes géométriques plutôt qu'en personnages détaillés : un
 * bâtiment, une façade annotée, une feuille de rapport. Le sujet de Diagly est
 * le bâti, pas les gens, et des aplats francs se lisent mieux qu'un dessin
 * chargé sur un écran de téléphone.
 *
 * Chaque illustration porte un titre accessible : elle raconte quelque chose,
 * elle n'est pas décorative.
 */

const MARINE = '#1b3a5c'
const MARINE_CLAIR = '#2a5580'
const CORAIL = '#ff7a59'
const SABLE = '#f4e7da'
const CREME = '#fdf8f3'
const BLANC = '#ffffff'

/** Forme organique de fond, pour poser la couleur sans rien dire. */
export function Blob({ className, couleur = SABLE }: { className?: string; couleur?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true" focusable="false">
      <path
        fill={couleur}
        d="M42 -62C55 -53 66 -41 72 -26C78 -11 79 7 74 24C69 41 58 56 43 66C28 76 9 81 -10 79C-29 77 -48 68 -62 54C-76 40 -85 21 -85 2C-85 -17 -76 -36 -63 -50C-50 -64 -33 -73 -16 -76C1 -79 18 -76 42 -62Z"
        transform="translate(100 100)"
      />
    </svg>
  )
}

/** Une visite : quelqu'un photographie une façade au téléphone. */
export function VisiteEnPhoto({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 420 340" className={className} role="img" aria-labelledby="illu-visite">
      <title id="illu-visite">Une personne photographie la façade d'un immeuble avec son téléphone</title>
      <ellipse cx="210" cy="312" rx="180" ry="16" fill={SABLE} />

      {/* L'immeuble */}
      <rect x="152" y="52" width="180" height="248" rx="8" fill={MARINE} />
      <rect x="152" y="52" width="180" height="34" rx="8" fill={MARINE_CLAIR} />
      {[0, 1, 2, 3].map((r) =>
        [0, 1, 2].map((c) => (
          <rect key={`${r}-${c}`} x={172 + c * 52} y={104 + r * 46} width="34" height="30" rx="4" fill={r === 1 && c === 1 ? CORAIL : CREME} opacity={r === 1 && c === 1 ? 1 : 0.85} />
        )),
      )}
      <rect x="222" y="256" width="40" height="44" rx="4" fill={SABLE} />

      {/* La personne, de dos */}
      <circle cx="74" cy="150" r="22" fill={MARINE_CLAIR} />
      <path d="M74 176c-24 0-40 16-40 38v86h80v-86c0-22-16-38-40-38Z" fill={CORAIL} />
      <rect x="96" y="186" width="34" height="50" rx="6" fill={MARINE} />
      <rect x="102" y="194" width="22" height="34" rx="3" fill={CREME} />

      {/* Le cadrage */}
      <path d="M132 172h18v-14M132 236h18v14" stroke={CORAIL} strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/** Façade annotée : les points que l'analyse relève sur une photo. */
export function FacadeAnnotee({ className }: { className?: string }) {
  const points = [
    { x: 86, y: 92, label: 'Fissure' },
    { x: 176, y: 148, label: 'Enduit' },
    { x: 118, y: 218, label: 'Menuiserie' },
  ]
  return (
    <svg viewBox="0 0 260 300" className={className} role="img" aria-labelledby="illu-facade">
      <title id="illu-facade">Photo de façade avec trois points d'analyse relevés</title>
      <rect x="16" y="16" width="228" height="268" rx="12" fill={MARINE_CLAIR} />
      <rect x="16" y="16" width="228" height="268" rx="12" fill={MARINE} opacity="0.25" />
      {[0, 1, 2].map((r) =>
        [0, 1].map((c) => (
          <rect key={`${r}-${c}`} x={54 + c * 92} y={62 + r * 74} width="56" height="48" rx="5" fill={CREME} opacity="0.9" />
        )),
      )}
      {points.map((p) => (
        <g key={p.label}>
          <circle cx={p.x} cy={p.y} r="15" fill={CORAIL} opacity="0.25" />
          <circle cx={p.x} cy={p.y} r="7" fill={CORAIL} stroke={BLANC} strokeWidth="2.5" />
        </g>
      ))}
    </svg>
  )
}

/** La feuille de rapport qui sort du diagnostic. */
export function FeuilleRapport({ className }: { className?: string }) {
  const lignes = [
    { code: '226', l: 96, etat: CORAIL },
    { code: '221', l: 128, etat: '#f59e0b' },
    { code: '224', l: 74, etat: '#22c55e' },
    { code: '242', l: 140, etat: CORAIL },
    { code: '261', l: 108, etat: '#22c55e' },
  ]
  return (
    <svg viewBox="0 0 260 300" className={className} role="img" aria-labelledby="illu-rapport">
      <title id="illu-rapport">Rapport généré, une ligne par poste avec son code et son état</title>
      <rect x="20" y="14" width="220" height="272" rx="12" fill={BLANC} stroke={SABLE} strokeWidth="2" />
      <rect x="44" y="40" width="118" height="12" rx="6" fill={MARINE} />
      <rect x="44" y="60" width="72" height="8" rx="4" fill={SABLE} />
      {lignes.map((li, i) => (
        <g key={li.code}>
          <rect x="44" y={94 + i * 34} width="26" height="9" rx="4.5" fill={MARINE_CLAIR} opacity="0.55" />
          <rect x="78" y={94 + i * 34} width={li.l} height="9" rx="4.5" fill={SABLE} />
          <circle cx={216} cy={98.5 + i * 34} r="6" fill={li.etat} />
        </g>
      ))}
      <rect x="44" y="266" width="90" height="10" rx="5" fill={MARINE} opacity="0.2" />
      <rect x="176" y="264" width="46" height="14" rx="7" fill={CORAIL} />
    </svg>
  )
}

/** Écran de l'app : la photo à gauche, le chiffrage à droite. */
export function ApercuProduit({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 560 340" className={className} role="img" aria-labelledby="illu-produit">
      <title id="illu-produit">Aperçu de l'application : la photo d'un ouvrage et le chiffrage qui en découle</title>
      <rect x="8" y="8" width="544" height="324" rx="18" fill={BLANC} stroke={SABLE} strokeWidth="2" />
      <rect x="8" y="8" width="544" height="44" rx="18" fill={CREME} />
      <circle cx="36" cy="30" r="5" fill={CORAIL} />
      <circle cx="54" cy="30" r="5" fill={SABLE} />
      <circle cx="72" cy="30" r="5" fill={SABLE} />

      {/* Colonne photo */}
      <rect x="32" y="76" width="228" height="152" rx="10" fill={MARINE_CLAIR} />
      {[0, 1].map((r) =>
        [0, 1, 2].map((c) => (
          <rect key={`${r}-${c}`} x={54 + c * 68} y={98 + r * 64} width="46" height="38" rx="4" fill={CREME} opacity="0.85" />
        )),
      )}
      <circle cx="146" cy="152" r="16" fill={CORAIL} opacity="0.3" />
      <circle cx="146" cy="152" r="7" fill={CORAIL} stroke={BLANC} strokeWidth="2.5" />
      <rect x="32" y="242" width="104" height="12" rx="6" fill={SABLE} />
      <rect x="32" y="266" width="150" height="10" rx="5" fill={SABLE} opacity="0.7" />

      {/* Colonne chiffrage */}
      <rect x="292" y="76" width="236" height="32" rx="8" fill={CREME} />
      <rect x="306" y="86" width="80" height="12" rx="6" fill={MARINE} opacity="0.7" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x="292" y={122 + i * 42} width="236" height="32" rx="8" fill={BLANC} stroke={SABLE} strokeWidth="1.5" />
          <circle cx="310" cy={138 + i * 42} r="5" fill={i === 0 ? CORAIL : i === 1 ? '#f59e0b' : '#22c55e'} />
          <rect x="326" y={133 + i * 42} width={i === 1 ? 96 : 120} height="9" rx="4.5" fill={SABLE} />
          <rect x={462} y={133 + i * 42} width="52" height="9" rx="4.5" fill={MARINE} opacity="0.35" />
        </g>
      ))}
      <rect x="292" y="294" width="236" height="26" rx="8" fill={MARINE} />
      <rect x="308" y="303" width="70" height="8" rx="4" fill={BLANC} opacity="0.55" />
      <rect x="456" y="301" width="58" height="12" rx="6" fill={CORAIL} />
    </svg>
  )
}
