/**
 * La géométrie de l'étage type des maquettes, en mètres : le plan (Plan.tsx)
 * la dessine, la section « Tout commence par un plan » anime ses calques
 * par-dessus. Origine au coin sud-ouest, l'axe y vers le nord ; `Y` retourne
 * l'axe pour le SVG.
 */

export const L = 20
export const P = 11
export const MUR = 0.3
export const CLOISON = 0.12
export const MUR_CAGE = 0.25
export const CAGE = { gauche: 8.5, droite: 11.5 }
export const PALIERE = { y1: 1.6, y2: 2.5 }
export const PORTES_CLOISON: [number, number][] = [[2.0, 2.8], [4.2, 4.9], [6.5, 7.3]]
const FENETRES_SUD: [number, number][] = [[1.5, 3.0], [5.0, 6.5]]
const FENETRES_NORD: [number, number][] = [[1.2, 2.4], [4.1, 4.9], [6.4, 7.6]]
export const FENETRE_OUEST: [number, number] = [2.0, 3.4]

export const miroir = (x: number) => L - x
export const Y = (y: number) => P - y
const sym = (o: [number, number][]) => [...o, ...o.map(([a, b]) => [miroir(b), miroir(a)] as [number, number])]
export const SUD = sym(FENETRES_SUD)
export const NORD = sym(FENETRES_NORD)
export const PORTES = sym(PORTES_CLOISON)

/** Le cadre du dessin, cotes comprises. */
export const VUE = '-2 -0.9 23 14.4'
