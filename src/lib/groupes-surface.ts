/**
 * Groupes de surface : plusieurs types d'ouvrage pour une même surface.
 *
 * Une façade est en bardage bois, ou en pierre, ou en crépi — rarement les cinq
 * à la fois. Or le catalogue propose chaque type comme un ouvrage distinct, et
 * chacun recevait la totalité de la surface de façade : relever trois types
 * chiffrait trois façades entières. Même chose pour les sols, où carrelage et
 * parquet donnaient deux fois la surface de plancher.
 *
 * Un groupe rassemble donc les types alternatifs d'une même surface. Le
 * diagnostiqueur relève ceux qui sont présents et dit quelle part de la surface
 * revient à chacun ; la quantité de chaque type en découle. Les types absents ne
 * sont tout simplement pas relevés, donc ils ne figurent nulle part.
 *
 * Le calcul vit ici, séparé de la saisie : c'est lui qui dit si un groupe est
 * réparti correctement, et il doit pouvoir être relu sans ouvrir un écran.
 */

/** Ce qu'il faut savoir d'un relevé pour le ranger dans son groupe. */
export interface ReleveDuGroupe {
  id: string
  cfcLabel: string
  catalogItemId?: number | null
  /**
   * L'article de la base v3 dans son étape (« A015@1 »), quand le relevé en
   * vient. C'est la clé de rapprochement avec le catalogue, à la place de
   * l'identifiant numérique de l'ancien.
   */
  cleArticle?: string | null
  /**
   * Étape où le relevé a été fait.
   *
   * Les parts se comptent par étape : les revêtements de sol de la cage
   * d'escalier totalisent cent pour cent, ceux des appartements aussi, et les
   * deux ne se mélangent pas puisque ce sont deux surfaces différentes.
   */
  etapeNumero?: number | null
  /** Part de la surface du groupe, en pourcent. null = pas encore répartie. */
  sharePct?: number | null
}

/** Ce qu'il faut savoir d'un article du catalogue. */
export interface ArticleDuGroupe {
  /** Numérique dans l'ancien catalogue, « A015@1 » dans la base v3. */
  id: number | string
  /** Nom du groupe de surface, ou null si l'article n'est pas alternatif. */
  surfaceGroup?: string | null
}

export type RaisonIncomplet = 'parts-manquantes' | 'somme'

export interface GroupeSurface {
  /** Clé unique : le nom du groupe, et l'étape quand il y en a une. */
  cle: string
  /** Nom affiché. Deux étapes peuvent le porter, chacune avec ses parts. */
  nom: string
  etapeNumero: number | null
  membres: ReleveDuGroupe[]
  /** Somme des parts renseignées, en pourcent. */
  total: number
  /** Nombre de membres dont la part n'est pas renseignée. */
  sansPart: number
  /** true quand la répartition tient : les quantités peuvent être calculées. */
  complet: boolean
  raison: RaisonIncomplet | null
}

/**
 * Part effective d'un relevé dans son groupe.
 *
 * Un groupe à un seul type prend toute la surface sans qu'on ait rien à saisir :
 * demander « 100 % » pour une façade qui n'a qu'un revêtement serait une case à
 * cocher pour rien. Dès qu'il y en a deux, la répartition devient une décision,
 * et elle est demandée.
 */
export function partEffective(releve: ReleveDuGroupe, nombreDeMembres: number): number | null {
  if (releve.sharePct != null) return releve.sharePct
  return nombreDeMembres === 1 ? 100 : null
}

/**
 * Range les relevés par groupe de surface. Les ouvrages sans groupe sont ignorés.
 *
 * Le catalogue arrive en liste et l'index est construit ici : le composant qui
 * appelle n'a pas à mémoriser une Map pour cela, et le compilateur React garde
 * ses optimisations sur le relevé.
 */
export function groupesDuReleve(
  releves: ReleveDuGroupe[],
  articles: ArticleDuGroupe[],
): GroupeSurface[] {
  const parId = new Map<number | string, ArticleDuGroupe>(articles.map((a) => [a.id, a]))
  const paquets = new Map<string, { nom: string; etapeNumero: number | null; membres: ReleveDuGroupe[] }>()
  for (const r of releves) {
    const identite = r.cleArticle ?? r.catalogItemId
    if (identite == null) continue
    const nom = parId.get(identite)?.surfaceGroup
    if (!nom) continue
    const etapeNumero = r.etapeNumero ?? null
    const cle = etapeNumero === null ? nom : `${nom}@${etapeNumero}`
    if (!paquets.has(cle)) paquets.set(cle, { nom, etapeNumero, membres: [] })
    paquets.get(cle)!.membres.push(r)
  }

  return Array.from(paquets.entries())
    .sort((a, b) => a[1].nom.localeCompare(b[1].nom, 'fr') || (a[1].etapeNumero ?? 0) - (b[1].etapeNumero ?? 0))
    .map(([cle, { nom, etapeNumero, membres }]) => {
      const parts = membres.map((m) => partEffective(m, membres.length))
      const sansPart = parts.filter((p) => p == null).length
      const total = parts.reduce((s: number, p) => s + (p ?? 0), 0)
      // Un centième de point d'écart vient d'un arrondi d'affichage, pas d'une
      // erreur de saisie : on ne bloque pas un rapport là-dessus.
      const somme = Math.abs(total - 100) < 0.01
      return {
        cle,
        nom,
        etapeNumero,
        membres,
        total: Math.round(total * 100) / 100,
        sansPart,
        complet: sansPart === 0 && somme,
        raison: sansPart > 0 ? 'parts-manquantes' : somme ? null : 'somme',
      }
    })
}

/** Les groupes qui empêchent d'éditer le rapport. */
export function groupesIncomplets(groupes: GroupeSurface[]): GroupeSurface[] {
  return groupes.filter((g) => !g.complet)
}

/**
 * Quantité d'un type, à partir de celle de son groupe.
 *
 * `null` quand la part n'est pas répartie : mieux vaut pas de quantité qu'une
 * quantité fausse, qui se chiffrerait sans rien signaler.
 */
export function quantiteDuType(quantiteDuGroupe: number | undefined, part: number | null): number | undefined {
  if (quantiteDuGroupe == null || part == null) return undefined
  return Math.round(quantiteDuGroupe * part / 100)
}

/**
 * Répartition proposée quand on ajoute un type à un groupe.
 *
 * Le premier type relevé prend tout. Les suivants arrivent sans part : c'est au
 * diagnostiqueur de dire ce qu'il a vu, et une répartition inventée à sa place
 * passerait dans le devis sans qu'il l'ait regardée.
 */
export function partALAjout(membresExistants: number): number | null {
  return membresExistants === 0 ? 100 : null
}

/** Phrase d'alerte pour un groupe mal réparti. */
export function phraseDuGroupe(g: GroupeSurface): string {
  if (g.complet) return `${g.nom} : réparti sur ${g.membres.length} type${g.membres.length > 1 ? 's' : ''}.`
  if (g.raison === 'parts-manquantes') {
    return `${g.nom} : ${g.sansPart} type${g.sansPart > 1 ? 's' : ''} sans part. Indiquez quelle part de la surface revient à chacun.`
  }
  return `${g.nom} : les parts totalisent ${g.total} % au lieu de 100 %.`
}
