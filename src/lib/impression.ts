import { registerPlugin } from '@capacitor/core'
import { estAppNative } from './plateforme'

// Dans l'app iPhone/iPad, window.print() ne fait rien et window.open() n'ouvre
// pas de fenêtre : l'impression passe par le plugin natif du projet iOS
// (ios/App/App/ImpressionPlugin.swift), qui ouvre la feuille d'impression du
// système. On y imprime, ou on enregistre en PDF dans Fichiers.

interface PluginImpression {
  imprimer(options: { titre?: string }): Promise<{ imprime: boolean }>
  imprimerHtml(options: { html: string; titre?: string }): Promise<{ imprime: boolean }>
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
