import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardCheck, RefreshCw } from 'lucide-react'
import { estHorsLigne, rechargerProprement } from '@/lib/rechargement'

/**
 * Le dernier rempart : une erreur de rendu affichait une page entièrement
 * blanche, sans rien à lire ni à toucher. On montre ce qui s'est passé, avec de
 * quoi recharger, et le message exact, à transmettre au support.
 *
 * Hors connexion, recharger ne sert à rien (et purger le code gardé sur
 * l'appareil rendrait tout l'outil inutilisable) : l'écran qui manque n'a
 * simplement jamais été ouvert en ligne. On le dit, et on ramène à la liste
 * des diagnostics, qui elle fonctionne sans réseau.
 *
 * Placé dans le routeur (App.tsx) : le retour à la liste passe par lui.
 */
export class FiletDeSecurite extends Component<{ children: ReactNode }, { erreur: Error | null }> {
  state = { erreur: null as Error | null }

  static getDerivedStateFromError(erreur: Error) {
    return { erreur }
  }

  componentDidCatch(erreur: Error, info: ErrorInfo) {
    console.error('Diagly : erreur d’affichage', erreur, info.componentStack)
  }

  componentDidMount() {
    window.addEventListener('online', this.suivreLeReseau)
    window.addEventListener('offline', this.suivreLeReseau)
  }

  componentWillUnmount() {
    window.removeEventListener('online', this.suivreLeReseau)
    window.removeEventListener('offline', this.suivreLeReseau)
  }

  /** Le réseau revient ou s'en va pendant que l'erreur est affichée : le bouton suit. */
  suivreLeReseau = () => {
    if (this.state.erreur) this.forceUpdate()
  }

  render() {
    const { erreur } = this.state
    if (!erreur) return this.props.children
    const horsLigne = estHorsLigne()
    return (
      <div className="safe-top flex min-h-dvh flex-col items-center justify-center gap-4 bg-white px-6 text-center">
        <img src="/diagly-mark.svg" alt="" className="h-10 w-auto" />
        {horsLigne ? (
          <div>
            <p className="text-base font-semibold text-neutral-900">Cet écran n&apos;est pas disponible hors connexion</p>
            <p className="mt-1 text-sm text-neutral-500">Il s&apos;ouvrira au retour du réseau. Vos saisies en attente sont gardées sur l&apos;appareil.</p>
          </div>
        ) : (
          <div>
            <p className="text-base font-semibold text-neutral-900">Cette page n&apos;a pas pu s&apos;afficher</p>
            <p className="mt-1 text-sm text-neutral-500">Rechargez : vos saisies en attente sont gardées sur l&apos;appareil.</p>
          </div>
        )}
        {horsLigne ? (
          <RetourALaListe onRetour={() => this.setState({ erreur: null })} />
        ) : (
          <button
            type="button"
            // Recharger en vidant les caches du code : un simple rechargement
            // resservait le même fichier abîmé.
            onClick={() => { void rechargerProprement() }}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-neutral-900 px-5 text-sm font-medium text-white"
          >
            <RefreshCw className="h-4 w-4" />Recharger
          </button>
        )}
        <p className="max-w-md break-words font-mono text-[11px] text-neutral-400">{erreur.message}</p>
      </div>
    )
  }
}

/**
 * Revenir à la liste sans recharger : hors connexion, un rechargement ne
 * ferait que repartir du shell gardé, et la mémoire de l'application (données
 * déjà lues) serait perdue. On change d'adresse d'abord, puis on lève l'erreur :
 * l'écran fautif ne se rend pas une seconde fois.
 */
function RetourALaListe({ onRetour }: { onRetour: () => void }) {
  const naviguer = useNavigate()
  return (
    <button
      type="button"
      onClick={() => { naviguer('/app/projects'); onRetour() }}
      className="inline-flex h-11 items-center gap-2 rounded-xl bg-neutral-900 px-5 text-sm font-medium text-white"
    >
      <ClipboardCheck className="h-4 w-4" />Revenir à la liste des diagnostics
    </button>
  )
}
