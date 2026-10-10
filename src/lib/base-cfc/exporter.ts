/**
 * De la base au classeur : l'aller-retour.
 *
 * Le bureau travaille dans Excel, et il doit pouvoir continuer : sortir la
 * base, la relire, la corriger à vingt lignes d'un coup, la réimporter. Cela
 * n'a de valeur que si le fichier produit se relit vraiment, c'est-à-dire si
 * chaque colonne reprend la forme que l'import sait lire. Les tests de ce
 * module font donc l'aller-retour en entier : on construit les lignes, on les
 * redonne à l'assembleur, et on vérifie qu'il retrouve l'article d'origine.
 *
 * Les colonnes dérivées du classeur d'origine (libellé CFC, groupe CFC, prix
 * total de l'état moyen, étapes en toutes lettres) sont recalculées : elles
 * aident à la lecture dans Excel, et l'import les ignore.
 */

import type { BaseQuantite, EtatArticle, Unite } from './normaliser'
import { prixUnitaire } from './prix'

/** Ce qu'il faut savoir d'un article pour l'écrire au classeur. */
export interface ArticleAExporter {
  id: string
  cfcCode: string
  nom: string
  domaineRapport: string
  groupeAlternatives: string | null
  echafaudage: boolean
  uniteEntretien: Unite
  uniteRemplacement: Unite
  baseQuantite: BaseQuantite
  indicationQuantite: string | null
  coefficient: number
  noteDiagnostiqueur: string | null
  actif: boolean
  ligneOrigine: string | null
  etats: { etat: EtatArticle; travaux: string | null; prix: number | null; partPrixMauvais: number | null; unite: Unite }[]
  etapes: { etapeNumero: number; ordreDansEtape: number }[]
}

/** Les en-têtes de l'onglet « Articles », dans l'ordre du classeur d'origine. */
export const ENTETES_ARTICLES = [
  'ID', 'Code CFC', 'Libellé CFC', 'Groupe CFC', 'Article', 'Domaine (rapport)',
  'Groupe d’alternatives', 'Échafaudage', 'Unité entretien', 'Unité remplacement',
  'Base de quantité', 'Coefficient',
  'Très bon état – travaux', 'Très bon état – prix',
  'Bon état – travaux', 'Bon état – prix',
  'État moyen – travaux', 'État moyen – prix fixe', 'État moyen – part du prix Mauvais', 'État moyen – prix total',
  'Mauvais état – travaux', 'Mauvais état – prix',
  'Amélioration – travaux', 'Amélioration – prix', 'Amélioration – unité',
  'Mise aux normes – travaux', 'Mise aux normes – prix', 'Mise aux normes – unité',
  'Note diagnostiqueur', 'Statut', 'Ligne d’origine', 'Étapes de visite',
] as const

export const ENTETES_VISITE = [
  'N° étape', 'Étape de visite', 'Zone', 'Ordre dans l’étape', 'ID', 'Article', 'Code CFC',
] as const

export const ENTETES_POSTES = [
  'Code CFC', 'Poste', 'Déclencheur', 'Unité', 'Prix CHF HT', 'Quantité', 'Remarque',
] as const

export const ENTETES_NOMENCLATURE = [
  'Code CFC', 'Libellé', 'Niveau', 'Code parent', 'Articles Diagly',
] as const

/** L'unité, écrite comme le classeur l'écrit. */
export function uniteDuClasseur(u: Unite): string {
  return u === 'm2' ? 'm²' : u
}

