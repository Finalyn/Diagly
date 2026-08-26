import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { get, set, del } from 'idb-keyval'
import './index.css'
import App from './App.tsx'
import { queryClient, QUERY_CACHE_KEY } from '@/lib/query-client'

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

// PWA : enregistre le service worker (installable + offline).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}
