/**
 * Ce qu'un relevé a laissé derrière lui.
 *
 * Un diagnostic se remplit debout, entre deux étages, et l'oubli le plus courant
 * n'est pas une case vide : c'est une case cochée sans sa preuve. Un ouvrage noté
 * mauvais et chiffré à quarante mille francs, sans une seule photo, se discutera
 * devant le propriétaire sans rien à montrer. C'est cela qu'on signale, pendant
 * que le diagnostiqueur est encore dans le bâtiment.
 *
 * On ne signale jamais un ouvrage simplement pas encore relevé : ce n'est pas un
 * oubli, c'est du travail restant, et l'avancement le dit déjà.
 */

export type RaisonOubli = 'photo' | 'quantite'

export interface Oubli {
  raison: RaisonOubli
  /**
   * « importante » quand l'oubli porte sur un constat qui engage : un défaut sans
   * preuve, un montant sans quantité. « légère » sinon.
   */
  gravite: 'importante' | 'legere'
  message: string
}

export interface ReleveAControler {
  state?: string | null
  photos?: string[] | null
  unit?: string | null
  area?: number | null
}

const DEGRADE = new Set(['MOYEN', 'MAUVAIS'])

/** Les oublis d'un relevé. Vide si rien ne manque, ou si l'ouvrage n'est pas relevé. */
export function oublisDUnReleve(item: ReleveAControler): Oubli[] {
  // Pas d'état : l'ouvrage attend son tour, il n'a rien oublié.
  if (!item.state) return []

  const oublis: Oubli[] = []
  const degrade = DEGRADE.has(item.state)

  if (!item.photos || item.photos.length === 0) {
    oublis.push({
      raison: 'photo',
      gravite: degrade ? 'importante' : 'legere',
      message: degrade
        ? "Aucune photo sur un ouvrage dégradé : le constat part au rapport sans sa preuve."
        : 'Aucune photo.',
    })
  }

  // Une unité sans quantité laisse un montant qui ne repose sur rien.
  if (item.unit && (item.area == null || item.area === 0)) {
    oublis.push({
      raison: 'quantite',
      gravite: 'importante',
      message: `Quantité manquante, alors que l'ouvrage se compte en ${item.unit}.`,
    })
  }

  return oublis
}

export const aUnOubli = (item: ReleveAControler): boolean => oublisDUnReleve(item).length > 0

export const aUnOubliImportant = (item: ReleveAControler): boolean =>
  oublisDUnReleve(item).some((o) => o.gravite === 'importante')

export interface BilanOublis {
  importants: number
  legers: number
  total: number
  /** Nombre de relevés concernés, un relevé pouvant porter deux oublis. */
  releves: number
  /** Toutes photos manquantes confondues. */
  sansPhoto: number
  /** Celles qui engagent : un ouvrage dégradé, donc chiffré, sans preuve. */
  sansPhotoDegrade: number
  sansQuantite: number
}

export function bilanDesOublis(items: ReleveAControler[]): BilanOublis {
  const b: BilanOublis = {
    importants: 0, legers: 0, total: 0, releves: 0,
    sansPhoto: 0, sansPhotoDegrade: 0, sansQuantite: 0,
  }
  for (const it of items) {
    const o = oublisDUnReleve(it)
    if (o.length === 0) continue
    b.releves += 1
    for (const x of o) {
      b.total += 1
      if (x.gravite === 'importante') b.importants += 1
      else b.legers += 1
      if (x.raison === 'photo') {
        b.sansPhoto += 1
        if (x.gravite === 'importante') b.sansPhotoDegrade += 1
      }
      if (x.raison === 'quantite') b.sansQuantite += 1
    }
  }
  return b
}

/**
 * La phrase à afficher, ou null quand il n'y a rien à dire.
 *
 * On ne compte que ce qui engage : prévenir pour une photo manquante sur un
 * ouvrage en très bon état apprendrait au diagnostiqueur à ignorer l'alerte, et
 * c'est alors la vraie qui passerait inaperçue.
 */
export function phraseDAlerte(b: BilanOublis): string | null {
  if (b.importants === 0) return null
  const bouts: string[] = []
  if (b.sansPhotoDegrade > 0) {
    const n = b.sansPhotoDegrade
    bouts.push(`${n} ouvrage${n > 1 ? 's' : ''} dégradé${n > 1 ? 's' : ''} sans photo`)
  }
  if (b.sansQuantite > 0) {
    bouts.push(`${b.sansQuantite} sans quantité`)
  }
  return bouts.join(', ')
}
