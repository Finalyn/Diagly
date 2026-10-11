/**
 * La marque d'un rapport : celle du bureau, sauf si le dossier en décide autrement.
 *
 * Les réglages portent la marque par défaut, celle qui va sur tous les
 * rapports. Un dossier peut s'en écarter : un mandat pour une régie qui
 * demande ses propres couleurs, un rapport à envoyer sans logo. La règle est
 * simple et vaut pour les trois champs : ce que le dossier dit gagne, ce qu'il
 * ne dit pas vient des réglages.
 *
 * Séparé des écrans pour être vérifiable : une fusion fautive ne se voit pas à
 * l'édition, elle se voit sur le document du client.
 */

export interface MarqueDuBureau {
  name?: string | null
  address?: string | null
  postalCode?: string | null
  city?: string | null
  logo?: string | null
  accentColor?: string | null
}

/** Ce qu'un dossier peut imposer. */
export interface MarqueDuDossier {
  /** Raison sociale affichée sur ce rapport. */
  name?: string | null
  /** Auteur affiché, quand ce n'est pas celui qui édite. */
  auteur?: string | null
  accentColor?: string | null
  logo?: string | null
  /** true : ce rapport part sans logo, quel que soit celui du bureau. */
  sansLogo?: boolean | null
}

export interface Marque {
  name: string | null
  address: string | null
  postalCode: string | null
  city: string | null
  logo: string | null
  /**
   * Vrai quand le dossier a demandé de n'en mettre aucun.
   *
   * À distinguer d'un logo absent : sans logo enregistré, le document porte
   * celui de Diagly, parce qu'un en-tête vide ressemble à une page oubliée.
   * Ici, c'est un choix, et il doit être tenu.
   */
  sansLogo: boolean
  accentColor: string | null
  auteur: string | null
}

/** La couleur employée faute de choix. */
export const ACCENT_PAR_DEFAUT = '#3b82f6'

/**
 * La marque effective d'un rapport.
 *
 * `sansLogo` l'emporte sur tout, y compris sur un logo propre au dossier :
 * c'est une intention explicite, et elle doit être respectée même si l'on a
 * importé une image avant de changer d'avis.
 */
export function marqueDuRapport(
  bureau: MarqueDuBureau | null | undefined,
  dossier: MarqueDuDossier | null | undefined,
  auteurParDefaut = '',
): Marque {
  const d = dossier ?? {}
  const b = bureau ?? {}
  return {
    name: valeur(d.name) ?? valeur(b.name),
    address: valeur(b.address),
    postalCode: valeur(b.postalCode),
    city: valeur(b.city),
    logo: d.sansLogo ? null : valeur(d.logo) ?? valeur(b.logo),
    sansLogo: Boolean(d.sansLogo),
    accentColor: valeur(d.accentColor) ?? valeur(b.accentColor) ?? ACCENT_PAR_DEFAUT,
    auteur: valeur(d.auteur) ?? valeur(auteurParDefaut),
  }
}

/** Une chaîne vide n'est pas un choix : elle laisse passer la valeur suivante. */
const valeur = (v: string | null | undefined): string | null => {
  const t = (v ?? '').trim()
  return t === '' ? null : t
}

/** Vrai quand le dossier s'écarte vraiment des réglages du bureau. */
export function dossierPersonnalise(d: MarqueDuDossier | null | undefined): boolean {
  if (!d) return false
  return Boolean(valeur(d.name) || valeur(d.auteur) || valeur(d.accentColor) || valeur(d.logo) || d.sansLogo)
}
