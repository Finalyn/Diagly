import { App } from '@capacitor/app'
import { Network } from '@capacitor/network'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { PushNotifications } from '@capacitor/push-notifications'
import { onlineManager } from '@tanstack/react-query'
import { queryClient } from './query-client'
import { estAppNative } from './plateforme'
import { envoyer } from './hors-ligne/file-envoi'
import { reprendreNotificationsNatives, subscribePush } from './push-client'
import { useAuth } from '@/stores/auth'

/**
 * Ouvre une page de l'app depuis l'extérieur du routeur (notification touchée) :
 * le routeur suit l'historique du navigateur et réagit à popstate.
 */
function naviguerVers(url: string): void {
  window.history.pushState({}, '', url)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

// La permission des notifications se demande une fois, juste après la première
// connexion : c'est le moment où l'on sait pour quel compte les recevoir. Elle
// reste ensuite modifiable dans Paramètres, Notifications.
const CLE_PROPOSEE = 'diagly.push.proposee'
async function notificationsALaConnexion(): Promise<void> {
  const etat = await PushNotifications.checkPermissions().catch(() => null)
  if (!etat) return
  if (etat.receive === 'granted') return reprendreNotificationsNatives()
  let dejaProposee = false
  try { dejaProposee = localStorage.getItem(CLE_PROPOSEE) === '1'; localStorage.setItem(CLE_PROPOSEE, '1') } catch { /* stockage indisponible */ }
  if (!dejaProposee && etat.receive === 'prompt') await subscribePush().catch(() => undefined)
}

// Ce que l'app iPhone/iPad fait de plus que le site au démarrage. Rien ici ne
// s'exécute dans un navigateur.

let ecranMasque = false

/** Retire l'écran de lancement, une seule fois, quand l'app a de quoi s'afficher. */
export function masquerEcranDeLancement(): void {
  if (!estAppNative || ecranMasque) return
  ecranMasque = true
  void SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => undefined)
}

export function demarrerNatif(): void {
  if (!estAppNative) return

  // Les styles propres à l'app (pas de surbrillance au toucher, pas de bulle
  // « Copier » sur un bouton) se rattachent à cette classe.
  document.documentElement.classList.add('natif')

  // Texte sombre dans la barre d'état : l'app est claire partout.
  void StatusBar.setStyle({ style: Style.Light }).catch(() => undefined)

  // L'état du réseau vient du système (NWPathMonitor) plutôt que des événements
  // online/offline de la page.
  onlineManager.setEventListener((poser) => {
    const ecoute = Network.addListener('networkStatusChange', (s) => poser(s.connected))
    void Network.getStatus().then((s) => poser(s.connected)).catch(() => undefined)
    return () => { void ecoute.then((e) => e.remove()) }
  })

  // De retour au premier plan. Rien n'est émis pendant que l'app dort : un
  // réseau revenu entre-temps passerait inaperçu, et les envois en attente ne
  // repartiraient qu'au prochain changement. On relit donc l'état, puis on
  // envoie ce qui attendait et on rafraîchit ce qui est affiché.
  void App.addListener('resume', async () => {
    const etat = await Network.getStatus().catch(() => null)
    if (etat) onlineManager.setOnline(etat.connected)
    if (!onlineManager.isOnline()) return
    void envoyer()
    void queryClient.resumePausedMutations()
    void queryClient.refetchQueries({ type: 'active', stale: true })
  })

  // Notifications : toucher l'une d'elles ouvre la page qu'elle désigne.
  void PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
    const url = (notification.data as { url?: string } | undefined)?.url
    if (url?.startsWith('/')) naviguerVers(url)
  })
  // À l'ouverture de l'app, déjà connecté : l'appareil se réenregistre (son
  // jeton peut avoir changé). À chaque nouvelle connexion, même chose, et la
  // permission se demande la première fois.
  if (useAuth.getState().accessToken) void reprendreNotificationsNatives().catch(() => undefined)
  useAuth.subscribe((s, avant) => {
    if (s.user?.id && s.user.id !== avant.user?.id) void notificationsALaConnexion()
  })

  // Filet de sécurité : si la première page tarde (réseau coupé au lancement,
  // erreur), l'écran de lancement ne doit pas rester figé.
  setTimeout(masquerEcranDeLancement, 4000)
}
