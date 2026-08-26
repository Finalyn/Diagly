import { QueryClient } from '@tanstack/react-query'

/** Clé du cache react-query persisté sur IndexedDB (partagée avec la purge de session). */
export const QUERY_CACHE_KEY = 'diagly-query-cache'

// Client partagé : instancié ici (et non dans main.tsx) pour que la déconnexion
// puisse vider le cache mémoire en plus du cache persisté.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // 7 jours : on garde les données en cache pour la consultation hors-ligne.
      gcTime: 1000 * 60 * 60 * 24 * 7,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})
