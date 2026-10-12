import { PushNotifications } from '@capacitor/push-notifications'
import { api } from './api'
import { estAppNative } from './plateforme'
import { useAuth } from '@/stores/auth'

// Les notifications poussées, par deux chemins selon où tourne Diagly :
//  - dans un navigateur : le push web (service worker, clés VAPID) ;
//  - dans l'app iPhone/iPad : les notifications d'Apple (APNs), par le plugin
//    @capacitor/push-notifications. L'app reçoit un jeton d'appareil, qu'elle
//    confie au serveur ; c'est par lui que le serveur la joint.
// L'écran des réglages ne voit qu'une interface : état, abonner, désabonner.

export type PushState = 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

// ------------------------------------------------------------- app iPhone/iPad

// Le jeton de cet appareil, gardé pour pouvoir le retirer à la déconnexion.
const CLE_JETON = 'diagly.push.jeton'
const jetonConnu = (): string | null => { try { return localStorage.getItem(CLE_JETON) } catch { return null } }
const noterJeton = (j: string | null) => {
  try { if (j) localStorage.setItem(CLE_JETON, j); else localStorage.removeItem(CLE_JETON) } catch { /* stockage indisponible */ }
}

let ecoute: Promise<void> | null = null
/** iOS remet le jeton par un événement, après register() : on l'envoie au serveur. */
function ecouterLeJeton(): Promise<void> {
  ecoute ??= (async () => {
    await PushNotifications.addListener('registration', ({ value }) => {
      noterJeton(value)
      if (useAuth.getState().accessToken) void api.push.appareil(value).catch(() => undefined)
    })
    await PushNotifications.addListener('registrationError', (e) => {
      console.warn('Enregistrement APNs refusé :', e.error)
    })
  })()
  return ecoute
}

/** Réenregistre l'appareil si l'autorisation est déjà donnée (le jeton peut changer). */
export async function reprendreNotificationsNatives(): Promise<void> {
  if (!estAppNative) return
  const p = await PushNotifications.checkPermissions()
  if (p.receive !== 'granted') return
  await ecouterLeJeton()
  await PushNotifications.register()
}

/** Retire cet appareil du compte (déconnexion) : il ne reçoit plus rien pour lui. */
export async function oublierCetAppareil(): Promise<void> {
  if (!estAppNative) return
  const j = jetonConnu()
  if (j) await api.push.retirerAppareil(j).catch(() => undefined)
}

// ------------------------------------------------------------------- commun

export function pushSupported(): boolean {
  if (estAppNative) return true
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export async function getPushState(): Promise<PushState> {
  if (estAppNative) {
    const p = await PushNotifications.checkPermissions()
    if (p.receive === 'denied') return 'denied'
    return p.receive === 'granted' && jetonConnu() ? 'subscribed' : 'unsubscribed'
  }
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  return sub ? 'subscribed' : 'unsubscribed'
}

/** Demande la permission, s'abonne au push et enregistre l'abonnement côté serveur. */
export async function subscribePush(publicKey?: string | null): Promise<void> {
  if (estAppNative) {
    const p = await PushNotifications.requestPermissions()
    if (p.receive !== 'granted') throw new Error('permission-refused')
    await ecouterLeJeton()
    await PushNotifications.register()
    return
  }
  if (!publicKey) throw new Error('vapid-missing')
  const reg = await navigator.serviceWorker.ready
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('permission-refused')
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
  })
  await api.push.subscribe(sub.toJSON() as PushSubscriptionJSON)
}

export async function unsubscribePush(): Promise<void> {
  if (estAppNative) {
    await oublierCetAppareil()
    noterJeton(null)
    await PushNotifications.unregister().catch(() => undefined)
    return
  }
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (sub) {
    await api.push.unsubscribe(sub.endpoint).catch(() => undefined)
    await sub.unsubscribe().catch(() => undefined)
  }
}
