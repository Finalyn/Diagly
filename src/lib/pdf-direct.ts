import { domToCanvas } from 'modern-screenshot'
import { jsPDF } from 'jspdf'
import { saveBlob } from '@/lib/api'

/**
 * Le PDF tiré directement de ce que l'écran montre, sans passer par
 * l'impression du navigateur.
 *
 * L'impression recalculait la mise en page pour le papier : des textes se
 * chevauchaient, et une page blanche venait après chaque page. Ici, chaque
 * page affichée (une feuille A4 d'un rapport, une diapositive 16:9) est
 * photographiée telle quelle, à près de deux fois sa taille pour rester nette, puis
 * posée sur une page du PDF aux mêmes proportions. Ce qu'on voit est ce
 * qu'on reçoit. Le texte du PDF n'est pas sélectionnable : c'est le prix de
 * cette fidélité.
 *
 * Un document d'un seul tenant (le rapport partagé) est découpé en pages A4,
 * et les coupes tombent entre deux paragraphes, deux lignes de tableau ou
 * deux photos plutôt qu'au milieu d'une ligne.
 *
 * Sur le web seulement : dans l'app iPhone et iPad, un téléchargement ne
 * mène nulle part, le PDF y passe par le plugin natif (impression.ts).
 */

/** Une feuille A4 à 96 points par pouce, et une diapositive : leur taille d'affichage. */
const FORMATS = {
  a4: { largeurPx: 794, hauteurPx: 1123, page: { orientation: 'portrait' as const, unit: 'mm' as const, format: 'a4' as const }, l: 210, h: 297 },
  diapo: { largeurPx: 1280, hauteurPx: 720, page: { orientation: 'landscape' as const, unit: 'pt' as const, format: [960, 540] as [number, number] }, l: 960, h: 540 },
}

const ECHELLE = 1.8
const QUALITE = 0.85

export type Progres = (faites: number, total: number) => void

/** Une page affichée, photographiée à sa taille réelle : sans le zoom de l'écran ni l'ombre de la feuille. */
async function photographier(page: HTMLElement, largeur: number, hauteur: number): Promise<HTMLCanvasElement> {
  return domToCanvas(page, {
    width: largeur,
    height: hauteur,
    scale: ECHELLE,
    backgroundColor: '#ffffff',
    style: { zoom: '1', margin: '0', boxShadow: 'none', transform: 'none' },
    timeout: 15_000,
  })
}

/**
 * À l'écran, les feuilles et les diapositives sont réduites à la largeur de
 * leur colonne (la propriété CSS `zoom`, posée sur elles ou sur un parent).
 * Photographiées ainsi, leurs textes se recalculent mal : des lignes se
 * chevauchent, un « 6 / 25 » passe à la ligne. Le temps du PDF, le zoom est
 * remis à 1 sur la page et ses parents, puis rétabli. Un voile couvre l'écran
 * pendant ce temps, avec l'avancement : la page agrandie ne se voit pas.
 */
function sansZoom(pages: HTMLElement[]): () => void {
  const touches = new Map<HTMLElement, string>()
  for (const page of pages) {
    for (let el: HTMLElement | null = page; el && el !== document.body; el = el.parentElement) {
      if (touches.has(el)) continue
      const zoom = getComputedStyle(el).zoom
      if (zoom && zoom !== '1' && zoom !== 'normal') {
        touches.set(el, el.style.zoom)
        el.style.zoom = '1'
      }
    }
  }
  return () => { for (const [el, avant] of touches) el.style.zoom = avant }
}

function voile(): { texte: (t: string) => void; retirer: () => void } {
  const v = document.createElement('div')
  v.setAttribute('role', 'status')
  v.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.96);font:600 16px/1.4 system-ui,sans-serif;color:#0b1220'
  v.textContent = 'Préparation du PDF…'
  document.body.appendChild(v)
  return { texte: (t) => { v.textContent = t }, retirer: () => v.remove() }
}

