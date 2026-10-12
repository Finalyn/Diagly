import { api } from '@/lib/api'
import { queryClient } from '@/lib/query-client'

/**
 * Prépare un dossier pour une visite sans réseau.
 *
 * Sans cela, le relevé hors-ligne ne marchait que pour ce qu'on avait ouvert
 * avant de partir : un dossier jamais affiché sur le téléphone, ou la base CFC
 * jamais chargée, et l'éditeur restait vide au sous-sol. On charge ici, avec
 * les mêmes clés que les écrans, tout ce que le relevé et le sommaire du
 * dossier demandent. Le cache des requêtes est persisté sur l'appareil : il
 * survit à la fermeture de l'app.
 *
 * Les plans n'y sont pas : sur téléphone, ils se travaillent au bureau.
 */
export async function preparerPourLeTerrain(projetId: string): Promise<void> {
  const frais = { staleTime: 0 }
  const { diagnostics } = await queryClient.fetchQuery({
    queryKey: ['project', projetId], queryFn: () => api.projects.get(projetId), ...frais,
  })
  await Promise.all([
    queryClient.fetchQuery({ queryKey: ['visite', projetId], queryFn: () => api.visite.get(projetId), ...frais }),
    queryClient.fetchQuery({ queryKey: ['base-cfc'], queryFn: () => api.cfc.base(), ...frais }),
    ...diagnostics.flatMap((d) => [
      queryClient.fetchQuery({ queryKey: ['diagnostic', d.id], queryFn: () => api.diagnostics.get(d.id), ...frais }),
      queryClient.fetchQuery({ queryKey: ['diagnostic-items', d.id], queryFn: () => api.diagnostics.listItems(d.id), ...frais }),
    ]),
  ])
  noterPreparation(projetId)
}

// La date de préparation, par dossier, sur cet appareil. Une commodité
// d'affichage : perdue, elle ne coûte qu'un « Préparer » de plus.
const CLE = 'diagly.terrain'

function lireDates(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(CLE) ?? '{}') as Record<string, string> } catch { return {} }
}

function noterPreparation(projetId: string): void {
  try { localStorage.setItem(CLE, JSON.stringify({ ...lireDates(), [projetId]: new Date().toISOString() })) } catch { /* stockage indisponible */ }
}

/** Quand ce dossier a été préparé sur cet appareil, ou null. */
export function datePreparation(projetId: string): Date | null {
  const d = lireDates()[projetId]
  return d ? new Date(d) : null
}

/**
 * Le cache persisté n'est relu que s'il a moins de sept jours (main.tsx) :
 * au-delà, une préparation ne garantit plus rien.
 */
export const DUREE_PREPARATION_MS = 7 * 24 * 60 * 60 * 1000
