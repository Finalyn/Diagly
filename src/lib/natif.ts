import { App } from '@capacitor/app'
import { Network } from '@capacitor/network'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { onlineManager } from '@tanstack/react-query'
import { queryClient } from './query-client'
import { estAppNative } from './plateforme'
import { envoyer } from './hors-ligne/file-envoi'

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

  // Filet de sécurité : si la première page tarde (réseau coupé au lancement,
  // erreur), l'écran de lancement ne doit pas rester figé.
  setTimeout(masquerEcranDeLancement, 4000)
}
