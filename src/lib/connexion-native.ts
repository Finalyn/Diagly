import { registerPlugin } from '@capacitor/core'
import { api, BASE_URL } from '@/lib/api'
import type { AuthResponse } from '@/lib/api-types'
import type { EtapeDoubleAuth } from '@/lib/api'

// Connexion avec Apple ou Google, dans l'app iPhone/iPad seulement. Le plugin
// natif est dans le projet iOS (ios/App/App/ConnexionPlugin.swift).

interface PluginConnexion {
  apple(): Promise<{ identityToken: string; authorizationCode?: string; givenName?: string; familyName?: string; email?: string }>
  /**
   * Avec `pkce`, le plugin tire un secret, ajoute son empreinte à l'adresse
   * (`challenge`) et rend le secret (`verifier`) avec l'adresse de retour.
   */
  web(options: { url: string; schema: string; pkce?: boolean }): Promise<{ url: string; verifier?: string }>
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
 * flux que sur le site, mais revient sur ch.diagly.app://oauth-callback avec un
 * simple code : une autre app peut déclarer cette adresse, le retour ne porte
 * donc pas de jetons. Le code ne s'échange qu'avec le secret que le plugin a
 * gardé (PKCE) ; l'échange rend la session, ou l'étape du code 2FA.
 */
export async function connexionGoogle(): Promise<IssueConnexion> {
  let r: { url: string; verifier?: string }
  try {
    r = await Connexion.web({ url: `${BASE_URL}/api/auth/google?app=1`, schema: SCHEMA, pkce: true })
  } catch (e) {
    if (annulee(e)) throw new ConnexionAnnulee()
    throw e
  }
  const [adresse, fragment = ''] = r.url.split('#')
  const requete = new URLSearchParams(adresse.split('?')[1] ?? '')
  const erreur = new URLSearchParams(fragment).get('error') ?? requete.get('error')
  if (erreur) throw new Error(erreur)

  const code = requete.get('code')
  if (!code || !r.verifier) throw new Error('Connexion Google échouée.')
  return api.auth.echangeApp({ code, verifier: r.verifier })
}
