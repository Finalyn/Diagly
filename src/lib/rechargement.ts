// Recharger la page quand un fichier de code d'une version précédente manque
// (onglet ouvert pendant une mise en ligne). Voir components/FiletDeSecurite.tsx.

const CLE = 'diagly.rechargement'

/** Un fichier de code d'une version précédente, introuvable depuis la mise en ligne. */
function fichierDeVersionPrecedente(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err)
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|Failed to fetch|MIME type/i.test(m)
}

/**
 * Un onglet ouvert avant une mise en ligne demande, en changeant de page, un
 * fichier de code de l'ancienne version, effacé depuis : on recharge la page
 * une fois, ce qui charge la nouvelle version. Une seule fois par minute : si
 * le fichier manque encore après rechargement, c'est une autre panne, et elle
 * doit se voir (FiletDeSecurite).
 */
export function rechargerUneFois(err: unknown): never {
  if (fichierDeVersionPrecedente(err)) {
    let dernier = 0
    try { dernier = Number(sessionStorage.getItem(CLE) ?? 0) } catch { /* stockage indisponible */ }
    if (Date.now() - dernier > 60_000) {
      try { sessionStorage.setItem(CLE, String(Date.now())) } catch { /* idem */ }
      window.location.reload()
    }
  }
  throw err
}

// Le préchargement de Vite échoue de la même façon avant même l'import.
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault()
  try { rechargerUneFois((e as Event & { payload?: unknown }).payload ?? new Error('Failed to fetch dynamically imported module')) } catch { /* rechargement lancé ou déjà tenté */ }
})