/** Des pages déjà découpées (feuilles A4 d'un rapport, diapositives) : une page de PDF chacune. */
export async function pdfDesPages(pages: HTMLElement[], options: { nom: string; format: keyof typeof FORMATS; onProgres?: Progres }): Promise<void> {
  if (!pages.length) return
  const f = FORMATS[options.format]
  const doc = new jsPDF(f.page)
  const v = voile()
  const retablir = sansZoom(pages)
  try {
    for (const [i, page] of pages.entries()) {
      const canvas = await photographier(page, f.largeurPx, f.hauteurPx)
      if (i > 0) doc.addPage(f.page.format, f.page.orientation)
      doc.addImage(canvas.toDataURL('image/jpeg', QUALITE), 'JPEG', 0, 0, f.l, f.h, undefined, 'FAST')
      options.onProgres?.(i + 1, pages.length)
      v.texte(`Préparation du PDF… ${i + 1} / ${pages.length}`)
    }
  } finally {
    retablir()
    v.retirer()
  }
  saveBlob(doc.output('blob'), nomDeFichier(options.nom))
}

/** Les éléments entre lesquels une page peut se couper sans trancher une ligne. */
const BLOCS = 'p, h1, h2, h3, h4, li, tr, img, figure, table, section, header, footer, hr, [data-saut-page]'

/**
 * Un document d'un seul tenant, découpé en pages A4 : il est photographié en
 * entier, puis tranché aux bas de ses paragraphes, lignes et photos, avec une
 * marge en haut et en bas de chaque page.
 */
export async function pdfDUnDocument(document_: HTMLElement, options: { nom: string; onProgres?: Progres }): Promise<void> {
  const largeur = document_.offsetWidth
  const hauteur = document_.scrollHeight
  const canvas = await domToCanvas(document_, { width: largeur, height: hauteur, scale: ECHELLE, backgroundColor: '#ffffff', timeout: 30_000 })

  const marge = Math.round(largeur * (12 / 210))
  const utile = Math.round(largeur * (297 / 210)) - 2 * marge
  // Les bas de blocs, en pixels depuis le haut du document : les coupes possibles.
  const haut = document_.getBoundingClientRect().top
  const bas = [...document_.querySelectorAll<HTMLElement>(BLOCS)]
    .map((el) => Math.round(el.getBoundingClientRect().bottom - haut))
    .filter((y) => y > 0 && y < hauteur)
    .sort((a, b) => a - b)

  const coupes: [number, number][] = []
  let debut = 0
  while (debut < hauteur - 2) {
    let fin = Math.min(debut + utile, hauteur)
    if (fin < hauteur) {
      // Le dernier bas de bloc qui tient dans la page, s'il en remplit au moins la moitié.
      const possible = bas.filter((y) => y > debut + utile * 0.5 && y <= fin).pop()
      if (possible) fin = possible
    }
    coupes.push([debut, fin])
    debut = fin
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const mmParPx = 210 / largeur
  for (const [i, [de, a]] of coupes.entries()) {
    const tranche = window.document.createElement('canvas')
    tranche.width = largeur * ECHELLE
    tranche.height = (a - de) * ECHELLE
    const ctx = tranche.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, tranche.width, tranche.height)
    ctx.drawImage(canvas, 0, de * ECHELLE, tranche.width, tranche.height, 0, 0, tranche.width, tranche.height)
    if (i > 0) doc.addPage('a4', 'portrait')
    doc.addImage(tranche.toDataURL('image/jpeg', QUALITE), 'JPEG', 0, marge * mmParPx, 210, (a - de) * mmParPx, undefined, 'FAST')
    options.onProgres?.(i + 1, coupes.length)
  }
  saveBlob(doc.output('blob'), nomDeFichier(options.nom))
}

/** Un nom de fichier sûr : sans les caractères que les systèmes refusent. */
function nomDeFichier(nom: string): string {
  const propre = nom.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Diagly'
  return propre.toLowerCase().endsWith('.pdf') ? propre : `${propre}.pdf`
}
