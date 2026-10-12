import { Component, type ErrorInfo, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'

/**
 * Le dernier rempart : une erreur de rendu affichait une page entièrement
 * blanche, sans rien à lire ni à toucher. On montre ce qui s'est passé, avec de
 * quoi recharger, et le message exact, à transmettre au support.
 */
export class FiletDeSecurite extends Component<{ children: ReactNode }, { erreur: Error | null }> {
  state = { erreur: null as Error | null }

  static getDerivedStateFromError(erreur: Error) {
    return { erreur }
  }

  componentDidCatch(erreur: Error, info: ErrorInfo) {
    console.error('Diagly : erreur d’affichage', erreur, info.componentStack)
  }

  render() {
    const { erreur } = this.state
    if (!erreur) return this.props.children
    return (
      <div className="safe-top flex min-h-dvh flex-col items-center justify-center gap-4 bg-white px-6 text-center">
        <img src="/diagly-mark.svg" alt="" className="h-10 w-auto" />
        <div>
          <p className="text-base font-semibold text-neutral-900">Cette page n&apos;a pas pu s&apos;afficher</p>
          <p className="mt-1 text-sm text-neutral-500">Rechargez : vos saisies en attente sont gardées sur l&apos;appareil.</p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-neutral-900 px-5 text-sm font-medium text-white"
        >
          <RefreshCw className="h-4 w-4" />Recharger
        </button>
        <p className="max-w-md break-words font-mono text-[11px] text-neutral-400">{erreur.message}</p>
      </div>
    )
  }
}
