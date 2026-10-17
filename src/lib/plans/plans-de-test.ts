/**
 * Des plans PDF dont on connaît chaque cote, pour vérifier le métré.
 *
 * Mesurer juste, c'est d'abord pouvoir dire de combien on se trompe. Sur un
 * plan d'architecte réel, personne ne connaît la vraie surface d'une façade :
 * c'est justement ce qu'on cherche. Ces plans sont dessinés ici, à la main, à
 * une échelle déclarée : leurs dimensions sont connues au millimètre, et
 * l'échelle exacte, l'aimantation et les surfaces calculées se comparent à
 * elles.
 *
 * Ils ressemblent à de vrais plans, avec ce qui trompe une lecture naïve :
 * des chaînes de cotes et leurs lignes d'attache qui s'arrêtent à deux
 * millimètres des angles, une bande d'acrotère trente centimètres sous le haut
 * de la façade, des fenêtres dessinées avec leur cadre et leur vitrage, des
 * tablettes qui débordent, un mur extérieur interrompu aux fenêtres. Le dessin
 * passe par des matrices de transformation imbriquées (« cm »), des rectangles
 * (« re »), des courbes et des aplats, comme dans un export de logiciel de
 * dessin, pour que l'extraction de la géométrie soit éprouvée sur ce qu'elle
 * rencontrera.
 *
 * Le module n'écrit rien sur le disque et ne dépend de rien : il rend des
 * octets. Les tests l'emploient directement ; le script d'essai de bout en
 * bout l'emploie pour produire les fichiers à déposer dans l'outil Plan.
 */

/** Un point PDF vaut 1/72 de pouce : un millimètre en vaut 72 / 25,4. */
export const PT_PAR_MM = 72 / 25.4

/** Format A3 paysage, en points. */
export const A3_PAYSAGE = { largeur: 420 * PT_PAR_MM, hauteur: 297 * PT_PAR_MM }

interface PageDessinee {
  largeur: number
  hauteur: number
  /** Le flux de contenu de la page, opérateurs PDF en clair. */
  contenu: string
}

/** Un nombre écrit sans exposant ni zéros inutiles, comme un PDF l'attend. */
function n(v: number): string {
  const t = v.toFixed(6)
  return t.replace(/\.?0+$/, '') || '0'
}

/** Une chaîne de texte PDF : les parenthèses et la barre oblique inverse s'échappent. */
function chaine(t: string): string {
  return `(${t.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')})`
}

/**
 * Assemble un PDF de plusieurs pages.
 *
 * Le texte est en Helvetica, avec l'encodage WinAnsi : les lettres accentuées
 * du français y ont le même code qu'en Latin-1, d'où l'écriture octet par
 * octet de la chaîne finale.
 */
