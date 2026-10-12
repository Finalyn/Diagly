import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { clear, createStore, delMany, set, values, type UseStore } from 'idb-keyval'
import { estAppNative } from '@/lib/plateforme'
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
 */
export interface StockageFile {
  lister(): Promise<Operation[]>
  ecrire(ops: Operation[]): Promise<void>
  effacer(ids: string[]): Promise<void>
  vider(): Promise<void>
}

const DOSSIER = 'file-envoi'
const ICI = Directory.LibraryNoCloud

async function lireOperation(chemin: string): Promise<Operation | null> {
  try {
    const { data } = await Filesystem.readFile({ path: chemin, directory: ICI, encoding: Encoding.UTF8 })
    return JSON.parse(typeof data === 'string' ? data : await data.text()) as Operation
  } catch {
    return null
  }
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
      // La version définitive d'abord ; à défaut, la version provisoire, si
      // l'app a été tuée entre l'écriture et le renommage. Un fichier
      // illisible n'empêche pas les autres de partir, et reste sur le disque :
      // on ne jette pas une saisie qu'on n'a pas su lire.
      const op = (noms.includes(`${id}.json`) ? await lireOperation(`${DOSSIER}/${id}.json`) : null)
        ?? (noms.includes(`${id}.json.tmp`) ? await lireOperation(`${DOSSIER}/${id}.json.tmp`) : null)
      if (op) ops.push(op)
    }
    return ops
  },

  async ecrire(ops) {
    for (const op of ops) {
      // Écriture à côté, puis renommage : une coupure en pleine écriture
      // laisse l'ancienne version intacte.
      const provisoire = `${DOSSIER}/${op.id}.json.tmp`
      const definitif = `${DOSSIER}/${op.id}.json`
      await Filesystem.writeFile({ path: provisoire, directory: ICI, data: JSON.stringify(op), encoding: Encoding.UTF8, recursive: true })
      const renommer = () => Filesystem.rename({ from: provisoire, to: definitif, directory: ICI, toDirectory: ICI })
      await renommer().catch(async () => {
        // Si le renommage refuse d'écraser la version précédente, on la
        // retire, puis on renomme.
        await Filesystem.deleteFile({ path: definitif, directory: ICI }).catch(() => undefined)
        await renommer()
      })
    }
  },

  async effacer(ids) {
    for (const id of ids) {
      await Filesystem.deleteFile({ path: `${DOSSIER}/${id}.json`, directory: ICI }).catch(() => undefined)
      await Filesystem.deleteFile({ path: `${DOSSIER}/${id}.json.tmp`, directory: ICI }).catch(() => undefined)
    }
  },

  async vider() {
    await Filesystem.rmdir({ path: DOSSIER, directory: ICI, recursive: true }).catch(() => undefined)
  },
}

let magasin: UseStore | null = null
const base = () => (magasin ??= createStore('diagly-file-envoi', 'operations'))

const indexedDb: StockageFile = {
  lister: () => values<Operation>(base()),
  async ecrire(ops) {
    for (const op of ops) await set(op.id, op, base())
  },
  effacer: (ids) => delMany(ids, base()),
  vider: () => clear(base()),
}

export const stockage: StockageFile = estAppNative ? fichiers : indexedDb
