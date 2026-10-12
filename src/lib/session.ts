import { del } from 'idb-keyval'
import { useAuth } from '@/stores/auth'
import { queryClient, QUERY_CACHE_KEY } from '@/lib/query-client'
import { saisiesEnAttente, viderFile } from '@/lib/hors-ligne/file-envoi'
import { oublierCetAppareil } from '@/lib/push-client'

/**
 * Efface TOUTE trace locale de la session. Indispensable sur un appareil partagé
 * (tablette de chantier) : sans ça, le compte suivant retrouve les diagnostics,
 * adresses et photos du précédent dans le cache hors-ligne.
 *
 * Couvre : jetons (store persisté), cache react-query en mémoire ET sur IndexedDB
 * (avec les mutations hors-ligne en attente), caches du service worker contenant
 * des données (`/api` et `/uploads`). Le cache du shell et des assets est conservé :
 * il ne contient rien de personnel et l'app reste installable hors-ligne.
 */
export async function purgeLocalSession(): Promise<void> {
  useAuth.getState().clearAuth()
  try {
    useAuth.persist.clearStorage()
  } catch { /* store non persisté : rien à faire */ }

  queryClient.clear()
  try {
    await del(QUERY_CACHE_KEY)
  } catch { /* IndexedDB indisponible (mode privé) */ }

  if ('caches' in window) {
    try {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((k) => k.startsWith('diagly-api') || k.startsWith('diagly-uploads')).map((k) => caches.delete(k)),
      )
    } catch { /* ignore */ }
  }
}

/**
 * Après la suppression du compte : il n'y a plus de session à révoquer côté
 * serveur (le compte n'existe plus), on efface tout ce que l'appareil en garde.
 */
export async function apresSuppressionDuCompte(): Promise<void> {
  await viderFile().catch(() => undefined)
  await purgeLocalSession()
}

/**
 * À demander avant une déconnexion volontaire. La déconnexion efface les
 * saisies pas encore envoyées : on ne le fait pas sans le dire.
 *
 * Une session qui expire ne passe pas par ici et n'efface rien : la file
 * attend que le même compte se reconnecte.
 */
export function confirmerDeconnexion(): boolean {
  const n = saisiesEnAttente()
  if (n === 0) return true
  const quoi = n > 1 ? `${n} saisies n'ont pas encore été envoyées` : "Une saisie n'a pas encore été envoyée"
  return window.confirm(`${quoi} au serveur. En vous déconnectant, vous ${n > 1 ? 'les' : 'la'} perdez. Se déconnecter quand même ?`)
}

/**
 * Déconnexion volontaire : révoque le refresh token côté serveur (sinon il reste
 * valide 7 jours) puis purge l'appareil, file d'envoi comprise. La purge a lieu
 * même si le serveur est injoignable (chantier hors-ligne).
 */
export async function logout(): Promise<void> {
  const { refreshToken } = useAuth.getState()
  // L'iPhone cesse de recevoir les notifications de ce compte : à faire tant que
  // la session est encore valide.
  await oublierCetAppareil().catch(() => undefined)
  if (refreshToken) {
    const { api } = await import('@/lib/api')
    await api.auth.logout(refreshToken).catch(() => undefined)
  }
  await viderFile().catch(() => undefined)
  await purgeLocalSession()
}
