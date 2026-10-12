import { Capacitor } from '@capacitor/core'

// L'application tourne soit dans un navigateur (site diagly.ch, PWA installée),
// soit dans l'app iPhone/iPad, qui embarque le même front dans une vue web
// servie depuis capacitor://localhost. Ce module est le seul endroit où l'on
// décide de quel côté on se trouve.

/** Vrai dans l'app installée depuis l'App Store (iOS) ou le Play Store. */
export const estAppNative = Capacitor.isNativePlatform()

/** Vrai dans l'app iPhone/iPad. */
export const estIOS = Capacitor.getPlatform() === 'ios'

/**
 * L'adresse publique du site. Dans l'app, l'origine de la page est
 * capacitor://localhost : tout lien destiné à être ouvert ailleurs (partage
 * d'un rapport, invitation) doit donc partir de cette adresse, pas de
 * window.location.origin.
 */
export const ORIGINE_PUBLIQUE = estAppNative ? 'https://diagly.ch' : window.location.origin
