import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { createStore, delMany, get, set, values, type UseStore } from 'idb-keyval'
import { estAppNative } from '@/lib/plateforme'
import type { Refus } from './etat'
import type { Operation } from './operations'

/**
 * Où la file d'envoi survit à la fermeture de l'app.
 *
 * Dans l'app iPhone/iPad : des fichiers de l'app (Library/NoCloud), que le
 * système ne vide pas pour faire de la place, contrairement aux données de la
 * vue web. Une saisie de chantier y est donc à l'abri tant qu'elle n'est pas
 * partie. Hors sauvegarde iCloud : restaurée des semaines plus tard sur un autre
 * téléphone, elle repartirait avec un contenu dépassé.
 *
 * Dans un navigateur : IndexedDB, dans une base à part du cache des requêtes.
 *
 * Une opération par fichier (ou par clé) : une photo ajoutée réécrit sa seule
 * opération, pas toute la file.
 *
 * Les refus du serveur sont gardés au même endroit, d'un seul bloc : ils sont
 * rares, se relisent tous ensemble, et sans cela un refus arrivé juste avant
 * la fermeture de l'app disparaissait sans avoir été lu.
 */
export interface StockageFile {
  lister(): Promise<Operation[]>
  ecrire(ops: Operation[]): Promise<void>
  effacer(ids: string[]): Promise<void>
  lireRefus(): Promise<Refus[]>
  /** Remplace la liste des refus gardée sur l'appareil. */
  ecrireRefus(refus: Refus[]): Promise<void>
}

const DOSSIER = 'file-envoi'
// Hors du dossier de la file : lister() y lit chaque fichier comme une opération.
const REFUS = 'file-envoi-refus.json'
const ICI = Directory.LibraryNoCloud

const estOperation = (v: unknown): v is Operation =>
  !!v && typeof v === 'object' && typeof (v as Operation).id === 'string' && typeof (v as Operation).releveId === 'string'

const estListeDeRefus = (v: unknown): v is Refus[] =>
  Array.isArray(v) && v.every((r) => !!r && typeof r === 'object' && estOperation((r as Refus).operation))

/**
 * Un fichier JSON relu entier, ou null : absent, tronqué par une coupure en
 * pleine écriture (le JSON ne se referme pas), ou d'une autre forme.
 */
async function lireJson<T>(chemin: string, valide: (v: unknown) => v is T): Promise<T | null> {
  try {
    const { data } = await Filesystem.readFile({ path: chemin, directory: ICI, encoding: Encoding.UTF8 })
    const lu: unknown = JSON.parse(typeof data === 'string' ? data : await data.text())
    return valide(lu) ? lu : null
  } catch {
    return null
  }
}

/** Écriture à côté, puis renommage : une coupure en pleine écriture laisse l'ancienne version intacte. */
async function ecrireJson(chemin: string, valeur: unknown): Promise<void> {
  const provisoire = `${chemin}.tmp`
  await Filesystem.writeFile({ path: provisoire, directory: ICI, data: JSON.stringify(valeur), encoding: Encoding.UTF8, recursive: true })
  const renommer = () => Filesystem.rename({ from: provisoire, to: chemin, directory: ICI, toDirectory: ICI })
  await renommer().catch(async () => {
    // Si le renommage refuse d'écraser la version précédente, on la
    // retire, puis on renomme.
    await Filesystem.deleteFile({ path: chemin, directory: ICI }).catch(() => undefined)
    await renommer()
  })
}

const fichiers: StockageFile = {
  async lister() {
    let noms: string[]
    try {
      noms = (await Filesystem.readdir({ path: DOSSIER, directory: ICI })).files.map((f) => f.name)
    } catch {
      return [] // dossier pas encore créé : rien en attente
    }
    const ids = new Set(noms.map((n) => n.replace(/\.json(\.tmp)?$/, '')))
    const ops: Operation[] = []
    for (const id of ids) {
      // La version provisoire d'abord, si elle est complète : elle ne reste
      // que si l'app a été tuée entre l'écriture et le renommage, et c'est
      // alors la plus récente (la modification qu'on venait de faire).
      // Tronquée, on se rabat sur la version définitive, restée intacte. Un
      // fichier illisible n'empêche pas les autres de partir, et reste sur le
      // disque : on ne jette pas une saisie qu'on n'a pas su lire.
      const op = (noms.includes(`${id}.json.tmp`) ? await lireJson(`${DOSSIER}/${id}.json.tmp`, estOperation) : null)
        ?? (noms.includes(`${id}.json`) ? await lireJson(`${DOSSIER}/${id}.json`, estOperation) : null)
      if (op) ops.push(op)
    }
    return ops
  },

  async ecrire(ops) {
    for (const op of ops) await ecrireJson(`${DOSSIER}/${op.id}.json`, op)
  },

  async effacer(ids) {
    for (const id of ids) {
      await Filesystem.deleteFile({ path: `${DOSSIER}/${id}.json`, directory: ICI }).catch(() => undefined)
      await Filesystem.deleteFile({ path: `${DOSSIER}/${id}.json.tmp`, directory: ICI }).catch(() => undefined)
    }
  },

  async lireRefus() {
    // Même règle que pour les opérations : la version provisoire si elle est complète.
    return (await lireJson(`${REFUS}.tmp`, estListeDeRefus)) ?? (await lireJson(REFUS, estListeDeRefus)) ?? []
  },

  ecrireRefus: (refus) => ecrireJson(REFUS, refus),
}

let magasin: UseStore | null = null
const base = () => (magasin ??= createStore('diagly-file-envoi', 'operations'))
// Une base à part pour les refus : idb-keyval ne crée qu'un magasin par base.
let magasinRefus: UseStore | null = null
const baseRefus = () => (magasinRefus ??= createStore('diagly-file-envoi-refus', 'refus'))

const indexedDb: StockageFile = {
  lister: () => values<Operation>(base()),
  async ecrire(ops) {
    for (const op of ops) await set(op.id, op, base())
  },
  effacer: (ids) => delMany(ids, base()),
  async lireRefus() {
    const lus = await get<unknown>('refus', baseRefus())
    return estListeDeRefus(lus) ? lus : []
  },
  ecrireRefus: (refus) => set('refus', refus, baseRefus()),
}

export const stockage: StockageFile = estAppNative ? fichiers : indexedDb
