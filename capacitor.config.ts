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
    // La vue web elle-même ne défile pas : sans cela, un glissement faisait
    // bouger toute la page, en-tête et barre du bas compris, comme une page
    // de Safari. Seules les zones de contenu défilent (index.css, html.natif).
    scrollEnabled: false,
  },
  plugins: {
    SplashScreen: {
      // Masqué par le front quand la première page est prête (lib/natif.ts) :
      // pas d'écran blanc entre l'écran de lancement et l'app.
      launchAutoHide: false,
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
    PushNotifications: {
      // Une notification arrivée pendant qu'on est dans l'app s'affiche quand
      // même, en bandeau, avec son son.
      presentationOptions: ['banner', 'list', 'sound', 'badge'],
    },
    Keyboard: {
      // Le clavier se pose par-dessus la page, comme dans une app native. En
      // « native », toute la vue rétrécissait : le menu de gauche de l'iPad se
      // tassait sans pouvoir défiler, et le fond apparaissait derrière les
      // coins arrondis du clavier. La place du clavier est rendue par le front,
      // à la zone principale et aux fenêtres seulement (lib/natif.ts, --clavier).
      resize: 'none',
    },
  },
}

export default config
