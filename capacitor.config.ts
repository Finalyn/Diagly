import type { CapacitorConfig } from '@capacitor/cli'

// L'app iPhone/iPad embarque le front construit par `npm run build:app` (dossier
// dist/) et parle à l'API de diagly.ch. Voir APP-IOS.md.
const config: CapacitorConfig = {
  appId: 'ch.diagly.app',
  appName: 'Diagly',
  webDir: 'dist',
  ios: {
    // La page passe sous la barre d'état et l'indicateur d'accueil : les marges
    // viennent du CSS (env(safe-area-inset-*)), comme pour la PWA.
    contentInset: 'never',
    // Sur iPad, le mode « bureau » de WebKit ignorerait la largeur de l'écran et
    // dessinerait la page à 980 px avant de la réduire. En mode mobile, la
    // largeur réelle décide : l'app complète au-dessus de 768 px, l'app de
    // terrain en dessous (Split View, Slide Over).
    preferredContentMode: 'mobile',
    backgroundColor: '#ffffff',
    // Les liens vers d'autres sites s'ouvrent hors de l'app, jamais dans sa vue.
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: {
      // Masqué par le front quand la première page est prête (lib/natif.ts) :
      // pas d'écran blanc entre l'écran de lancement et l'app.
      launchAutoHide: false,
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
    Keyboard: {
      // La vue rétrécit au-dessus du clavier : les champs fixés en bas (assistant,
      // notes) restent visibles pendant la frappe.
      resize: 'native',
      resizeOnFullScreen: true,
    },
  },
}

export default config
