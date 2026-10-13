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

/**
 * Coupe les notifications sur cet appareil (réglage, déconnexion). L'abonnement
 * est retiré de l'appareil d'abord, puis du serveur : hors-ligne ou face à un
 * serveur muet, la coupure locale a donc lieu quand même, et le compte suivant
 * de l'appareil ne reçoit pas les notifications du précédent.
 *
 * `prevenirLeServeur` à faux quand il n'y a plus de compte à prévenir (compte
 * supprimé).
 */
export async function unsubscribePush(prevenirLeServeur = true): Promise<void> {
  if (estAppNative) {
    const jeton = jetonConnu()
    noterJeton(null)
    await PushNotifications.unregister().catch(() => undefined)
    if (jeton && prevenirLeServeur) await api.push.retirerAppareil(jeton).catch(() => undefined)
    return
  }
  if (!pushSupported()) return
  // getRegistration et non ready : sans service worker enregistré (refusé, pas
  // encore installé), ready ne se résout jamais, et la déconnexion attendrait
  // sans fin.
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  const { endpoint } = sub
  await sub.unsubscribe().catch(() => undefined)
  if (prevenirLeServeur) await api.push.unsubscribe(endpoint).catch(() => undefined)
}
