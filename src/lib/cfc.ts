// Regroupement des items du catalogue selon la nomenclature CFC suisse.
// Les items ont un champ `category` en texte libre, incohérent ; on s'appuie
// plutôt sur leur `cfcCode` (ex. 214, 221.5, 228.0) pour les ranger par groupe
// CFC à 2 chiffres (ex. 22 « Gros-œuvre 2 »), avec les libellés officiels
// tirés de la nomenclature (ApiCfcEntry de niveau 2).

import type { ApiCatalogItem, ApiCfcEntry } from './api-types'

/**
 * Groupe CFC à 2 chiffres d'un code (le « groupe principal », niveau 2).
 * Ex. "214" -> "21", "221.5" -> "22", "228.0" -> "22". null si pas de code exploitable.
 */
export function cfcGroupCode(cfcCode: string | null | undefined): string | null {
  if (!cfcCode) return null
  const digits = cfcCode.replace(/\D/g, '')
  if (digits.length < 2) return null
  return digits.slice(0, 2)
}

export interface CfcGroup {
  /** Code à 2 chiffres ("22"), ou "" pour les items sans code CFC. */
  code: string
  /** Libellé officiel ("Gros-œuvre 2"), ou "Non classé" pour le groupe sans code. */
  label: string
  items: ApiCatalogItem[]
}

/** Comparaison numérique sur les codes CFC ("214" < "228" < "42"). */
function compareCode(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true })
}

/** Map code-2-chiffres -> libellé, construite depuis la nomenclature (niveau 2). */
export function cfcGroupLabels(cfcEntries: ApiCfcEntry[]): Map<string, string> {
  const labels = new Map<string, string>()
  for (const e of cfcEntries) {
    if (e.code.length === 2) labels.set(e.code, e.label)
  }
  return labels
}

/**
 * Regroupe les items catalogue par groupe CFC (niveau 2), triés par code.
 * Les items sans code CFC sont rassemblés dans un groupe « Non classé » placé en fin.
 */
export function groupItemsByCfc(
  items: ApiCatalogItem[],
  cfcEntries: ApiCfcEntry[],
): CfcGroup[] {
  const labels = cfcGroupLabels(cfcEntries)
  const buckets = new Map<string, ApiCatalogItem[]>()

  for (const it of items) {
    const code = cfcGroupCode(it.cfcCode) ?? ''
    if (!buckets.has(code)) buckets.set(code, [])
    buckets.get(code)!.push(it)
  }

  const groups: CfcGroup[] = []
  for (const [code, groupItems] of buckets) {
    groupItems.sort((a, b) => {
      const byCode = compareCode(a.cfcCode ?? '', b.cfcCode ?? '')
      return byCode !== 0 ? byCode : a.displayOrder - b.displayOrder
    })
    groups.push({
      code,
      label: code ? (labels.get(code) ?? `CFC ${code}`) : 'Non classé',
      items: groupItems,
    })
  }

  groups.sort((a, b) => {
    if (a.code === '') return 1
    if (b.code === '') return -1
    return compareCode(a.code, b.code)
  })

  return groups
}

// ---------------------------------------------------------------------------
// Regroupement par catégorie de la Feuil2 (STRUCTURE, FAÇADE, TOITURE…),
// dans l'ordre du tableau (displayOrder) = ordre de visite du diagnostiqueur.
// ---------------------------------------------------------------------------

export interface CategoryGroup {
  category: string
  items: ApiCatalogItem[]
}

/**
 * Regroupe les items par catégorie d'origine, en respectant l'ordre de la
 * Feuil2 (displayOrder) : les catégories apparaissent dans l'ordre où leur
 * premier item apparaît, et les items sont triés par displayOrder à l'intérieur.
 */
