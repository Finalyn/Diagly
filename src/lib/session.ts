import { del } from 'idb-keyval'
import { useAuth } from '@/stores/auth'
import { queryClient, QUERY_CACHE_KEY } from '@/lib/query-client'
import { saisiesEnAttente, oublierSaisiesDuCompte } from '@/lib/hors-ligne/file-envoi'
import { oublierPreparations } from '@/lib/hors-ligne/preparer'
import { oublierConversations } from '@/lib/conversations'
import { unsubscribePush } from '@/lib/push-client'

/**
 * Efface TOUTE trace locale de la session. Indispensable sur un appareil partagé
 * (tablette de chantier) : sans ça, le compte suivant retrouve les diagnostics,
 * adresses et photos du précédent dans le cache hors-ligne.
 *
 * Couvre : jetons (store persisté), cache react-query en mémoire ET sur IndexedDB
 * (avec les mutations hors-ligne en attente), conversations de l'assistant et
 * dates de préparation des dossiers, caches du service worker contenant des
 * données (`/api` et `/uploads`). Le cache du shell et des assets est conservé :
 * il ne contient rien de personnel et l'app reste installable hors-ligne.
 *
 * La file d'envoi des relevés n'en fait pas partie : une session qui expire
 * passe aussi par ici, et ses saisies attendent le retour du même compte. La
 * déconnexion volontaire efface celles du compte qui part (logout).
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

  // Hors du cache des requêtes, mais tout aussi personnels : les conversations
  // citent adresses et diagnostics, et une date de préparation promettrait un
  // dossier dont le cache vient de partir.
  oublierConversations()
  oublierPreparations()

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
 * Les saisies d'un autre compte de l'appareil, elles, restent.
 */
export async function apresSuppressionDuCompte(): Promise<void> {
  const utilisateurId = useAuth.getState().user?.id
  // Plus de compte à prévenir : l'abonnement est retiré de l'appareil seulement.
  await unsubscribePush(false).catch(() => undefined)
  if (utilisateurId) await oublierSaisiesDuCompte(utilisateurId).catch(() => undefined)
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
 * valide 7 jours) puis purge l'appareil, saisies en attente de ce compte
 * comprises. La purge a lieu même si le serveur est injoignable (chantier
 * hors-ligne). Les saisies qu'un autre compte a laissées sur l'appareil
 * (tablette partagée) restent : elles attendent son retour.
 */
export async function logout(): Promise<void> {
  const { refreshToken, user } = useAuth.getState()
  // L'appareil cesse de recevoir les notifications de ce compte. Le serveur est
  // prévenu tant que la session est encore valide ; l'abonnement est retiré de
  // l'appareil même s'il ne répond pas (hors-ligne), sans quoi le compte
  // suivant recevrait celles du précédent.
  await unsubscribePush().catch(() => undefined)
  if (refreshToken) {
    const { api } = await import('@/lib/api')
    await api.auth.logout(refreshToken).catch(() => undefined)
  }
  if (user) await oublierSaisiesDuCompte(user.id).catch(() => undefined)
  await purgeLocalSession()
}
