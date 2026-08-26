import { del } from 'idb-keyval'
import { useAuth } from '@/stores/auth'
import { queryClient, QUERY_CACHE_KEY } from '@/lib/query-client'

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
 * Déconnexion volontaire : révoque le refresh token côté serveur (sinon il reste
 * valide 7 jours) puis purge l'appareil. La purge a lieu même si le serveur est
 * injoignable (chantier hors-ligne).
 */
export async function logout(): Promise<void> {
  const { refreshToken } = useAuth.getState()
  if (refreshToken) {
    const { api } = await import('@/lib/api')
    await api.auth.logout(refreshToken).catch(() => undefined)
  }
  await purgeLocalSession()
}
