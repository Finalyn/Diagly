/**
 * Écriture d'un classeur Excel, sans dépendance.
 *
 * Un fichier .xlsx est une archive ZIP de documents XML. On en a déjà une, dans
 * zip.ts : il ne reste qu'à écrire les quatre documents qu'Excel attend, plus
 * une feuille par onglet.
 *
 * Les textes sont écrits en clair dans les cellules (« inline strings ») plutôt
 * que dans la table partagée que produisent la plupart des bibliothèques. C'est
 * un peu plus volumineux et beaucoup plus simple : pas d'index à tenir, donc
 * pas d'index à désynchroniser, et le fichier reste lisible tel quel.
 *
 * Ce qu'on n'écrit pas, délibérément : ni style, ni formule, ni format de
 * nombre. Ce classeur sert à relire et à corriger des données, pas à les mettre
 * en page, et la seule mise en forme qui compte, la première ligne figée, tient
 * en une balise.
 */

import { creerZip, type FichierZip } from './zip'

export interface FeuilleXlsx {
  /** Nom de l'onglet. Excel refuse plus de 31 caractères et quelques signes. */
  nom: string
  entetes: readonly string[]
  /** Les lignes, indexées par en-tête. Une case absente reste vide. */
  lignes: Record<string, string | number | null | undefined>[]
}

const encodeur = new TextEncoder()
const octets = (texte: string) => encodeur.encode(texte)

/** Échappe ce qui ne peut pas entrer tel quel dans du XML. */
export function echapperXml(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // Les caractères de contrôle sont interdits en XML 1.0 et font refuser le
    // fichier en entier par Excel. Une tabulation collée dans une note ne doit
    // pas rendre un classeur illisible.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
}

/** Nom d'onglet accepté par Excel : 31 caractères, sans : \ / ? * [ ] */
export function nomDOnglet(brut: string): string {
  return brut.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31).trim() || 'Feuille'
}

/** Référence d'une colonne : 1 donne A, 27 donne AA. */
export function colonneExcel(index: number): string {
  let n = index
  let nom = ''
  while (n > 0) {
    const reste = (n - 1) % 26
    nom = String.fromCharCode(65 + reste) + nom
    n = Math.floor((n - 1) / 26)
  }
  return nom
}

function cellule(reference: string, valeur: string | number | null | undefined): string {
  if (valeur === null || valeur === undefined || valeur === '') return ''
  if (typeof valeur === 'number' && Number.isFinite(valeur)) {
    return `<c r="${reference}"><v>${valeur}</v></c>`
  }
  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${echapperXml(String(valeur))}</t></is></c>`
}

function feuilleXml(feuille: FeuilleXlsx): string {
  const lignes: string[] = []

  const entete = feuille.entetes
    .map((e, i) => cellule(`${colonneExcel(i + 1)}1`, e))
    .join('')
  lignes.push(`<row r="1">${entete}</row>`)

  feuille.lignes.forEach((l, rang) => {
    const r = rang + 2
    const cases = feuille.entetes
      .map((e, i) => cellule(`${colonneExcel(i + 1)}${r}`, l[e]))
      .join('')
    lignes.push(`<row r="${r}">${cases}</row>`)
  })

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
    + '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    + `<sheetData>${lignes.join('')}</sheetData></worksheet>`
}

/** Le classeur complet, prêt à être téléchargé. */
export function classeurXlsx(feuilles: FeuilleXlsx[], date = new Date()): Blob {
  const noms = feuilles.map((f) => nomDOnglet(f.nom))

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + feuilles.map((_, i) =>
      `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
    + '</Types>'

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    + '</Relationships>'

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
    + '<sheets>'
    + noms.map((n, i) => `<sheet name="${echapperXml(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')
    + '</sheets></workbook>'

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
    + feuilles.map((_, i) =>
      `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
    + '</Relationships>'

  const fichiers: FichierZip[] = [
    { nom: '[Content_Types].xml', donnees: octets(contentTypes) },
    { nom: '_rels/.rels', donnees: octets(rels) },
    { nom: 'xl/workbook.xml', donnees: octets(workbook) },
    { nom: 'xl/_rels/workbook.xml.rels', donnees: octets(workbookRels) },
    ...feuilles.map((f, i) => ({
      nom: `xl/worksheets/sheet${i + 1}.xml`,
      donnees: octets(feuilleXml(f)),
    })),
  ]

  return new Blob([creerZip(fichiers, date)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/** Propose le classeur au téléchargement. */
export function telechargerClasseur(blob: Blob, nomDuFichier: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomDuFichier
  document.body.appendChild(a)
  a.click()
  // Le lien et l'URL ne partent qu'au tour de boucle suivant. Retirés dans la
  // foulée du clic, certains navigateurs annulent le téléchargement avant de
  // l'avoir commencé, et le fichier n'arrive jamais.
  setTimeout(() => a.remove(), 0)
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
