import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardCheck, RefreshCw } from 'lucide-react'
import { estHorsLigne, fichierDeCodeIntrouvable, rechargerDesQuePermis, rechargerProprement } from '@/lib/rechargement'

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
 * Un fichier de code qui ne se charge pas, en ligne, c'est presque toujours une
 * mise en ligne en cours : le serveur se tait le temps du Build et du
 * redémarrage. On le dit, et on réessaie tout seul toutes les quelques
 * secondes : la page revient d'elle-même dès que le serveur répond.
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
    if (fichierDeCodeIntrouvable(erreur)) this.reessayer()
  }

  private minuterie: number | null = null

  /** Toutes les 4 s pendant 10 minutes : recharge dès que le serveur répond. */
  reessayer() {
    if (this.minuterie != null) return
    const debut = Date.now()
    this.minuterie = window.setInterval(() => {
      if (Date.now() - debut > 10 * 60_000) { this.arreter(); return }
      void rechargerDesQuePermis().then((parti) => { if (parti) this.arreter() })
    }, 4000)
  }

  arreter() {
    if (this.minuterie != null) window.clearInterval(this.minuterie)
    this.minuterie = null
  }

  componentDidMount() {
    window.addEventListener('online', this.suivreLeReseau)
    window.addEventListener('offline', this.suivreLeReseau)
  }

  componentWillUnmount() {
    this.arreter()
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
    const miseAJour = !horsLigne && fichierDeCodeIntrouvable(erreur)
    return (
      <div className="safe-top flex min-h-dvh flex-col items-center justify-center gap-4 bg-white px-6 text-center">
        <img src="/diagly-mark.svg" alt="" className="h-10 w-auto" />
        {horsLigne ? (
          <div>
            <p className="text-base font-semibold text-neutral-900">Cet écran n&apos;est pas disponible hors connexion</p>
            <p className="mt-1 text-sm text-neutral-500">Il s&apos;ouvrira au retour du réseau. Vos saisies en attente sont gardées sur l&apos;appareil.</p>
          </div>
        ) : miseAJour ? (
          <div>
            <p className="text-base font-semibold text-neutral-900">Diagly se met à jour</p>
            <p className="mt-1 text-sm text-neutral-500">La page revient d&apos;elle-même dans quelques instants. Vos saisies en attente sont gardées sur l&apos;appareil.</p>
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
