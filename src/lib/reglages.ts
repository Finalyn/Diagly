/**
 * Ce que les réglages savent dire sans qu'on ouvre chaque section.
 *
 * Une page de réglages qui se contente de lister des formulaires oblige à
 * cliquer partout pour savoir où l'on en est : la double authentification
 * est-elle active, le logo est-il posé, les rapports partiront-ils avec une
 * adresse ? Ce module répond à ces questions, et sert les deux repères que
 * l'écran affiche : une pastille par section, et l'effet des valeurs par
 * défaut sur un montant.
 *
 * Il est à part de l'écran pour être vérifiable : ce qui dit « tout va bien »
 * ne doit pas le dire à tort.
 */

import { cascadeDe } from './devis'

export type EtatDeSection = 'complet' | 'attention' | 'incomplet'

export interface Pastille {
  etat: EtatDeSection
  /** Deux ou trois mots, affichés à côté du nom de la section. */
  mention: string | null
}

export interface IdentiteDuBureau {
  name?: string
  address?: string
  postalCode?: string
  city?: string
  canton?: string
  vatNumber?: string
  iban?: string
  logo?: string | null
  accentColor?: string
}

/** Les champs qui manquent à l'identité, nommés comme sur le formulaire. */
export function champsManquantsDuBureau(c: IdentiteDuBureau | undefined): string[] {
  const attendus: [keyof IdentiteDuBureau, string][] = [
    ['name', 'raison sociale'],
    ['address', 'adresse'],
    ['postalCode', 'NPA'],
    ['city', 'ville'],
  ]
  return attendus.filter(([k]) => !String(c?.[k] ?? '').trim()).map(([, nom]) => nom)
}

/**
 * L'état de la section « Entreprise ».
 *
 * Ces informations partent en tête des rapports : un rapport sans raison
 * sociale ni adresse ne dit pas qui l'a écrit. Le logo manque souvent et ne
 * rend pas le rapport faux, d'où l'avertissement plutôt que le manque.
 */
export function etatDuBureau(c: IdentiteDuBureau | undefined): Pastille {
  const manquants = champsManquantsDuBureau(c)
  if (manquants.length > 0) return { etat: 'incomplet', mention: `${manquants.length} champ${manquants.length > 1 ? 's' : ''} à remplir` }
  if (!c?.logo) return { etat: 'attention', mention: 'sans logo' }
  return { etat: 'complet', mention: null }
}

/** L'état de la section « Sécurité ». */
export function etatDeLaSecurite(doubleAuthentification: boolean): Pastille {
  return doubleAuthentification
    ? { etat: 'complet', mention: 'double authentification active' }
    : { etat: 'attention', mention: 'mot de passe seul' }
}

export interface ProfilDuCompte {
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
}

/**
 * L'état de la section « Profil ».
 *
 * Le nom signe les rapports : sans lui, le client lit un document anonyme. Le
 * téléphone ne manque qu'à moitié, il sert à être rappelé.
 */
export function etatDuProfil(p: ProfilDuCompte | undefined): Pastille {
  const nom = [p?.firstName, p?.lastName].filter((v) => String(v ?? '').trim()).length
  if (nom === 0) return { etat: 'incomplet', mention: 'sans nom' }
  if (!String(p?.phone ?? '').trim()) return { etat: 'attention', mention: 'sans téléphone' }
  return { etat: 'complet', mention: null }
}

export interface ValeursParDefaut {
  honoraryPct: number
  reservePct: number
  vatPct: number
}

export interface EtapeDuCalcul {
  libelle: string
  montant: number
}

/**
 * L'effet des valeurs par défaut sur un montant, étape par étape.
 *
 * Trois pourcentages posés dans un formulaire ne disent rien ; la même chose
 * appliquée à cent mille francs se lit d'un coup, et c'est exactement la
 * cascade que le devis appliquera, puisque c'est elle qu'on appelle ici.
 */
export function apercuDesValeurs(v: ValeursParDefaut, travaux = 100_000): EtapeDuCalcul[] {
  const c = cascadeDe(travaux, v.honoraryPct, v.reservePct)
  return [
    { libelle: 'Travaux', montant: c.ht },
    { libelle: `Honoraires ${v.honoraryPct} %`, montant: c.honoraires },
    { libelle: `Réserve ${v.reservePct} %`, montant: c.reserve },
    { libelle: `TVA ${v.vatPct} %`, montant: c.sousTotal * (v.vatPct / 100) },
    { libelle: 'Total TTC', montant: c.sousTotal * (1 + v.vatPct / 100) },
  ]
}

/** Vrai quand un brouillon s'écarte de ce qui est enregistré. */
export function aChange<T>(brouillon: T, reference: T): boolean {
  return JSON.stringify(brouillon) !== JSON.stringify(reference)
}

/** Les initiales d'une personne, ou la première lettre de son adresse. */
export function initiales(p: { firstName?: string | null; lastName?: string | null; email?: string }): string {
  const deux = ((p.firstName?.[0] ?? '') + (p.lastName?.[0] ?? '')).trim()
  if (deux) return deux.toUpperCase()
  return (p.email?.[0] ?? 'U').toUpperCase()
}

/** Le nom affiché d'une personne, ou son adresse à défaut. */
export function nomAffiche(p: { firstName?: string | null; lastName?: string | null; email?: string }): string {
  const nom = [p.firstName, p.lastName].filter(Boolean).join(' ').trim()
  return nom || p.email || 'Mon compte'
}
