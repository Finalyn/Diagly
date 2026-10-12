// Recharger la page quand un fichier de code manque ou ne se charge pas : un
// onglet ouvert pendant une mise en ligne, ou un cache du service worker qui
// garde une mauvaise version. Voir components/FiletDeSecurite.tsx.

const CLE = 'diagly.rechargement'

/** Un fichier de code introuvable ou illisible (version précédente, cache abîmé). */
function fichierDeCodeIntrouvable(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err)
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|Unable to preload|Failed to fetch|MIME type/i.test(m)
}

/**
 * Recharge en repartant de zéro : caches du service worker vidés et service
 * worker désinscrit (il se réinstalle au chargement suivant). Un simple
 * rechargement repassait par le même cache, qui resservait le même fichier
 * abîmé : la page tournait en boucle.
 */
export async function rechargerProprement(): Promise<void> {
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
 */
export function rechargerUneFois(err: unknown): never {
  if (fichierDeCodeIntrouvable(err)) {
    let dernier = 0
    try { dernier = Number(sessionStorage.getItem(CLE) ?? 0) } catch { /* stockage indisponible */ }
    if (Date.now() - dernier > 60_000) {
      try { sessionStorage.setItem(CLE, String(Date.now())) } catch { /* idem */ }
      void rechargerProprement()
    }
  }
  throw err
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
