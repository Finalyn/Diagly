import { registerPlugin } from '@capacitor/core'
import { estAppNative } from './plateforme'

// Dans l'app iPhone/iPad, window.print() ne fait rien et window.open() n'ouvre
// pas de fenêtre : l'impression passe par le plugin natif du projet iOS
// (ios/App/App/ImpressionPlugin.swift), qui ouvre la feuille d'impression du
// système. On y imprime, ou on enregistre en PDF dans Fichiers.

interface PluginImpression {
  imprimer(options: { titre?: string }): Promise<{ imprime: boolean }>
  imprimerHtml(options: { html: string; titre?: string }): Promise<{ imprime: boolean }>
  /** La page mise en PDF sur des pages de cette taille, en points, puis la feuille de partage. */
  pdfDiapositives(options: { nom: string; largeur: number; hauteur: number }): Promise<{ partage: boolean }>
}

const Impression = registerPlugin<PluginImpression>('Impression')

/** Imprime la page affichée, avec ses styles @media print. */
export async function imprimerLaPage(titre?: string): Promise<void> {
  if (estAppNative) {
    await Impression.imprimer({ titre })
    return
  }
  window.print()
}

/**
 * Imprime la présentation des métrés affichée : une diapositive par page,
 * pages 16:9 sans marges, et `nom` pour nom du PDF.
 *
 * Sur le web, c'est l'impression du navigateur : la présentation a posé sa
 * taille de page tant qu'elle est affichée (PresentationMetres), et le titre
 * du document devient le nom proposé pour le PDF. Dans l'app, la feuille
 * d'impression d'iOS imposerait son papier, A4 ou Letter : le plugin met la
 * page en PDF aux dimensions de la diapositive (1280 × 720 px, soit
 * 960 × 540 points), puis ouvre la feuille de partage : Enregistrer dans
 * Fichiers, AirDrop, Mail, Imprimer.
 */
export async function imprimerDiapositives(nom: string): Promise<void> {
  if (estAppNative) {
    try {
      await Impression.pdfDiapositives({ nom, largeur: 960, hauteur: 540 })
    } catch (e) {
      // Une app d'avant cette méthode : la feuille d'impression, plutôt que rien.
      if ((e as { code?: string } | null)?.code !== 'UNIMPLEMENTED') throw e
      await Impression.imprimer({ titre: nom })
    }
    return
  }
  const titre = document.title
  document.title = nom
  const retablir = () => {
    document.title = titre
    window.removeEventListener('afterprint', retablir)
  }
  window.addEventListener('afterprint', retablir)
  window.print()
}

/**
 * Imprime un document HTML autonome. Le HTML ne doit pas compter sur un script :
 * l'impression native n'en exécute aucun.
 */
export async function imprimerHtml(html: string, titre?: string): Promise<void> {
  if (estAppNative) {
    await Impression.imprimerHtml({ html, titre })
    return
  }
  const w = window.open('', '_blank', 'width=800,height=1000')
  if (!w) return
  w.document.write(html.replace('</body>', '<script>window.onload=()=>{window.print()}</script></body>'))
  w.document.close()
}
