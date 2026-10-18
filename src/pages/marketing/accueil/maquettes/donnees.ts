/**
 * Les données d'exemple des maquettes : l'immeuble « Les Tilleuls », ses
 * feuilles, les pièces de son étage type et son chiffrage. Elles sont
 * inventées et cohérentes entre elles : une surface du plan se retrouve dans
 * la présentation, un montant des coûts dans le rapport.
 */

export type CategorieSia = 'SUP' | 'SUS' | 'SD'

export interface Piece {
  numero: number
  nom: string
  /** x1, y1, x2, y2 en mètres, au nu intérieur. */
  r: [number, number, number, number]
  sia: CategorieSia
}

/** Les pièces de l'étage, numérotées comme au tableau de la présentation. */
export const PIECES: Piece[] = [
  { numero: 1, nom: 'Séjour et cuisine A', r: [0.3, 0.3, 8.5, 6.0], sia: 'SUP' },
  { numero: 2, nom: 'Chambre A1', r: [0.3, 6.12, 3.5, 10.7], sia: 'SUP' },
  { numero: 3, nom: 'Bain A', r: [3.62, 6.12, 5.5, 10.7], sia: 'SUS' },
  { numero: 4, nom: 'Chambre A2', r: [5.62, 6.12, 8.5, 10.7], sia: 'SUP' },
  { numero: 5, nom: 'Palier et escalier', r: [8.75, 0.3, 11.25, 10.7], sia: 'SD' },
  { numero: 6, nom: 'Séjour et cuisine B', r: [11.5, 0.3, 19.7, 6.0], sia: 'SUP' },
  { numero: 7, nom: 'Chambre B1', r: [11.5, 6.12, 14.38, 10.7], sia: 'SUP' },
  { numero: 8, nom: 'Bain B', r: [14.5, 6.12, 16.38, 10.7], sia: 'SUS' },
  { numero: 9, nom: 'Chambre B2', r: [16.5, 6.12, 19.7, 10.7], sia: 'SUP' },
]

/** La surface d'une pièce, en m², au centième. */
export const surface = (p: Piece) => Math.round((p.r[2] - p.r[0]) * (p.r[3] - p.r[1]) * 100) / 100

/** Un nombre au format suisse romand : 1 234,56. */
export const nombreFr = (v: number, decimales = 2) =>
  v.toLocaleString('fr-CH', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })

export type Vue = 'plan' | 'facade' | 'coupe'
export type Echelle = 'verifiee' | 'posee' | 'a_verifier'

export interface Feuille {
  numero: string
  titre: string
  detail: string
  vue: Vue
  echelle: Echelle
  aValider?: number
}

/** Le jeu d'exemple : six feuilles d'un petit immeuble, l'étage type au 1:100. */
export const FEUILLES: Feuille[] = [
  { numero: 'A-100', titre: 'Plan du rez', detail: 'Plan d’étage · Rez', vue: 'plan', echelle: 'verifiee' },
  { numero: 'A-101', titre: 'Étage type (1er au 3e)', detail: 'Plan d’étage · 1er au 3e · × 3 étages', vue: 'plan', echelle: 'verifiee', aValider: 3 },
  { numero: 'A-102', titre: 'Attique', detail: 'Plan d’étage · Attique', vue: 'plan', echelle: 'verifiee' },
  { numero: 'A-200', titre: 'Façade sud', detail: 'Élévation', vue: 'facade', echelle: 'verifiee' },
  { numero: 'A-201', titre: 'Façade nord', detail: 'Élévation', vue: 'facade', echelle: 'posee' },
  { numero: 'A-300', titre: 'Coupe A-A', detail: 'Coupe', vue: 'coupe', echelle: 'a_verifier' },
]

export type Etat = 'Très bon' | 'Bon' | 'Moyen' | 'Mauvais'
export const POINT_ETAT: Record<Etat, string> = { 'Très bon': 'bg-green-500', Bon: 'bg-green-400', Moyen: 'bg-orange-400', Mauvais: 'bg-red-500' }

export interface LigneCout { cfc: string; nom: string; etat: Etat; quantite: number; unite: string; prix: number }

export const GROUPES_COUTS: { p: 'I' | 'II' | 'III'; pastille: string; lignes: LigneCout[] }[] = [
  { p: 'I', pastille: 'bg-red-500 text-white', lignes: [
    { cfc: '242', nom: 'Chauffage, distribution', etat: 'Mauvais', quantite: 1020, unite: 'm²', prix: 85 },
    { cfc: '224.1', nom: 'Couverture en toiture plate', etat: 'Mauvais', quantite: 236, unite: 'm²', prix: 120 },
    { cfc: '281', nom: 'Revêtement des marches', etat: 'Mauvais', quantite: 64, unite: 'm²', prix: 185 },
  ] },
  { p: 'II', pastille: 'bg-orange-500 text-white', lignes: [
    { cfc: '226.1', nom: 'Façade en crépi non isolée', etat: 'Moyen', quantite: 837, unite: 'm²', prix: 45 },
    { cfc: '221.0', nom: 'Fenêtres en bois', etat: 'Moyen', quantite: 196.8, unite: 'm²', prix: 80 },
    { cfc: '273', nom: 'Portes palières en bois', etat: 'Moyen', quantite: 2, unite: 'pce', prix: 930 },
  ] },
  { p: 'III', pastille: 'bg-green-600 text-white', lignes: [
    { cfc: '271', nom: 'Crépis et enduits intérieurs', etat: 'Bon', quantite: 310, unite: 'm²', prix: 18 },
    { cfc: '233', nom: 'Lustrerie des paliers', etat: 'Très bon', quantite: 5, unite: 'pce', prix: 0 },
  ] },
]

export const montant = (l: LigneCout) => Math.round(l.quantite * l.prix)
export const totalGroupe = (g: typeof GROUPES_COUTS[number]) => g.lignes.reduce((s, l) => s + montant(l), 0)
const HT = GROUPES_COUTS.reduce((s, g) => s + totalGroupe(g), 0)
const HONORAIRES = HT * 0.12
const RESERVE = (HT + HONORAIRES) * 0.1
const SOUS_TOTAL = HT + HONORAIRES + RESERVE
const TVA = SOUS_TOTAL * 0.081
const TOTAL = SOUS_TOTAL + TVA
/** La cascade du devis, reprise par la page du rapport. */
export const SYNTHESE = { ht: HT, honoraires: HONORAIRES, reserve: RESERVE, tva: TVA, total: TOTAL }
