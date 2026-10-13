// Recharger la page quand un fichier de code manque ou ne se charge pas : un
// onglet ouvert pendant une mise en ligne, ou un cache du service worker qui
// garde une mauvaise version. Voir components/FiletDeSecurite.tsx. Hors
// connexion, rien de tout cela : voir estHorsLigne.

import { estAppNative } from './plateforme'

const CLE = 'diagly.rechargement'

/** Un fichier de code introuvable ou illisible (version précédente, cache abîmé). */
export function fichierDeCodeIntrouvable(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err)
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|Unable to preload|Failed to fetch|MIME type/i.test(m)
}

/**
 * Hors connexion, d'après le navigateur. Un écran dont le code n'a jamais été
 * chargé ne peut pas s'ouvrir sans réseau : ce n'est pas un cache abîmé, et
 * rien ne doit être purgé.
 */
export function estHorsLigne(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/**
 * Le serveur répond-il ? Pendant une mise en ligne (Build, redémarrage), il
 * se tait de quelques secondes à quelques minutes : recharger à ce moment-là
 * remplaçait l'app par la page d'erreur du navigateur. /health n'est jamais
 * servi par le cache du service worker (sw.js).
 *
 * Dans l'app iPhone/iPad, le code est embarqué : il ne dépend pas du serveur,
 * la question ne se pose pas.
 */
export async function serveurJoignable(): Promise<boolean> {
  if (estAppNative) return true
  try {
    const r = await fetch('/health', { cache: 'no-store' })
    return r.ok
  } catch {
    return false
  }
}

/**
 * Recharge en repartant de zéro : caches du service worker vidés et service
 * worker désinscrit (il se réinstalle au chargement suivant). Un simple
 * rechargement repassait par le même cache, qui resservait le même fichier
 * abîmé : la page tournait en boucle.
 *
 * Jamais hors connexion : on désinscrivait le service worker et on effaçait
 * l'application gardée sur l'appareil, puis on rechargeait sans réseau. Le
 * relevé devenait inutilisable jusqu'au retour de la connexion, alors que
 * seul un écran manquait. Dans ce cas, on ne touche à rien.
 */
export async function rechargerProprement(): Promise<void> {
  if (estHorsLigne()) return
  // Serveur muet (mise en ligne en cours) : on ne touche à rien, le filet de
  // sécurité réessaie tout seul (FiletDeSecurite).
  if (!(await serveurJoignable())) return
  try {
    const enregistrements = await navigator.serviceWorker?.getRegistrations?.() ?? []
    await Promise.all(enregistrements.map((r) => r.unregister()))
  } catch { /* pas de service worker */ }
  try {
    const cles = await caches.keys()
    // Seulement le code et les fichiers : les données gardées pour le
    // hors-ligne restent (react-query et la file d'envoi n'y sont pas).
    await Promise.all(cles.filter((k) => !k.startsWith('diagly-api')).map((k) => caches.delete(k)))
  } catch { /* Cache API indisponible */ }
  window.location.reload()
}

/**
 * Un fichier de code manque : on recharge proprement, une fois par minute au
 * plus. Si le fichier manque encore juste après, c'est une autre panne, et elle
 * doit se voir (FiletDeSecurite) plutôt que tourner en boucle.
 *
 * Hors connexion, l'échec est attendu (l'écran n'a jamais été ouvert en
 * ligne) : ni purge ni rechargement, et la minute de garde n'est pas
 * consommée, pour que le rechargement reste possible au retour du réseau.
 * FiletDeSecurite propose alors de revenir à la liste des diagnostics.
 */
export function rechargerUneFois(err: unknown): never {
  if (fichierDeCodeIntrouvable(err) && !estHorsLigne()) void rechargerDesQuePermis()
  throw err
}

/** L'adresse du fichier de code qui a échoué, lue dans le message d'erreur. */
export function fichierEnCause(err: unknown): string | null {
  const m = (err instanceof Error ? err.message : String(err)).match(/https?:\/\/\S+?\.(?:m?js|css)\b/)
  return m ? m[0] : null
}

/** Le fichier répond-il de nouveau ? (HEAD : le service worker ne s'en mêle pas.) */
async function fichierDeNouveauLa(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-store' })
    return r.ok
  } catch {
    return false
  }
}

const CLE_REPRISES = 'diagly.reprises'

/** Trois reprises immédiates au plus en cinq minutes : au-delà, une panne qui dure doit se voir. */
function reprisePermise(): boolean {
  let liste: number[] = []
  try { liste = JSON.parse(sessionStorage.getItem(CLE_REPRISES) ?? '[]') as number[] } catch { /* stockage indisponible */ }
  const recentes = liste.filter((t) => Date.now() - t < 5 * 60_000)
  if (recentes.length >= 3) return false
  try { sessionStorage.setItem(CLE_REPRISES, JSON.stringify([...recentes, Date.now()])) } catch { /* idem */ }
  return true
}

/**
 * Pour le filet de sécurité, qui réessaie toutes les quelques secondes. Si le
 * fichier qui a échoué répond de nouveau (le serveur redémarrait), on
 * recharge sans attendre la minute de garde : le rechargement ne peut pas
 * boucler sur un fichier présent. Sinon, la règle habituelle.
 */
export async function reprendreApres(err: unknown): Promise<boolean> {
  if (estHorsLigne()) return false
  const url = fichierEnCause(err)
  if (url && await serveurJoignable() && await fichierDeNouveauLa(url) && reprisePermise()) {
    await rechargerProprement()
    return true
  }
  return rechargerDesQuePermis()
}

/**
 * Recharge proprement, une fois par minute au plus, et seulement si le
 * serveur répond. Serveur muet, la minute de garde n'est pas consommée : le
 * rechargement partira dès son retour (FiletDeSecurite réessaie).
 */
export async function rechargerDesQuePermis(): Promise<boolean> {
  if (estHorsLigne()) return false
  let dernier = 0
  try { dernier = Number(sessionStorage.getItem(CLE) ?? 0) } catch { /* stockage indisponible */ }
  if (Date.now() - dernier <= 60_000) return false
  if (!(await serveurJoignable())) return false
  try { sessionStorage.setItem(CLE, String(Date.now())) } catch { /* idem */ }
  await rechargerProprement()
  return true
}

// Vite signale aussi l'échec d'un préchargement. Pour un fichier de code, on
// ne l'empêche pas d'échouer (preventDefault rendrait un module vide, et
// l'écran planterait plus loin sur une erreur incompréhensible) : l'import
// échoue et passe par rechargerUneFois (App.tsx, `named`).
//
// Une feuille de style, elle, ne doit pas faire tomber la page : sans elle,
// l'écran s'affiche, un peu moins joli, et on la redemande à part. L'adresse
// change (?r=) pour ne pas retomber sur une copie abîmée gardée par le
// navigateur : un style manquant (carte Leaflet de la vitrine) bloquait tout
// l'écran, et « Recharger » ressortait la même copie.
export function rattraperLesStyles(): void {
  window.addEventListener('vite:preloadError', (e) => {
    const erreur = (e as Event & { payload?: unknown }).payload
    const message = erreur instanceof Error ? erreur.message : String(erreur)
    const fichier = /^Unable to preload CSS for (\S+)/.exec(message)?.[1]
    if (!fichier) return
    e.preventDefault()
    const lien = document.createElement('link')
    lien.rel = 'stylesheet'
    lien.href = `${fichier}${fichier.includes('?') ? '&' : '?'}r=${Date.now()}`
    document.head.appendChild(lien)
  })
}
