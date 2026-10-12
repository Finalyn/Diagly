import { useQuery } from '@tanstack/react-query'
import { api } from '../api'

/**
 * La base du bureau, chargée une fois par session de travail.
 *
 * Une heure de fraîcheur : le catalogue ne change pas pendant une visite, et
 * le relire à chaque écran coûterait cent quarante kilo-octets pour rien. Le
 * cache de react-query est persisté, donc une visite hors réseau garde la base
 * qu'elle a chargée avant de partir sur le terrain.
 */
const STABLE = 60 * 60 * 1000

export function useBaseCfc({ toujoursRelire = false }: { toujoursRelire?: boolean } = {}) {
  return useQuery({
    queryKey: ['base-cfc'],
    queryFn: () => api.cfc.base(),
    // Une base vide n'est jamais tenue pour fraîche : gardée telle quelle une
    // heure, elle laissait la page vide après l'import de la base en production.
    staleTime: (q) => (q.state.data?.articles?.length ? STABLE : 0),
    // La page qui édite la base la relit à chaque arrivée : une correction faite
    // depuis un autre poste doit s'y voir. Hors réseau, la copie gardée reste.
    refetchOnMount: toujoursRelire ? 'always' : true,
  })
}

/** La nomenclature CFC, pour l'arborescence et les libellés du devis. */
export function useNomenclatureCfc(actif = true) {
  return useQuery({
    queryKey: ['base-cfc-nomenclature'],
    queryFn: () => api.cfc.baseNomenclature(),
    staleTime: STABLE,
    enabled: actif,
  })
}