export function groupItemsByCategory(items: ApiCatalogItem[]): CategoryGroup[] {
  const order: string[] = []
  const map = new Map<string, ApiCatalogItem[]>()
  const sorted = [...items].sort((a, b) => a.displayOrder - b.displayOrder)
  for (const it of sorted) {
    const cat = it.category ?? 'Autres'
    if (!map.has(cat)) { map.set(cat, []); order.push(cat) }
    map.get(cat)!.push(it)
  }
  return order.map(category => ({ category, items: map.get(category)! }))
}

// ---------------------------------------------------------------------------
// Arborescence CFC complète : Chapitre (1 chiffre) › Groupe (2) › Position (3)
// ---------------------------------------------------------------------------

export interface CfcTreeNode {
  /** Code CFC ("2", "21", "214"), ou "" pour le nœud « Non classé ». */
  code: string
  /** Libellé officiel issu de la nomenclature. */
  label: string
  /** 1 = chapitre, 2 = groupe, 3 = position. */
  level: 1 | 2 | 3
  /** Items rattachés directement à ce nœud (en général au niveau position). */
  items: ApiCatalogItem[]
  children: CfcTreeNode[]
}

/** Chiffres seuls d'un code CFC ("214.4" -> "2144"). */
function digitsOf(code: string | null | undefined): string {
  return (code ?? '').replace(/\D/g, '')
}

/**
 * Construit l'arborescence CFC à partir des items et de la nomenclature.
 * Seules les branches qui contiennent des items sont incluses ; chaque branche
 * affiche le chemin complet (chapitre › groupe › position) avec les libellés officiels.
 * Les items sans code CFC exploitable sont regroupés dans un nœud « Non classé ».
 */
export function buildCfcTree(
  items: ApiCatalogItem[],
  cfcEntries: ApiCfcEntry[],
): CfcTreeNode[] {
  const labelByCode = new Map<string, string>()
  for (const e of cfcEntries) labelByCode.set(e.code, e.label)

  const makeNode = (code: string, level: 1 | 2 | 3): CfcTreeNode => ({
    code,
    label: code ? (labelByCode.get(code) ?? `CFC ${code}`) : 'Non classé',
    level,
    items: [],
    children: [],
  })

  const chapters = new Map<string, CfcTreeNode>()
  const groupNodes = new Map<string, CfcTreeNode>()
  const positionNodes = new Map<string, CfcTreeNode>()
  const unclassified: ApiCatalogItem[] = []

  for (const it of items) {
    const d = digitsOf(it.cfcCode)
    if (!d) { unclassified.push(it); continue }

    const chapCode = d.slice(0, 1)
    let chapter = chapters.get(chapCode)
    if (!chapter) { chapter = makeNode(chapCode, 1); chapters.set(chapCode, chapter) }

    let container = chapter
    if (d.length >= 2) {
      const groupCode = d.slice(0, 2)
      let group = groupNodes.get(groupCode)
      if (!group) { group = makeNode(groupCode, 2); groupNodes.set(groupCode, group); chapter.children.push(group) }
      container = group
    }
    if (d.length >= 3) {
      const posCode = d.slice(0, 3)
      let position = positionNodes.get(posCode)
      if (!position) { position = makeNode(posCode, 3); positionNodes.set(posCode, position); container.children.push(position) }
      container = position
    }
    container.items.push(it)
  }

  const sortRec = (nodes: CfcTreeNode[]) => {
    nodes.sort((a, b) => compareCode(a.code, b.code))
    for (const n of nodes) {
      n.items.sort((a, b) => {
        const byCode = compareCode(a.cfcCode ?? '', b.cfcCode ?? '')
        return byCode !== 0 ? byCode : a.displayOrder - b.displayOrder
      })
      sortRec(n.children)
    }
  }
  const roots = Array.from(chapters.values())
  sortRec(roots)

  if (unclassified.length) {
    unclassified.sort((a, b) => a.displayOrder - b.displayOrder)
    roots.push({ code: '', label: 'Non classé', level: 1, items: unclassified, children: [] })
  }

  return roots
}
