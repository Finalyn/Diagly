import { registerPlugin } from '@capacitor/core'
import { api, BASE_URL } from '@/lib/api'
import type { AuthResponse, ApiUser } from '@/lib/api-types'
import type { EtapeDoubleAuth } from '@/lib/api'

// Connexion avec Apple ou Google, dans l'app iPhone/iPad seulement. Le plugin
// natif est dans le projet iOS (ios/App/App/ConnexionPlugin.swift).

interface PluginConnexion {
  apple(): Promise<{ identityToken: string; authorizationCode?: string; givenName?: string; familyName?: string; email?: string }>
  web(options: { url: string; schema: string }): Promise<{ url: string }>
}

const Connexion = registerPlugin<PluginConnexion>('Connexion')

/** L'adresse de retour de Google vers l'app (la même côté serveur, routes/auth.ts). */
const SCHEMA = 'ch.diagly.app'

/** Ce qu'une connexion produit : un compte ouvert, ou l'étape du code 2FA. */
export type IssueConnexion = AuthResponse | EtapeDoubleAuth

/** La personne a fermé la fenêtre : ce n'est pas une erreur à afficher. */
export class ConnexionAnnulee extends Error {}

const annulee = (e: unknown) => (e as { code?: string })?.code === 'ANNULE'

export async function connexionApple(): Promise<IssueConnexion> {
  let r
  try {
    r = await Connexion.apple()
  } catch (e) {
    if (annulee(e)) throw new ConnexionAnnulee()
    throw e
  }
  return api.auth.apple({
    identityToken: r.identityToken,
    authorizationCode: r.authorizationCode,
    firstName: r.givenName,
    lastName: r.familyName,
  })
}

/**
 * Google, dans la fenêtre de connexion sécurisée d'iOS. Le serveur mène le même
 * flux que sur le site et revient sur ch.diagly.app://oauth-callback, avec le
 * même fragment : les jetons, l'étape du code 2FA, ou une erreur.
 */
export async function connexionGoogle(): Promise<IssueConnexion> {
  let retour: string
  try {
    retour = (await Connexion.web({ url: `${BASE_URL}/api/auth/google?app=1`, schema: SCHEMA })).url
  } catch (e) {
    if (annulee(e)) throw new ConnexionAnnulee()
    throw e
  }
  const p = new URLSearchParams(retour.split('#')[1] ?? '')
  const erreur = p.get('error')
  if (erreur) throw new Error(erreur)

  const ticket = p.get('ticket')
  if (p.get('twoFactorRequired') === '1' && ticket) {
    const methode = p.get('method') === 'email' ? 'email' : 'totp'
    return { twoFactorRequired: true, ticket, method: methode, email: p.get('email') ?? undefined }
  }

  const accessToken = p.get('accessToken')
  const refreshToken = p.get('refreshToken')
  if (!accessToken || !refreshToken) throw new Error('Connexion Google échouée.')
  // Le profil, avec le jeton qu'on vient de recevoir (il n'est pas encore dans le store).
  const r = await fetch(`${BASE_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!r.ok) throw new Error('Session invalide, réessayez.')
  const { user } = (await r.json()) as { user: ApiUser }
  return { user, accessToken, refreshToken }
}
