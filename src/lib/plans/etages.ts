/**
 * Les étages qu'une feuille représente, pour l'outil Métrés.
 *
 * Un jeu de plans scannés porte souvent un « étage type » : un seul plan qui
 * vaut pour le 1er, le 2e, le 3e et le 4e (Champrilly 16-18-20). La feuille
 * garde deux choses, que le reste des Métrés lit déjà : un libellé de niveau
 * (« 1er au 4ème »), qui range les tableaux du bas vers le haut, et un nombre
 * d'étages identiques, qui multiplie ses quantités. Ce module passe des
 * étages cochés à ce libellé, et relit un libellé pour cocher les étages.
 *
 * Un étage est un rang : -2 pour le 2e sous-sol, -1 le sous-sol, 0 le rez,
 * 1 le 1er, et COMBLES pour les combles, comme rangDuNiveau.
 *
 * Module pur, pour être vérifiable par les tests.
 */
import { rangDuNiveau } from './presentation'

export const COMBLES = 50

/** « Sous-sol », « 2ème sous-sol », « Rez », « 1er », « 3ème », « Combles ». */
export function nomDuNiveau(n: number): string {
  if (n === COMBLES) return 'Combles'
  if (n === -1) return 'Sous-sol'
  if (n < -1) return `${-n}ème sous-sol`
  if (n === 0) return 'Rez'
  return n === 1 ? '1er' : `${n}ème`
}

/** Le même, en court, pour une pastille : « SS », « 2SS », « Rez », « 1er », « Cb ». */
export function nomCourt(n: number): string {
  if (n === COMBLES) return 'Comb.'
  if (n === -1) return 'SS'
  if (n < -1) return `${-n}SS`
  return nomDuNiveau(n)
}

/**
 * Le libellé d'un choix d'étages : « 1er au 4ème », « Rez et 1er »,
 * « Sous-sol, Rez et Combles ». Trois étages qui se suivent ou plus
 * s'écrivent en plage ; deux se nomment l'un et l'autre.
 */
export function libelleEtages(etages: Iterable<number>): string {
  const tries = [...new Set(etages)].sort((a, b) => a - b)
  const morceaux: string[] = []
  let i = 0
  while (i < tries.length) {
    let j = i
    while (j + 1 < tries.length && tries[j + 1] === tries[j] + 1 && tries[j + 1] !== COMBLES) j++
    if (j - i >= 2) morceaux.push(`${nomDuNiveau(tries[i])} au ${nomDuNiveau(tries[j])}`)
    else for (let k = i; k <= j; k++) morceaux.push(nomDuNiveau(tries[k]))
    i = j + 1
  }
  if (morceaux.length <= 1) return morceaux[0] ?? ''
  return `${morceaux.slice(0, -1).join(', ')} et ${morceaux[morceaux.length - 1]}`
}

/** Un rang d'étage lu dans un bout de libellé ; la toiture et les rez intermédiaires n'en sont pas. */
function rangEntier(morceau: string): number | null {
  const r = rangDuNiveau(morceau)
  return r != null && Number.isInteger(r) && r <= COMBLES ? r : null
}

/**
 * Les étages qu'un libellé nomme, pour les cocher : « 1er au 4ème »,
 * « 1er-4e », « Rez et 1er », « 2e, 3e, 4e ». null quand le libellé ne
 * se laisse pas lire en entier (« Étage type », « Façade est ») : on ne
 * coche rien plutôt que de cocher à moitié.
 */
export function lireEtages(niveau: string | null | undefined): number[] | null {
  const t = niveau?.trim()
  if (!t) return null
  const rangs = new Set<number>()
  for (const morceau of t.split(/\s*(?:,|;|\+|\/|\bet\b)\s*/i).filter(Boolean)) {
    const lus = lireMorceau(morceau)
    if (!lus) return null
    for (const r of lus) rangs.add(r)
  }
  return rangs.size ? [...rangs].sort((x, y) => x - y) : null
}

/** Un étage seul, ou une plage : « 1er au 4ème », « 1er-4e ». */
function lireMorceau(morceau: string): number[] | null {
  const plage = morceau.split(/\s+(?:au|à|a|jusqu’au|jusqu'au)\s+|(?<=\S)\s*[-–]\s*(?=\d|rez|sous|r\b)/i)
  if (plage.length === 2) {
    const [de, a] = plage.map(rangEntier)
    if (de != null && a != null && de < a && a < COMBLES) {
      return Array.from({ length: a - de + 1 }, (_, i) => de + i)
    }
  }
  const r = rangEntier(morceau)
  return r == null ? null : [r]
}