/** Le libellé de chaque base, dans la forme que l'import sait relire. */
const LIBELLE_DE_LA_BASE: Record<BaseQuantite, string> = {
  surface_plancher: 'Surface de plancher (SP)',
  surface_batie: 'Surface bâtie',
  surface_terrain: 'Surface de terrain',
  surface_facade: 'Surface de façade',
  surface_fenetres: 'Surface de fenêtres',
  facade_moins_fenetres: 'Surface de façade - surface de fenêtres',
  nombre_logements: 'Nombre de logements',
  nombre_pieces_eau: "Nombre de pièces d'eau",
  nombre_etages: "Nombre d'étages",
  nombre_cages: "Nombre de cages d'escalier",
  nombre_portes_entree: "Nombre de portes d'entrée",
  forfait: 'Forfait',
  saisie_manuelle: 'Saisie manuelle',
  // Les trois règles portent leur phrase : c'est elle, et pas un mot-clé, que
  // l'import reconnaît, et c'est elle que le bureau relit dans Excel.
  regle_stores: 'Logements : 1 pce par logement de 2,5 à 3,5 pièces, 2 pce au-delà',
  regle_eaux_pluviales: 'Règle EP : hauteur × nombre de descentes selon la surface bâtie',
  regle_sprinklers: 'Surface bâtie, ou surface de parking si elle est saisie',
}

/**
 * La case « Base de quantité », telle qu'elle doit se relire.
 *
 * Les trois règles nommées gardent la phrase du classeur, qui a été conservée
 * à l'import : la réécrire de mémoire ferait dériver le texte d'un aller-retour
 * à l'autre. Les autres bases reprennent leur libellé, et leur indication entre
 * parenthèses, puisque c'est de là que l'import la tire.
 */
export function texteDeLaBase(base: BaseQuantite, indication: string | null): string {
  const regle = base === 'regle_stores' || base === 'regle_eaux_pluviales' || base === 'regle_sprinklers'
  if (regle) return indication ?? LIBELLE_DE_LA_BASE[base]
  const libelle = LIBELLE_DE_LA_BASE[base]
  return indication ? `${libelle} (${indication})` : libelle
}

const texteOuVide = (v: string | null) => v ?? ''
const nombreOuVide = (v: number | null) => (v === null ? '' : v)

/** Une ligne de l'onglet « Articles ». */
export function ligneArticle(
  a: ArticleAExporter,
  contexte: {
    libelleCfc?: string | null
    groupeCfc?: string | null
    nomDeLEtape?: (numero: number) => string
  } = {},
): Record<string, string | number> {
  const etat = (e: EtatArticle) => a.etats.find((x) => x.etat === e)
  const moyen = etat('moyen')
  const mauvais = etat('mauvais')
  const prixTotalMoyen = moyen
    ? prixUnitaire('moyen', { prix: moyen.prix, partPrixMauvais: moyen.partPrixMauvais }, { prixMauvais: mauvais?.prix ?? null })
    : null

  return {
    'ID': a.id,
    'Code CFC': a.cfcCode,
    'Libellé CFC': texteOuVide(contexte.libelleCfc ?? null),
    'Groupe CFC': texteOuVide(contexte.groupeCfc ?? null),
    'Article': a.nom,
    'Domaine (rapport)': a.domaineRapport,
    'Groupe d’alternatives': texteOuVide(a.groupeAlternatives),
    'Échafaudage': a.echafaudage ? 'Oui' : 'Non',
    'Unité entretien': uniteDuClasseur(a.uniteEntretien),
    'Unité remplacement': uniteDuClasseur(a.uniteRemplacement),
    'Base de quantité': texteDeLaBase(a.baseQuantite, a.indicationQuantite),
    'Coefficient': a.coefficient,
    'Très bon état – travaux': texteOuVide(etat('tres_bon')?.travaux ?? null),
    'Très bon état – prix': nombreOuVide(etat('tres_bon')?.prix ?? null),
    'Bon état – travaux': texteOuVide(etat('bon')?.travaux ?? null),
    'Bon état – prix': nombreOuVide(etat('bon')?.prix ?? null),
    'État moyen – travaux': texteOuVide(moyen?.travaux ?? null),
    'État moyen – prix fixe': nombreOuVide(moyen?.prix ?? null),
    'État moyen – part du prix Mauvais': nombreOuVide(moyen?.partPrixMauvais ?? null),
    'État moyen – prix total': nombreOuVide(prixTotalMoyen),
    'Mauvais état – travaux': texteOuVide(mauvais?.travaux ?? null),
    'Mauvais état – prix': nombreOuVide(mauvais?.prix ?? null),
    'Amélioration – travaux': texteOuVide(etat('amelioration')?.travaux ?? null),
    'Amélioration – prix': nombreOuVide(etat('amelioration')?.prix ?? null),
    'Amélioration – unité': uniteDuClasseur(etat('amelioration')?.unite ?? a.uniteRemplacement),
    'Mise aux normes – travaux': texteOuVide(etat('normes')?.travaux ?? null),
    'Mise aux normes – prix': nombreOuVide(etat('normes')?.prix ?? null),
    'Mise aux normes – unité': uniteDuClasseur(etat('normes')?.unite ?? a.uniteRemplacement),
    'Note diagnostiqueur': texteOuVide(a.noteDiagnostiqueur),
    'Statut': a.actif ? 'Actif' : 'Retiré',
    'Ligne d’origine': texteOuVide(a.ligneOrigine),
    'Étapes de visite': a.etapes
      .map((e) => contexte.nomDeLEtape?.(e.etapeNumero) ?? String(e.etapeNumero))
      .join(', '),
  }
}