export function assemblerPdf(pages: PageDessinee[]): Uint8Array {
  const objets: string[] = []
  // 1 : catalogue, 2 : arbre des pages, 3 : police ; puis page et contenu par page.
  const premierePage = 4
  const kids = pages.map((_, i) => `${premierePage + i * 2} 0 R`).join(' ')
  objets.push('<< /Type /Catalog /Pages 2 0 R >>')
  objets.push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`)
  objets.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  pages.forEach((p, i) => {
    const contenu = premierePage + i * 2 + 1
    objets.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(p.largeur)} ${n(p.hauteur)}] `
      + `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contenu} 0 R >>`,
    )
    objets.push(`<< /Length ${p.contenu.length} >>\nstream\n${p.contenu}\nendstream`)
  })

  let sortie = '%PDF-1.4\n%âãÏÓ\n'
  const positions: number[] = []
  objets.forEach((o, i) => {
    positions.push(sortie.length)
    sortie += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = sortie.length
  sortie += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`
  for (const pos of positions) sortie += `${String(pos).padStart(10, '0')} 00000 n \n`
  sortie += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`

  const octets = new Uint8Array(sortie.length)
  for (let i = 0; i < sortie.length; i++) octets[i] = sortie.charCodeAt(i) & 0xff
  return octets
}

/**
 * Un crayon qui écrit des opérateurs PDF, en millimètres de la feuille.
 *
 * Le repère de la page est mis en millimètres une fois pour toutes (« cm »),
 * comme le font la plupart des logiciels de dessin ; le dessin du bâtiment,
 * lui, se fait en mètres réels dans un second repère imbriqué.
 */
class Crayon {
  ops: string[] = []
  ecrire(...o: string[]) { this.ops.push(...o) }
  epaisseur(mm: number) { this.ecrire(`${n(mm)} w`) }
  gris(g: number) { this.ecrire(`${n(g)} G`, `${n(g)} g`) }
  trait(x1: number, y1: number, x2: number, y2: number) {
    this.ecrire(`${n(x1)} ${n(y1)} m ${n(x2)} ${n(y2)} l S`)
  }
  rect(x: number, y: number, l: number, h: number) {
    this.ecrire(`${n(x)} ${n(y)} ${n(l)} ${n(h)} re S`)
  }
  polygone(pts: [number, number][], operateur = 's') {
    const [d, ...suite] = pts
    this.ecrire(`${n(d[0])} ${n(d[1])} m ${suite.map(([x, y]) => `${n(x)} ${n(y)} l`).join(' ')} ${operateur}`)
  }
  /** Texte horizontal, ou vertical (tourné d'un quart de tour) pour une cote verticale. */
  texte(x: number, y: number, t: string, taille = 3, vertical = false) {
    const m = vertical ? `0 1 -1 0 ${n(x)} ${n(y)}` : `1 0 0 1 ${n(x)} ${n(y)}`
    this.ecrire(`BT /F1 ${n(taille)} Tf ${m} Tm ${chaine(t)} Tj ET`)
  }
  /** Largeur approchée d'un texte en Helvetica, pour le centrer. */
  static largeur(t: string, taille: number) { return t.length * taille * 0.52 }
}

/** Dimensions d'une feuille de test et repère du dessin dessus. */
export interface PlanDeTest {
  nom: string
  /** Dénominateur de l'échelle déclarée au cartouche (100 pour 1:100). */
  echelle: number
  largeurPt: number
  hauteurPt: number
  /**
   * Coin bas-gauche du bâtiment sur la feuille, en millimètres depuis le coin
   * bas-gauche de la page : de quoi retrouver la position de chaque sommet.
   */
  origineMm: { x: number; y: number }
  /** Les vraies dimensions, en mètres et en mètres carrés. */
  attendu: Record<string, number>
}

/**
 * Position d'un point du bâtiment, en pixels du canevas de l'éditeur.
 *
 * Le canevas a `largeurCanevas` pixels de large pour toute la largeur de la
 * feuille ; l'axe vertical descend, celui du PDF monte.
 */
export function versCanevas(plan: PlanDeTest, xM: number, yM: number, largeurCanevas = 1600): { x: number; y: number } {
  const mmParM = 1000 / plan.echelle
  const pxParPt = largeurCanevas / plan.largeurPt
  const xPt = (plan.origineMm.x + xM * mmParM) * PT_PAR_MM
  const yPt = (plan.origineMm.y + yM * mmParM) * PT_PAR_MM
  return { x: xPt * pxParPt, y: (plan.hauteurPt - yPt) * pxParPt }
}

// ---------------------------------------------------------------- habillage

/** Cartouche en bas à droite de la feuille, comme sur un plan d'architecte. */
function cartouche(c: Crayon, titre: string, echelle: string, numero = '101') {
  const x = 300, y = 12, l = 108, h = 48
  c.epaisseur(0.35)
  c.gris(0)
  c.rect(x, y, l, h)
  c.trait(x, y + 34, x + l, y + 34)
  c.trait(x, y + 22, x + l, y + 22)
  c.trait(x, y + 11, x + l, y + 11)
  c.trait(x + 60, y, x + 60, y + 22)
  c.texte(x + 3, y + 41, 'Immeuble Les Essais', 4)
  c.texte(x + 3, y + 36.5, 'Chemin du Contrôle 12, 1004 Lausanne', 2.5)
  c.texte(x + 3, y + 26, titre, 4.5)
  c.texte(x + 3, y + 14.5, 'Relevé de l\'existant', 2.8)
  c.texte(x + 63, y + 14.5, `Échelle ${echelle}`, 3.2)
  c.texte(x + 3, y + 3.5, `Plan n° ${numero}`, 2.8)
  c.texte(x + 63, y + 3.5, 'Format A3  16.10.2026', 2.8)
}

/**
 * Cote horizontale entre x1 et x2 (mètres, repère du bâtiment), dessinée à la
 * hauteur `y`, avec ses lignes d'attache depuis `yObjet`.
 *
 * Les lignes d'attache s'arrêtent à 2 mm de l'objet coté, comme le veut
 * l'usage : leurs extrémités tombent tout près des angles du bâtiment, et une
 * aimantation qui prendrait le sommet le plus proche sans réfléchir s'y
 * accrocherait.
 */
function coteH(c: Crayon, mmParM: number, x1: number, x2: number, y: number, yObjet: number, texte: string) {
  const ecart = 2 / mmParM // 2 mm sur la feuille, en mètres du bâtiment
  const deborde = 1.5 / mmParM
  const sens = y < yObjet ? -1 : 1
  c.trait(x1, yObjet + sens * ecart, x1, y + sens * deborde)
  c.trait(x2, yObjet + sens * ecart, x2, y + sens * deborde)
  c.trait(x1 - deborde, y, x2 + deborde, y)
  // Traits obliques aux extrémités, à 45 degrés.
  const t = 1.2 / mmParM
  c.trait(x1 - t, y - t, x1 + t, y + t)
  c.trait(x2 - t, y - t, x2 + t, y + t)
  return { x: (x1 + x2) / 2, y: y + 1 / mmParM, texte }
}

function coteV(c: Crayon, mmParM: number, y1: number, y2: number, x: number, xObjet: number, texte: string) {
  const ecart = 2 / mmParM
  const deborde = 1.5 / mmParM
  const sens = x < xObjet ? -1 : 1
  c.trait(xObjet + sens * ecart, y1, x + sens * deborde, y1)
  c.trait(xObjet + sens * ecart, y2, x + sens * deborde, y2)
  c.trait(x, y1 - deborde, x, y2 + deborde)
  const t = 1.2 / mmParM
  c.trait(x - t, y1 - t, x + t, y1 + t)
  c.trait(x - t, y2 - t, x + t, y2 + t)
  return { x: x - 1 / mmParM, y: (y1 + y2) / 2, texte }
}

/**
 * Pose les textes des cotes hors du repère en mètres : un texte dessiné dans
 * un repère agrandi dix fois y serait illisible.
 */
function textesDeCotes(c: Crayon, plan: PlanDeTest, textes: { x: number; y: number; texte: string; vertical?: boolean }[]) {
  const mm = 1000 / plan.echelle
  for (const t of textes) {
    const x = plan.origineMm.x + t.x * mm
    const y = plan.origineMm.y + t.y * mm
    const l = Crayon.largeur(t.texte, 3)
    if (t.vertical) c.texte(x, y - l / 2, t.texte, 3, true)
    else c.texte(x - l / 2, y, t.texte, 3)
  }
}

// ---------------------------------------------------------------- façade

/** Fenêtres de la façade sud : abscisse gauche et allège, en mètres. */
const FENETRES_FACADE: [number, number][] = [
  // Rez : quatre fenêtres, la porte d'entrée entre la deuxième et la troisième.
  [1.0, 0.9], [3.4, 0.9], [8.0, 0.9], [10.2, 0.9],
  // Premier et deuxième étage : cinq fenêtres chacun.
  [1.0, 3.6], [3.4, 3.6], [5.6, 3.6], [8.0, 3.6], [10.2, 3.6],
  [1.0, 5.9], [3.4, 5.9], [5.6, 5.9], [8.0, 5.9], [10.2, 5.9],
]
const FENETRE = { largeur: 1.2, hauteur: 1.4 }
const PORTE = { x: 5.7, largeur: 1.0, hauteur: 2.2 }
const FACADE = { largeur: 12.4, hauteur: 7.8 }

export const FACADE_SUD: PlanDeTest = {
  nom: 'Façade sud',
  echelle: 100,
  largeurPt: A3_PAYSAGE.largeur,
  hauteurPt: A3_PAYSAGE.hauteur,
  origineMm: { x: 80, y: 90 },
  attendu: {
    largeur: FACADE.largeur,
    hauteur: FACADE.hauteur,
    facadeBrute: FACADE.largeur * FACADE.hauteur, // 96,72 m²
    fenetre: FENETRE.largeur * FENETRE.hauteur, // 1,68 m²
    nombreFenetres: FENETRES_FACADE.length, // 14
    porte: PORTE.largeur * PORTE.hauteur, // 2,20 m²
    ouvertures: FENETRES_FACADE.length * FENETRE.largeur * FENETRE.hauteur + PORTE.largeur * PORTE.hauteur, // 25,72 m²
    facadeNette: FACADE.largeur * FACADE.hauteur
      - FENETRES_FACADE.length * FENETRE.largeur * FENETRE.hauteur - PORTE.largeur * PORTE.hauteur, // 71,00 m²
  },
}

/** Les fenêtres de la façade de test, en mètres : x, y du coin bas-gauche, largeur, hauteur. */
export const OUVERTURES_FACADE = [
  ...FENETRES_FACADE.map(([x, y]) => ({ type: 'fenetre' as const, x, y, largeur: FENETRE.largeur, hauteur: FENETRE.hauteur })),
  { type: 'porte' as const, x: PORTE.x, y: 0, largeur: PORTE.largeur, hauteur: PORTE.hauteur },
]

function dessinerFacade(numero?: string): PageDessinee {
  const plan = FACADE_SUD
  const c = new Crayon()
  // Repère de la feuille en millimètres.
  c.ecrire('q', `${n(PT_PAR_MM)} 0 0 ${n(PT_PAR_MM)} 0 0 cm`, '1 J 1 j')
  c.texte(plan.origineMm.x, 275, 'FAÇADE SUD', 7)
  c.texte(plan.origineMm.x, 268, 'Élévation, état existant', 3.5)

  // Repère du bâtiment : un mètre réel vaut dix millimètres au 1:100.
  const mm = 1000 / plan.echelle
  c.ecrire('q', `${n(mm)} 0 0 ${n(mm)} ${n(plan.origineMm.x)} ${n(plan.origineMm.y)} cm`)
  const m = (mmFeuille: number) => mmFeuille / mm // épaisseurs de trait, en mètres

  // Terrain : un trait épais qui déborde largement de la façade.
  c.epaisseur(m(0.7))
  c.trait(-2.5, 0, FACADE.largeur + 2.5, 0)
  // Contour de la façade.
  c.epaisseur(m(0.5))
  c.polygone([[0, 0], [FACADE.largeur, 0], [FACADE.largeur, FACADE.hauteur], [0, FACADE.hauteur]])
  // Bande d'acrotère et nez de dalles : des traits fins, parallèles aux bords.
  c.epaisseur(m(0.25))
  c.trait(0, 7.5, FACADE.largeur, 7.5)
  c.gris(0.45)
  c.epaisseur(m(0.13))
  c.trait(0, 2.7, FACADE.largeur, 2.7)
  c.trait(0, 5.4, FACADE.largeur, 5.4)
  c.gris(0)

  // Fenêtres : cadre, vitrage six centimètres en retrait, tablette débordante.
  for (const [x, y] of FENETRES_FACADE) {
    c.epaisseur(m(0.35))
    c.rect(x, y, FENETRE.largeur, FENETRE.hauteur)
    c.epaisseur(m(0.13))
    c.rect(x + 0.06, y + 0.06, FENETRE.largeur - 0.12, FENETRE.hauteur - 0.12)
    c.trait(x + FENETRE.largeur / 2, y + 0.06, x + FENETRE.largeur / 2, y + FENETRE.hauteur - 0.06)
    c.epaisseur(m(0.25))
    c.trait(x - 0.05, y, x + FENETRE.largeur + 0.05, y)
  }
  // Porte d'entrée : cadre et vantail.
  c.epaisseur(m(0.35))
  c.rect(PORTE.x, 0, PORTE.largeur, PORTE.hauteur)
  c.epaisseur(m(0.13))
  c.rect(PORTE.x + 0.06, 0, PORTE.largeur - 0.12, PORTE.hauteur - 0.06)

  // Cotes : chaîne des ouvertures et cote totale sous la façade, niveaux à gauche.
  c.epaisseur(m(0.13))
  const textes: { x: number; y: number; texte: string; vertical?: boolean }[] = []
  const chaine = [0, 1.0, 2.2, 3.4, 4.6, 5.7, 6.7, 8.0, 9.2, 10.2, 11.4, 12.4]
  for (let i = 0; i < chaine.length - 1; i++) {
    const a = chaine[i], b = chaine[i + 1]
    textes.push(coteH(c, mm, a, b, -0.8, 0, (b - a).toFixed(2)))
  }
  textes.push(coteH(c, mm, 0, FACADE.largeur, -1.6, 0, '12.40'))
  for (const [a, b] of [[0, 2.7], [2.7, 5.4], [5.4, 7.8]]) {
    textes.push({ ...coteV(c, mm, a, b, -0.9, 0, (b - a).toFixed(2)), vertical: true })
  }
  textes.push({ ...coteV(c, mm, 0, FACADE.hauteur, -1.7, 0, '7.80'), vertical: true })
  c.ecrire('Q')

  textesDeCotes(c, plan, textes)
  // Niveaux à droite de la façade.
  for (const [y, t] of [[0, '±0.00'], [2.7, '+2.70'], [5.4, '+5.40'], [7.8, '+7.80']] as const) {
    const p = { x: plan.origineMm.x + (FACADE.largeur + 0.6) * mm, y: plan.origineMm.y + y * mm - 1 }
    c.texte(p.x, p.y, t, 3)
  }
  cartouche(c, 'Façade sud', '1:100', numero)
  c.ecrire('Q')
  return { largeur: plan.largeurPt, hauteur: plan.hauteurPt, contenu: c.ops.join('\n') }
}

// ---------------------------------------------------------------- plan d'étage

/** Contour extérieur du rez : un L, 12,40 × 9,20 m moins une encoche de 4,00 × 3,00 m. */
export const CONTOUR_REZ: [number, number][] = [
  [0, 0], [12.4, 0], [12.4, 6.2], [8.4, 6.2], [8.4, 9.2], [0, 9.2],
]
const MUR = 0.3

export const PLAN_REZ: PlanDeTest = {
  nom: 'Plan du rez-de-chaussée',
  echelle: 50,
  largeurPt: A3_PAYSAGE.largeur,
  hauteurPt: A3_PAYSAGE.hauteur,
  origineMm: { x: 42, y: 68 },
  attendu: {
    emprise: 12.4 * 9.2 - 4 * 3, // 102,08 m²
    perimetre: 2 * (12.4 + 9.2), // 43,20 m
    // Surface intérieure brute, au nu intérieur des murs de façade.
    interieur: (12.4 - 2 * MUR) * (9.2 - 2 * MUR) - 4 * 3, // 89,48 m²
  },
}

function dessinerRez(numero?: string): PageDessinee {
  const plan = PLAN_REZ
  const c = new Crayon()
  c.ecrire('q', `${n(PT_PAR_MM)} 0 0 ${n(PT_PAR_MM)} 0 0 cm`, '1 J 1 j')
  c.texte(250, 282, 'PLAN DU REZ-DE-CHAUSSÉE', 6)
  c.texte(250, 276, 'État existant', 3.5)

  const mm = 1000 / plan.echelle
  c.ecrire('q', `${n(mm)} 0 0 ${n(mm)} ${n(plan.origineMm.x)} ${n(plan.origineMm.y)} cm`)
  const m = (mmFeuille: number) => mmFeuille / mm

  const interieur: [number, number][] = [
    [MUR, MUR], [12.4 - MUR, MUR], [12.4 - MUR, 6.2 - MUR], [8.4 - MUR, 6.2 - MUR], [8.4 - MUR, 9.2 - MUR], [MUR, 9.2 - MUR],
  ]
  // Murs en aplat gris : les deux contours dans un même tracé, remplissage pair-impair.
  const chemin = (pts: [number, number][]) => `${pts.map(([x, y], i) => `${n(x)} ${n(y)} ${i ? 'l' : 'm'}`).join(' ')} h`
  c.ecrire('0.75 g', `${chemin(CONTOUR_REZ)} ${chemin(interieur)} f*`, '0 g')

  // Contour extérieur, interrompu aux fenêtres comme sur un vrai plan.
  c.epaisseur(m(0.5))
  // Façade sud (y = 0) : deux fenêtres, de 1,50 à 3,00 et de 6,00 à 7,50.
  c.ecrire(`0 9.2 m 0 0 l 1.5 0 l S`)
  c.trait(3.0, 0, 6.0, 0)
  c.ecrire(`7.5 0 m 12.4 0 l 12.4 6.2 l 8.4 6.2 l 8.4 9.2 l 0 9.2 l S`)
  c.polygone(interieur)
  // Fenêtres en plan : deux traits de cadre et le vitrage au milieu.
  c.epaisseur(m(0.18))
  for (const [a, b] of [[1.5, 3.0], [6.0, 7.5]]) {
    c.trait(a, 0, a, MUR)
    c.trait(b, 0, b, MUR)
    c.trait(a, MUR / 2, b, MUR / 2)
    c.trait(a, MUR, b, MUR)
  }

  // Cloisons de 12 cm : une verticale à x = 5,00, une horizontale à y = 4,50.
  c.epaisseur(m(0.25))
  c.ecrire(`5 ${n(MUR)} m 5 3 l S`, `5.12 ${n(MUR)} m 5.12 3 l S`)
  c.ecrire(`5 3.9 m 5 ${n(9.2 - MUR)} l S`, `5.12 3.9 m 5.12 ${n(9.2 - MUR)} l S`)
  c.trait(5.12, 4.5, 8.0, 4.5)
  c.trait(5.12, 4.62, 8.0, 4.62)
  c.trait(8.9, 4.5, 12.4 - MUR, 4.5)
  c.trait(8.9, 4.62, 12.4 - MUR, 4.62)
  // Battue de porte : un quart de cercle en courbe de Bézier.
  c.epaisseur(m(0.13))
  const r = 0.9, k = 0.5523 * r
  c.ecrire(`5.12 3 m 5.12 ${n(3 + k)} ${n(5.12 + r - k)} 3.9 ${n(5.12 + r)} 3.9 c S`)
  c.trait(5.12, 3, 5.12 + r, 3)

  // Cotes extérieures.
  const textes: { x: number; y: number; texte: string; vertical?: boolean }[] = []
  c.epaisseur(m(0.13))
  textes.push(coteH(c, mm, 0, 12.4, -1.4, 0, '12.40'))
  textes.push(coteH(c, mm, 0, 8.4, 10.4, 9.2, '8.40'))
  textes.push(coteH(c, mm, 8.4, 12.4, 9.9, 6.2, '4.00'))
  textes.push({ ...coteV(c, mm, 0, 9.2, -1.4, 0, '9.20'), vertical: true })
  textes.push({ ...coteV(c, mm, 0, 6.2, 13.6, 12.4, '6.20'), vertical: true })
  textes.push({ ...coteV(c, mm, 6.2, 9.2, 9.6, 8.4, '3.00'), vertical: true })
  c.ecrire('Q')

  textesDeCotes(c, plan, textes)
  // Noms des pièces.
  const piece = (x: number, y: number, t: string) => c.texte(plan.origineMm.x + x * mm, plan.origineMm.y + y * mm, t, 3.2)
  piece(1.6, 5.5, 'Séjour')
  piece(6.2, 2.0, 'Cuisine')
  piece(9.4, 2.0, 'Chambre')
  piece(5.8, 6.8, 'Bureau')
  cartouche(c, 'Plan du rez-de-chaussée', '1:50', numero)
  c.ecrire('Q')
  return { largeur: plan.largeurPt, hauteur: plan.hauteurPt, contenu: c.ops.join('\n') }
}

/** La façade seule, sur une feuille A3 au 1:100. */
export function pdfFacade(): Uint8Array {
  return assemblerPdf([dessinerFacade()])
}

/** Le plan du rez seul, sur une feuille A3 au 1:50. */
export function pdfPlanRez(): Uint8Array {
  return assemblerPdf([dessinerRez()])
}

/** Les deux feuilles dans un même document, chacune à son échelle. */
export function pdfJeuDePlans(): Uint8Array {
  return assemblerPdf([dessinerFacade(), dessinerRez()])
}

// ---------------------------------------------------------------- étage type

/**
 * Le plan d'étage type d'un petit immeuble : une cage d'escalier au milieu,
 * un logement de part et d'autre du palier, et un titre qui dit que la
 * feuille vaut pour trois étages.
 *
 * C'est le plan sur lequel l'IA doit compter : les portes y sont dessinées à
 * la manière d'un architecte, une ouverture dans le mur, le vantail et son
 * arc d'ouverture en quart de cercle ; les fenêtres, une interruption du mur
 * de façade avec son cadre et son vitrage. Les pièges sont ceux d'un vrai
 * plan : une porte palière ressemble à une porte de chambre, seul son mur
 * (celui de la cage) la distingue, et la feuille ne montre qu'un étage alors
 * que le bâtiment en compte trois pareils.
 *
 * Les logements sont en miroir l'un de l'autre, autour de l'axe x = 10 m.
 */
const ETAGE = { largeur: 20, profondeur: 11, mur: 0.3, cloison: 0.12, murCage: 0.25 }
/** La cage d'escalier, entre ses deux murs : x de 8,50 à 11,50 m. */
const CAGE = { gauche: 8.5, droite: 11.5 }
/** Portes palières, dans les murs de la cage : y de 1,60 à 2,50 m. */
const PALIERE = { y1: 1.6, y2: 2.5 }
/** Portes intérieures du logement de gauche, dans la cloison y = 6,00 m : chambre, bain, chambre. */
const PORTES_CLOISON: [number, number][] = [[2.0, 2.8], [4.2, 4.9], [6.5, 7.3]]
/** Fenêtres du logement de gauche : sur la façade sud (y = 0), nord (y = 11) et ouest (x = 0). */
const FENETRES_SUD: [number, number][] = [[1.5, 3.0], [5.0, 6.5]]
const FENETRES_NORD: [number, number][] = [[1.2, 2.4], [4.1, 4.9], [6.4, 7.6]]
const FENETRE_OUEST: [number, number] = [2.0, 3.4]

/** Le symétrique d'une abscisse du logement de gauche, dans celui de droite. */
const miroir = (x: number) => ETAGE.largeur - x

export const PLAN_ETAGE_TYPE: PlanDeTest = {
  nom: 'Étage type (1er au 3e)',
  echelle: 100,
  largeurPt: A3_PAYSAGE.largeur,
  hauteurPt: A3_PAYSAGE.hauteur,
  origineMm: { x: 70, y: 105 },
  attendu: {
    etagesRepresentes: 3,
    logementsParEtage: 2,
    portesPalieresParEtage: 2,
    portesPalieres: 6,
    portesInterieuresParEtage: 2 * PORTES_CLOISON.length,
    portesInterieures: 3 * 2 * PORTES_CLOISON.length, // 18
    fenetresParEtage: 2 * (FENETRES_SUD.length + FENETRES_NORD.length + 1),
    fenetres: 3 * 2 * (FENETRES_SUD.length + FENETRES_NORD.length + 1), // 36
    cuisines: 3 * 2, // 6
    // Baignoire, lavabo et WC dans chaque salle de bain.
    appareilsSanitaires: 3 * 2 * 3, // 18
  },
}

/** Les portes de l'étage type, en mètres : le milieu de l'ouverture, là où un repère doit tomber. */
export const PORTES_ETAGE_TYPE: { categorie: 'porte_paliere' | 'porte_interieure'; x: number; y: number }[] = [
  { categorie: 'porte_paliere', x: CAGE.gauche + ETAGE.murCage / 2, y: (PALIERE.y1 + PALIERE.y2) / 2 },
  { categorie: 'porte_paliere', x: CAGE.droite - ETAGE.murCage / 2, y: (PALIERE.y1 + PALIERE.y2) / 2 },
  ...PORTES_CLOISON.flatMap(([a, b]) => [
    { categorie: 'porte_interieure' as const, x: (a + b) / 2, y: 6 + ETAGE.cloison / 2 },
    { categorie: 'porte_interieure' as const, x: miroir((a + b) / 2), y: 6 + ETAGE.cloison / 2 },
  ]),
]

/**
 * Un quart de cercle en courbe de Bézier, du point d'angle a0 au point
 * d'angle a1 (en degrés), autour du centre (cx, cy).
 */
function quartDeCercle(c: Crayon, cx: number, cy: number, r: number, a0: number, a1: number) {
  const rad = (a: number) => (a * Math.PI) / 180
  const sens = Math.sign(a1 - a0)
  const k = 0.5523 * r
  const p0 = [cx + r * Math.cos(rad(a0)), cy + r * Math.sin(rad(a0))]
  const p3 = [cx + r * Math.cos(rad(a1)), cy + r * Math.sin(rad(a1))]
  const p1 = [p0[0] - sens * k * Math.sin(rad(a0)), p0[1] + sens * k * Math.cos(rad(a0))]
  const p2 = [p3[0] + sens * k * Math.sin(rad(a1)), p3[1] - sens * k * Math.cos(rad(a1))]
  c.ecrire(`${n(p0[0])} ${n(p0[1])} m ${n(p1[0])} ${n(p1[1])} ${n(p2[0])} ${n(p2[1])} ${n(p3[0])} ${n(p3[1])} c S`)
}

/**
 * Une porte : le vantail ouvert à angle droit depuis sa charnière, et l'arc
 * que décrit son bord. `angleMur` est la direction du mur vers l'autre
 * montant, `angleVantail` celle du vantail ouvert, en degrés.
 */
function porte(c: Crayon, hx: number, hy: number, largeur: number, angleMur: number, angleVantail: number) {
  const rad = (a: number) => (a * Math.PI) / 180
  c.trait(hx, hy, hx + largeur * Math.cos(rad(angleVantail)), hy + largeur * Math.sin(rad(angleVantail)))
  quartDeCercle(c, hx, hy, largeur, angleVantail, angleMur)
}

/** Une fenêtre en plan dans un mur horizontal : les deux montants, le vitrage au milieu, le nu intérieur. */
function fenetreH(c: Crayon, a: number, b: number, y0: number, ep: number) {
  c.trait(a, y0, a, y0 + ep)
  c.trait(b, y0, b, y0 + ep)
  c.trait(a, y0 + ep / 2, b, y0 + ep / 2)
  c.trait(a, y0 + ep * 0.62, b, y0 + ep * 0.62)
}
function fenetreV(c: Crayon, a: number, b: number, x0: number, ep: number) {
  c.trait(x0, a, x0 + ep, a)
  c.trait(x0, b, x0 + ep, b)
  c.trait(x0 + ep / 2, a, x0 + ep / 2, b)
  c.trait(x0 + ep * 0.62, a, x0 + ep * 0.62, b)
}

/** Les morceaux pleins d'un segment [debut, fin] interrompu par des ouvertures. */
function pleins(debut: number, fin: number, ouvertures: [number, number][]): [number, number][] {
  const tri = [...ouvertures].sort((u, v) => u[0] - v[0])
  const r: [number, number][] = []
  let x = debut
  for (const [a, b] of tri) { if (a > x) r.push([x, a]); x = Math.max(x, b) }
  if (fin > x) r.push([x, fin])
  return r
}

function dessinerEtageType(numero?: string): PageDessinee {
  const plan = PLAN_ETAGE_TYPE
  const { largeur: L, profondeur: P, mur: M, cloison: K, murCage: MC } = ETAGE
  const c = new Crayon()
  c.ecrire('q', `${n(PT_PAR_MM)} 0 0 ${n(PT_PAR_MM)} 0 0 cm`, '1 J 1 j')
  c.texte(plan.origineMm.x, 275, 'ÉTAGE TYPE (1ER AU 3E)', 7)
  c.texte(plan.origineMm.x, 268, 'Plan des 1er, 2e et 3e étages, identiques. État existant.', 3.5)

  const mm = 1000 / plan.echelle
  c.ecrire('q', `${n(mm)} 0 0 ${n(mm)} ${n(plan.origineMm.x)} ${n(plan.origineMm.y)} cm`)
  const m = (mmFeuille: number) => mmFeuille / mm

  // Les ouvertures de chaque façade, logement de droite compris (en miroir).
  const sud = [...FENETRES_SUD, ...FENETRES_SUD.map(([a, b]) => [miroir(b), miroir(a)] as [number, number])]
  const nord = [...FENETRES_NORD, ...FENETRES_NORD.map(([a, b]) => [miroir(b), miroir(a)] as [number, number])]
  const cloison = [...PORTES_CLOISON, ...PORTES_CLOISON.map(([a, b]) => [miroir(b), miroir(a)] as [number, number])]

  // Murs en aplat gris : façades, murs de la cage, cloisons, interrompus aux ouvertures.
  const pave = (x: number, y: number, l: number, h: number) => c.ecrire(`${n(x)} ${n(y)} ${n(l)} ${n(h)} re f`)
  c.ecrire('0.55 g')
  for (const [a, b] of pleins(0, L, sud)) pave(a, 0, b - a, M)
  for (const [a, b] of pleins(0, L, nord)) pave(a, P - M, b - a, M)
  for (const [a, b] of pleins(M, P - M, [FENETRE_OUEST])) { pave(0, a, M, b - a); pave(L - M, a, M, b - a) }
  for (const [a, b] of pleins(M, P - M, [[PALIERE.y1, PALIERE.y2]])) {
    pave(CAGE.gauche, a, MC, b - a)
    pave(CAGE.droite - MC, a, MC, b - a)
  }
  c.ecrire('0.75 g')
  for (const [a, b] of pleins(M, CAGE.gauche, cloison.filter(([x]) => x < 10))) pave(a, 6, b - a, K)
  for (const [a, b] of pleins(CAGE.droite, L - M, cloison.filter(([x]) => x > 10))) pave(a, 6, b - a, K)
  for (const x of [3.5, 5.5]) { pave(x, 6 + K, K, P - M - 6 - K); pave(miroir(x) - K, 6 + K, K, P - M - 6 - K) }
  c.ecrire('0 g')

  // Contour extérieur, d'un trait fort.
  c.epaisseur(m(0.5))
  c.rect(0, 0, L, P)

  // Fenêtres en plan.
  c.epaisseur(m(0.18))
  for (const [a, b] of sud) fenetreH(c, a, b, 0, M)
  for (const [a, b] of nord) fenetreH(c, a, b, P - M, M)
  fenetreV(c, FENETRE_OUEST[0], FENETRE_OUEST[1], 0, M)
  fenetreV(c, FENETRE_OUEST[0], FENETRE_OUEST[1], L - M, M)

  // Portes : vantail et arc d'ouverture. Les portes palières s'ouvrent vers
  // le logement, les portes des pièces vers la pièce.
  c.epaisseur(m(0.13))
  const lp = PALIERE.y2 - PALIERE.y1
  porte(c, CAGE.gauche, PALIERE.y1, lp, 90, 180)
  porte(c, CAGE.droite, PALIERE.y1, lp, 90, 0)
  for (const [a, b] of PORTES_CLOISON) {
    porte(c, a, 6 + K, b - a, 0, 90)
    porte(c, miroir(a), 6 + K, b - a, 180, 90)
  }

  // Escalier : deux volées et leurs marches, dans la moitié nord de la cage.
  c.epaisseur(m(0.13))
  const xg = CAGE.gauche + MC, xd = CAGE.droite - MC, xm = (xg + xd) / 2
  c.trait(xm, 4.2, xm, P - M - 0.3)
  for (let y = 4.2; y <= P - M - 0.3 + 1e-9; y += 0.28) c.trait(xg, y, xd, y)
  c.trait(xg + 0.3, 4.6, xg + 0.3, 9.6)
  c.trait(xg + 0.3, 9.6, xg + 0.15, 9.35)
  c.trait(xg + 0.3, 9.6, xg + 0.45, 9.35)

  // Cuisines : un plan de travail contre le mur de la cage, avec son évier.
  for (const sens of [1, -1]) {
    const x = sens === 1 ? CAGE.gauche - 0.6 : CAGE.droite
    c.rect(x, 3.0, 0.6, 2.6)
    c.rect(x + 0.1, 4.0, 0.4, 0.5)
  }

  // Salles de bain : baignoire, lavabo, WC, entre les cloisons x = 3,50 et 5,50.
  for (const sens of [1, -1]) {
    const x = (v: number) => (sens === 1 ? v : miroir(v))
    const r = (x0: number, y0: number, l: number, h: number) => c.rect(Math.min(x(x0), x(x0 + l)), y0, l, h)
    r(3.7, 9.85, 1.7, 0.75)
    r(3.85, 9.95, 1.4, 0.55)
    r(5.0, 7.2, 0.45, 0.6)
    r(5.08, 7.35, 0.28, 0.3)
    r(3.7, 7.4, 0.4, 0.2)
    r(3.75, 7.6, 0.3, 0.55)
  }

  // Cotes extérieures.
  const textes: { x: number; y: number; texte: string; vertical?: boolean }[] = []
  c.epaisseur(m(0.13))
  textes.push(coteH(c, mm, 0, L, -1.2, 0, '20.00'))
  textes.push(coteH(c, mm, 0, CAGE.gauche, -0.6, 0, '8.50'))
  textes.push(coteH(c, mm, CAGE.gauche, CAGE.droite, -0.6, 0, '3.00'))
  textes.push(coteH(c, mm, CAGE.droite, L, -0.6, 0, '8.50'))
  textes.push({ ...coteV(c, mm, 0, P, -1.2, 0, '11.00'), vertical: true })
  c.ecrire('Q')

  textesDeCotes(c, plan, textes)
  const piece = (x: number, y: number, t: string, taille = 3.2) =>
    c.texte(plan.origineMm.x + x * mm, plan.origineMm.y + y * mm, t, taille)
  for (const [nom, x0] of [['Logement A', 0], ['Logement B', 11.5]] as const) {
    piece(x0 + 2.2, 4.4, nom, 3.6)
    piece(x0 + 2.4, 3.3, 'Séjour')
    piece(x0 + (x0 === 0 ? 6.4 : 0.9), 5.0, 'Cuisine', 2.6)
    piece(x0 + (x0 === 0 ? 0.7 : 5.3), 8.5, 'Chambre')
    piece(x0 + (x0 === 0 ? 3.75 : 3.3), 8.7, 'Bain', 2.6)
    piece(x0 + (x0 === 0 ? 6.0 : 0.6), 8.5, 'Chambre')
  }
  piece(8.85, 2.9, 'Palier', 2.8)
  piece(8.75, 4.0, "Cage d'escalier", 2.4)
  cartouche(c, 'Étage type (1er au 3e)', '1:100', numero)
  c.ecrire('Q')
  return { largeur: plan.largeurPt, hauteur: plan.hauteurPt, contenu: c.ops.join('\n') }
}

/** Le plan d'étage type seul, sur une feuille A3 au 1:100. */
export function pdfEtageType(): Uint8Array {
  return assemblerPdf([dessinerEtageType()])
}

/**
 * Un jeu complet pour l'outil Métrés : le rez (feuille 101, au 1:50), l'étage
 * type du 1er au 3e (feuille 102) et la façade sud (feuille 201), chacune
 * avec son numéro au cartouche. De quoi vérifier que l'analyse lit le numéro
 * de chaque feuille, son niveau, les étages identiques qu'elle représente et
 * les pièces nommées sur les plans d'étage.
 */
export function pdfJeuMetres(): Uint8Array {
  return assemblerPdf([dessinerRez('101'), dessinerEtageType('102'), dessinerFacade('201')])
}

/**
 * La géométrie d'une page de test, lue par pdf.js comme le fait l'éditeur :
 * la liste d'opérateurs réelle, la vue au canevas de 1600 px. Chargé à la
 * demande, dans l'édition de pdf.js prévue pour Node : seuls les tests et le
 * script d'essai s'en servent.
 */
export async function geometrieDePdf(octets: Uint8Array, numeroPage = 1, largeurCanevas = 1600) {
  const { extraireSegments, IndexGeometrie } = await import('./geometrie-vectorielle')
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const pdf = await pdfjs.getDocument({ data: octets.slice(), isEvalSupported: false, verbosity: 0 }).promise
  const page = await pdf.getPage(numeroPage)
  const base = page.getViewport({ scale: 1 })
  const vue = page.getViewport({ scale: largeurCanevas / base.width })
  const liste = await page.getOperatorList()
  const geo = extraireSegments(liste, pdfjs.OPS as unknown as import('./geometrie-vectorielle').OpsPdf, vue.transform)
  return {
    geo,
    index: new IndexGeometrie(geo),
    largeurPt: base.width,
    hauteurPt: base.height,
    largeurCanevas: vue.width,
    hauteurCanevas: vue.height,
  }
}
