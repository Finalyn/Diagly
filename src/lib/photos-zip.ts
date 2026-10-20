/**
 * Toutes les photos d'un diagnostic, en une archive.
 *
 * Une archive plutôt que cent téléchargements : le navigateur en bloque une
 * partie, et personne ne veut trier cent fichiers dans un dossier. Le
 * téléchargement se fait depuis la page Rapports, comme tous les documents :
 * la page Photos, elle, se consulte.
 */
import { creerZip, octetsDeDataUrl } from './zip'
import type { ApiDiagnosticItem } from './api-types'

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

/** Nom du dossier, utilisable comme nom de fichier. */
export function nomDeDossier(projet: string): string {
  return slug(projet) || 'diagnostic'
}

/** Le nombre de photos d'un diagnostic. */
export const nombreDePhotos = (items: Pick<ApiDiagnosticItem, 'photos'>[]) =>
  items.reduce((s, it) => s + it.photos.length, 0)

/**
 * L'archive des photos, nommées par dossier, code CFC et rang : un nom lisible
 * et triable.
 */
export async function archiveDesPhotos(projet: string, items: Pick<ApiDiagnosticItem, 'cfcCode' | 'photos'>[]): Promise<Blob> {
  const fichiers = await Promise.all(items.flatMap((it) => it.photos.map(async (src, i) => ({
    nom: `${nomDeDossier(projet)}-${slug(it.cfcCode) || 'cfc'}-${i + 1}.jpg`,
    // Les photos du diagnostic sont conservées en data URL ; on gère quand même
    // le cas d'une image servie par le serveur, pour ne pas la perdre en route.
    donnees: src.startsWith('data:')
      ? octetsDeDataUrl(src)
      : new Uint8Array(await (await fetch(src)).arrayBuffer()),
  }))))
  return creerZip(fichiers)
}
