import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { get, set, del } from 'idb-keyval'
import './index.css'
import App from './App.tsx'
import { queryClient, QUERY_CACHE_KEY } from '@/lib/query-client'
import { estAppNative } from '@/lib/plateforme'
import { demarrerNatif } from '@/lib/natif'
import { chargerFile } from '@/lib/hors-ligne/file-envoi'
import { rattraperLesStyles } from '@/lib/rechargement'

// Persistance du cache (requêtes + mutations en attente) sur IndexedDB : les données
// restent disponibles hors-ligne et au redémarrage de l'app (chantier, sous-sol).
const persister = createAsyncStoragePersister({
  key: QUERY_CACHE_KEY,
  throttleTime: 1000,
  storage: {
    getItem: (k) => get(k),
    setItem: (k, v) => set(k, v),
    removeItem: (k) => del(k),
  },
})

demarrerNatif()
rattraperLesStyles()

// La file d'envoi des relevés (lib/hors-ligne) est relue avant le premier
// affichage : la première liste montrée contient déjà les saisies pas encore
// envoyées. La lecture prend quelques millisecondes ; si elle traîne, on
// n'attend pas plus d'une seconde, et la file rafraîchit les listes à la fin.
Promise.race([chargerFile(), new Promise((r) => setTimeout(r, 1000))]).finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 7 }}
        // Au restore du cache : on relance les mutations mises en pause hors-ligne.
        onSuccess={() => { queryClient.resumePausedMutations() }}
      >
        <App />
      </PersistQueryClientProvider>
    </StrictMode>,
  )
})

// PWA : enregistre le service worker (installable + offline). Pas dans l'app
// iPhone/iPad : elle embarque déjà tout le front, et WebKit n'y autorise pas les
// service workers (origine capacitor://).
if ('serviceWorker' in navigator && !estAppNative) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}
