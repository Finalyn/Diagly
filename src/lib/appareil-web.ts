import { useSyncExternalStore } from 'react'
import { estAppNative } from './plateforme'
import { LIEN_APP_STORE } from '@/pages/marketing/accueil/contenu'

// Sur un téléphone ou une tablette, Diagly ne s'utilise pas dans le
// navigateur : sur iPhone et iPad, c'est l'app de l'App Store ; sur Android,
// la PWA, installée sur l'écran d'accueil. Le site public (accueil, blog, liens
// des e-mails) reste ouvert partout ; seuls l'app et ses portes d'entrée
// (connexion, inscription) passent par components/GardeAppareil.tsx.

export type AppareilMobile = 'ios' | 'android'

/**
 * iPhone et iPad renvoient vers l'App Store dès que l'app y a son adresse
 * (LIEN_APP_STORE, marketing/accueil/contenu.ts). D'ici là, ils gardent le
 * navigateur : bloquer avant fermerait la porte à tous ceux qui ne sont pas
 * testeurs TestFlight.
 */
export const BLOQUER_IOS = Boolean(LIEN_APP_STORE)

/** Le téléphone ou la tablette du visiteur, dans un navigateur ; null ailleurs. */
export function appareilMobile(): AppareilMobile | null {
  if (estAppNative || typeof navigator === 'undefined') return null
  const ua = navigator.userAgent
  if (/Android/i.test(ua)) return 'android'
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  // L'iPad se présente comme un Mac ; un Mac, lui, n'a pas d'écran tactile.
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return 'ios'
  return null
}

/** Vrai quand la PWA est ouverte depuis l'écran d'accueil, hors du navigateur. */
export function ouverteCommeApp(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches
    || window.matchMedia?.('(display-mode: fullscreen)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/**
 * L'appareil à qui l'app web est refusée, ou null s'il y a accès. Android
 * passe dès que la PWA est ouverte depuis l'écran d'accueil ; iPhone et iPad,
 * jamais une fois l'app sur l'App Store, PWA comprise.
 */
export function accesWebRefuse(): AppareilMobile | null {
  const appareil = appareilMobile()
  if (appareil === 'android') return ouverteCommeApp() ? null : 'android'
  if (appareil === 'ios') return BLOQUER_IOS ? 'ios' : null
  return null
}

// --------------------------------------------------- installation sur Android

/** L'événement de Chrome qui ouvre la fenêtre d'installation de la PWA. */
type InviteInstallation = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export interface EtatInstallation {
  /** Le navigateur propose l'installation : le bouton peut l'ouvrir. */
  possible: boolean
  /** L'installation vient d'avoir lieu. */
  installee: boolean
}

let invite: InviteInstallation | null = null
let etat: EtatInstallation = { possible: false, installee: false }
const abonnes = new Set<() => void>()
const changer = (e: EtatInstallation) => { etat = e; abonnes.forEach((f) => f()) }

// Chrome ne propose l'installation qu'une fois, peu après le chargement : on la
// garde dès le démarrage, avant que la page d'installation ne s'affiche. Sur
// Android seulement, pour ne pas toucher à l'installation proposée ailleurs.
if (typeof window !== 'undefined' && appareilMobile() === 'android') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    invite = e as InviteInstallation
    changer({ ...etat, possible: true })
  })
  window.addEventListener('appinstalled', () => {
    invite = null
    changer({ possible: false, installee: true })
  })
}

export function useInstallation(): EtatInstallation {
  return useSyncExternalStore(
    (f) => { abonnes.add(f); return () => { abonnes.delete(f) } },
    () => etat,
    () => etat,
  )
}

/** Ouvre la fenêtre d'installation du navigateur. Faux si elle n'est pas disponible ou refusée. */
export async function installer(): Promise<boolean> {
  if (!invite) return false
  const i = invite
  await i.prompt()
  const { outcome } = await i.userChoice
  // L'invitation ne sert qu'une fois ; Chrome en renvoie une autre s'il le peut.
  invite = null
  changer({ possible: false, installee: outcome === 'accepted' || etat.installee })
  return outcome === 'accepted'
}
