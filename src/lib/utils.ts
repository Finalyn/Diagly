import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCHF(amount: number): string {
  return new Intl.NumberFormat('fr-CH', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount) + ' CHF'
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' }).format(date)
}

/**
 * Prix unitaire, avec ses décimales quand il en a.
 *
 * `formatCHF` arrondit au franc, ce qui convient à un montant mais pas à un prix
 * unitaire : un devis affichait « 840 m² × 112 CHF = 94 332 CHF » là où le prix
 * réel était 112,30. Le lecteur refaisait la multiplication, tombait sur 94 080,
 * et doutait du total alors que c'est l'affichage qui mentait.
 */
export function formatPrixUnitaire(montant: number): string {
  const decimales = Math.round(montant * 100) % 100 === 0 ? 0 : 2
  return new Intl.NumberFormat('fr-CH', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(montant) + ' CHF'
}