/** Les lignes de l'onglet « Ordre de visite », étape par étape puis par rang. */
export function lignesDeVisite(
  articles: ArticleAExporter[],
  etapes: { numero: number; nom: string; zone: string }[],
): Record<string, string | number>[] {
  const parNumero = new Map(etapes.map((e) => [e.numero, e]))
  const lignes: { numero: number; ordre: number; ligne: Record<string, string | number> }[] = []

  for (const a of articles) {
    for (const lien of a.etapes) {
      const etape = parNumero.get(lien.etapeNumero)
      lignes.push({
        numero: lien.etapeNumero,
        ordre: lien.ordreDansEtape,
        ligne: {
          'N° étape': lien.etapeNumero,
          'Étape de visite': etape?.nom ?? '',
          'Zone': etape?.zone ?? '',
          'Ordre dans l’étape': lien.ordreDansEtape,
          'ID': a.id,
          'Article': a.nom,
          'Code CFC': a.cfcCode,
        },
      })
    }
  }

  return lignes
    .sort((x, y) => x.numero - y.numero || x.ordre - y.ordre)
    .map((x) => x.ligne)
}

/** Les phrases de déclenchement et de quantité, telles que l'import les relit. */
const DECLENCHEUR_EN_TEXTE: Record<string, string> = {
  toujours: 'Toujours',
  echafaudage_facade: 'Au moins un article « Échafaudage = Oui » avec des travaux chiffrés',
  communs_mauvais: 'Un article murs ou plafonds des parties communes en état Mauvais (code 4)',
}

const QUANTITE_EN_TEXTE: Record<string, string> = {
  surface_echafaudee: 'Surface à échafauder',
  par_cage_escalier: "1 par cage d'escalier",
  surface_plancher: 'Surface de plancher (SP)',
  forfait: '1',
}

export function lignePoste(p: {
  cfcCode: string
  libelle: string
  declencheur: string
  unite: Unite
  prix: number
  regleQuantite: string
  remarque: string | null
}): Record<string, string | number> {
  return {
    'Code CFC': p.cfcCode,
    'Poste': p.libelle,
    'Déclencheur': DECLENCHEUR_EN_TEXTE[p.declencheur] ?? p.declencheur,
    'Unité': uniteDuClasseur(p.unite),
    'Prix CHF HT': p.prix,
    'Quantité': QUANTITE_EN_TEXTE[p.regleQuantite] ?? p.regleQuantite,
    'Remarque': texteOuVide(p.remarque),
  }
}

export function ligneNomenclature(
  n: { code: string; libelle: string; niveau: number; parentCode: string | null },
  articles: number,
): Record<string, string | number> {
  return {
    'Code CFC': n.code,
    'Libellé': n.libelle,
    'Niveau': n.niveau,
    'Code parent': texteOuVide(n.parentCode),
    'Articles Diagly': articles,
  }
}
