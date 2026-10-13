import type { ApiDiagnosticItem } from '@/lib/api-types'
import { useAuth } from '@/stores/auth'
import { superposer, type Operation } from './operations'

/**
 * L'état de la file d'envoi en mémoire, partagé entre le moteur (file-envoi.ts),
 * la couche d'API (qui superpose la file à ce que renvoie le serveur) et
 * l'interface (bandeau, compteurs).
 *
 * Module sans dépendance vers l'API : api.ts le lit, file-envoi.ts l'écrit,
 * sans cycle d'import entre les deux.
 */

/**
 * Une saisie que le serveur a refusée pour de bon (relevé supprimé ailleurs,
 * donnée invalide). Gardée sur l'appareil comme la file, avec l'opération et
 * donc son compte : seul ce compte-là la voit.
 */
export interface Refus {
  operation: Operation
  raison: string
  le: number
}

export interface EtatFile {
  /** Les saisies en attente, dans l'ordre d'envoi. */
  file: Operation[]
  /** L'opération dont la requête est sur le réseau. */
  enVol: string | null
  /**
   * Le dernier essai n'a pas atteint le serveur alors que l'appareil se dit
   * connecté (sous-sol avec une barre de réseau, Wi-Fi sans Internet). Un
   * nouvel essai est programmé.
   */
  injoignable: boolean
  refus: Refus[]
  /** Vrai une fois la file relue depuis l'appareil au démarrage. */
  chargee: boolean
}

let etat: EtatFile = { file: [], enVol: null, injoignable: false, refus: [], chargee: false }
const abonnes = new Set<() => void>()

export function lireEtat(): EtatFile {
  return etat
}

export function poserEtat(modif: Partial<EtatFile>): void {
  etat = { ...etat, ...modif }
  for (const f of abonnes) f()
}

export function abonner(f: () => void): () => void {
  abonnes.add(f)
  return () => { abonnes.delete(f) }
}

/** Les relevés d'un diagnostic, avec ce que le compte connecté a encore à envoyer. */
export function avecSaisiesEnAttente(releves: ApiDiagnosticItem[], diagnosticId: string): ApiDiagnosticItem[] {
  if (!etat.file.length) return releves
  return superposer(releves, etat.file, diagnosticId, useAuth.getState().user?.id ?? null)
}
