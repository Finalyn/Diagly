import { registerPlugin } from '@capacitor/core'
import { estAppNative, estIOS } from '@/lib/plateforme'

// Le scanner de documents d'iOS (VisionKit), dans l'app iPhone/iPad seulement.
// Le plugin natif est dans le projet iOS (ios/App/App/ScannerPlugin.swift) : il
// rend chaque page redressée en JPEG, à pleine résolution, dans un fichier
// temporaire que la vue web lit par son adresse.

interface PageNative {
  /** Adresse capacitor:// du fichier JPEG. */
  chemin: string
  largeur: number
  hauteur: number
}

interface PluginScanner {
  disponible(): Promise<{ disponible: boolean }>
  scanner(): Promise<{ pages: PageNative[] }>
  nettoyer(): Promise<void>
}

const Scanner = registerPlugin<PluginScanner>('Scanner')

/** La personne a fermé le scanner sans rien garder : ce n'est pas une erreur à afficher. */
export class ScanAnnule extends Error {}

/**
 * Le scanner natif est-il là ? Non hors de l'app, ni dans une app d'une
 * version antérieure au plugin : la page se rabat alors sur la photo
 * redressée dans le navigateur.
 */
export async function scannerNatifDisponible(): Promise<boolean> {
  if (!estAppNative || !estIOS) return false
  try {
    return (await Scanner.disponible()).disponible
  } catch {
    return false
  }
}

/** Les pages scannées, déjà redressées par iOS, avec leur taille en pixels. */
export async function scannerNatif(): Promise<{ image: Blob; largeur: number; hauteur: number }[]> {
  let r: { pages: PageNative[] }
  try {
    r = await Scanner.scanner()
  } catch (e) {
    if ((e as { code?: string })?.code === 'ANNULE') throw new ScanAnnule()
    throw e
  }
  try {
    return await Promise.all(r.pages.map(async (p) => {
      const reponse = await fetch(p.chemin)
      if (!reponse.ok) throw new Error('Une page scannée n’a pas pu être lue.')
      return { image: await reponse.blob(), largeur: p.largeur, hauteur: p.hauteur }
    }))
  } finally {
    // Les fichiers temporaires ne servent plus une fois lus.
    void Scanner.nettoyer().catch(() => undefined)
  }
}
