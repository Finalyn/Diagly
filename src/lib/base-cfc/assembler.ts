/**
 * Des lignes du classeur aux enregistrements de la base.
 *
 * Le classeur est large et répétitif : six états, chacun avec son texte, son
 * prix et son unité, répartis sur une vingtaine de colonnes. Assembler ici
 * plutôt que dans le script d'import permet de le vérifier sans Excel, et de
 * dire précisément quelle ligne et quelle colonne refusent de se lire.
 */

import {
  ErreurBase, aucunTravail, normaliserBase, normaliserCode, normaliserOuiNon,
  normaliserPart, normaliserPrix, normaliserTexte, normaliserUnite,
  type BaseQuantite, type EtatArticle, type Unite,
} from './normaliser'

/** Une ligne de classeur, telle que la lit n'importe quelle bibliothèque. */
export type Ligne = Record<string, unknown>

export interface EtatBase {
  etat: EtatArticle
  travaux: string | null
  prix: number | null
  partPrixMauvais: number | null
  unite: Unite
}

export interface ArticleBase {
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
  ligneOrigine: string | null
  etats: EtatBase[]
}

export interface EtapeBase { numero: number; nom: string; zone: string }
export interface LienEtape { articleId: string; etapeNumero: number; ordreDansEtape: number }
export interface NoeudCfc { code: string; libelle: string; niveau: number; parentCode: string | null }
export interface PosteBase {
  cfcCode: string
  libelle: string
  declencheur: 'toujours' | 'echafaudage_facade' | 'communs_mauvais'
  unite: Unite
  prix: number
  regleQuantite: 'surface_echafaudee' | 'par_cage_escalier' | 'surface_plancher' | 'forfait'
  remarque: string | null
}

/**
 * Les six états et leurs colonnes.
 *
 * L'unité suit l'état : l'entretien (très bon, bon, moyen) se compte dans une
 * unité, le remplacement dans une autre, et l'amélioration comme les normes
 * ont la leur. Un m² d'entretien et une pièce de remplacement ne se somment
 * pas, c'est pour cela que chaque état porte la sienne.
 */
const COLONNES: { etat: EtatArticle; travaux: string; prix: string; unite: 'entretien' | 'remplacement' | string }[] = [
  { etat: 'tres_bon', travaux: 'Très bon état – travaux', prix: 'Très bon état – prix', unite: 'entretien' },
  { etat: 'bon', travaux: 'Bon état – travaux', prix: 'Bon état – prix', unite: 'entretien' },
  { etat: 'moyen', travaux: 'État moyen – travaux', prix: 'État moyen – prix fixe', unite: 'entretien' },
  { etat: 'mauvais', travaux: 'Mauvais état – travaux', prix: 'Mauvais état – prix', unite: 'remplacement' },
  { etat: 'amelioration', travaux: 'Amélioration – travaux', prix: 'Amélioration – prix', unite: 'Amélioration – unité' },
  { etat: 'normes', travaux: 'Mise aux normes – travaux', prix: 'Mise aux normes – prix', unite: 'Mise aux normes – unité' },
]

/** Lit une cellule en acceptant que la colonne ait été renommée à l'accent près. */
function cellule(ligne: Ligne, nom: string): unknown {
  if (nom in ligne) return ligne[nom]
  const attendu = nom.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '')
  for (const [k, v] of Object.entries(ligne)) {
    if (k.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '') === attendu) return v
  }
  return undefined
}

export function assemblerArticle(ligne: Ligne): ArticleBase {
  const id = normaliserTexte(cellule(ligne, 'ID'))
  if (!id) throw new ErreurBase('ID', cellule(ligne, 'ID'), 'identifiant manquant')
  const nom = normaliserTexte(cellule(ligne, 'Article'))
  if (!nom) throw new ErreurBase('Article', id, 'nom manquant')
  const domaineRapport = normaliserTexte(cellule(ligne, 'Domaine (rapport)'))
  if (!domaineRapport) throw new ErreurBase('Domaine (rapport)', id, 'domaine manquant')

  const entretien = normaliserUnite(cellule(ligne, 'Unité entretien'), `${id} / Unité entretien`)
  const remplacement = normaliserUnite(cellule(ligne, 'Unité remplacement'), `${id} / Unité remplacement`)
  const base = normaliserBase(cellule(ligne, 'Base de quantité'), `${id} / Base de quantité`)

  const coefficientBrut = cellule(ligne, 'Coefficient')
  const coefficient = coefficientBrut === null || coefficientBrut === undefined || coefficientBrut === ''
    ? 1
    : Number(String(coefficientBrut).replace(',', '.'))
  if (!Number.isFinite(coefficient) || coefficient <= 0) {
    throw new ErreurBase(`${id} / Coefficient`, coefficientBrut, 'coefficient illisible ou nul')
  }

  const etats: EtatBase[] = COLONNES.map(({ etat, travaux, prix, unite }) => {
    const texte = normaliserTexte(cellule(ligne, travaux))
    const uniteEtat = unite === 'entretien'
      ? entretien.unite
      : unite === 'remplacement'
        ? remplacement.unite
        : normaliserUnite(cellule(ligne, unite), `${id} / ${unite}`).unite
    return {
      etat,
      travaux: texte,
      prix: normaliserPrix(cellule(ligne, prix), `${id} / ${prix}`),
      partPrixMauvais: etat === 'moyen'
        ? normaliserPart(cellule(ligne, 'État moyen – part du prix Mauvais'), `${id} / part du prix Mauvais`)
        : null,
      unite: uniteEtat,
    }
  })

  return {
    id,
    cfcCode: normaliserCode(cellule(ligne, 'Code CFC'), `${id} / Code CFC`),
    nom,
    domaineRapport,
    groupeAlternatives: normaliserTexte(cellule(ligne, 'Groupe d’alternatives')),
    echafaudage: normaliserOuiNon(cellule(ligne, 'Échafaudage'), `${id} / Échafaudage`),
    uniteEntretien: entretien.unite,
    uniteRemplacement: remplacement.unite,
    baseQuantite: base.base,
    // L'indication de la base l'emporte sur celle de l'unité : elle est plus
    // précise (« portes par logement × logements ») là où l'unité ne dit que
    // « par logement ».
    indicationQuantite: base.indication ?? entretien.indication ?? remplacement.indication,
    coefficient,
    noteDiagnostiqueur: normaliserTexte(cellule(ligne, 'Note diagnostiqueur')),
    ligneOrigine: normaliserTexte(cellule(ligne, 'Ligne d’origine')),
    etats,
  }
}

export function assemblerEtapes(lignes: Ligne[]): { etapes: EtapeBase[]; liens: LienEtape[] } {
  const etapes = new Map<number, EtapeBase>()
  const liens: LienEtape[] = []
  for (const l of lignes) {
    const numero = Number(cellule(l, 'N° étape'))
    const nom = normaliserTexte(cellule(l, 'Étape de visite'))
    const zone = normaliserTexte(cellule(l, 'Zone'))
    const articleId = normaliserTexte(cellule(l, 'ID'))
    const ordre = Number(cellule(l, 'Ordre dans l’étape'))
    if (!Number.isInteger(numero) || numero < 1) throw new ErreurBase('N° étape', cellule(l, 'N° étape'), 'numéro d’étape illisible')
    if (!nom || !zone) throw new ErreurBase(`Étape ${numero}`, nom, 'nom ou zone manquant')
    if (!articleId) throw new ErreurBase(`Étape ${numero}`, cellule(l, 'ID'), 'identifiant d’article manquant')
    if (!Number.isInteger(ordre) || ordre < 1) throw new ErreurBase(`Étape ${numero} / ${articleId}`, cellule(l, 'Ordre dans l’étape'), 'ordre illisible')

    const connue = etapes.get(numero)
    if (connue && (connue.nom !== nom || connue.zone !== zone)) {
      throw new ErreurBase(`Étape ${numero}`, nom, `l’étape change de nom ou de zone d’une ligne à l’autre (déjà vue : ${connue.nom} / ${connue.zone})`)
    }
    if (!connue) etapes.set(numero, { numero, nom, zone })
    liens.push({ articleId, etapeNumero: numero, ordreDansEtape: ordre })
  }
  return { etapes: [...etapes.values()].sort((a, b) => a.numero - b.numero), liens }
}

export function assemblerNomenclature(lignes: Ligne[]): NoeudCfc[] {
  return lignes.map((l) => {
    const code = normaliserCode(cellule(l, 'Code CFC'), 'Nomenclature / Code CFC')
    const libelle = normaliserTexte(cellule(l, 'Libellé'))
    const niveau = Number(cellule(l, 'Niveau'))
    if (!libelle) throw new ErreurBase(`Nomenclature ${code}`, libelle, 'libellé manquant')
    if (!Number.isInteger(niveau) || niveau < 1 || niveau > 4) {
      throw new ErreurBase(`Nomenclature ${code}`, cellule(l, 'Niveau'), 'niveau attendu entre 1 et 4')
    }
    const parent = normaliserTexte(cellule(l, 'Code parent'))
    return { code, libelle, niveau, parentCode: parent }
  })
}

const DECLENCHEURS: { motif: RegExp; valeur: PosteBase['declencheur'] }[] = [
  { motif: /toujours/i, valeur: 'toujours' },
  { motif: /echafaudage\s*=\s*oui|échafaudage\s*=\s*oui/i, valeur: 'echafaudage_facade' },
  { motif: /mauvais/i, valeur: 'communs_mauvais' },
]

const REGLES: { motif: RegExp; valeur: PosteBase['regleQuantite'] }[] = [
  { motif: /échafauder|echafauder/i, valeur: 'surface_echafaudee' },
  { motif: /cage/i, valeur: 'par_cage_escalier' },
  { motif: /plancher|sp\b/i, valeur: 'surface_plancher' },
  { motif: /^1$|forfait/i, valeur: 'forfait' },
]

export function assemblerPostes(lignes: Ligne[]): PosteBase[] {
  return lignes.map((l) => {
    const cfcCode = normaliserCode(cellule(l, 'Code CFC'), 'Poste / Code CFC')
    const libelle = normaliserTexte(cellule(l, 'Poste'))
    const declencheurTexte = String(cellule(l, 'Déclencheur') ?? '')
    const quantiteTexte = String(cellule(l, 'Quantité') ?? '')
    const prix = normaliserPrix(cellule(l, 'Prix CHF HT'), `Poste ${cfcCode} / prix`)
    if (!libelle) throw new ErreurBase(`Poste ${cfcCode}`, libelle, 'libellé manquant')
    if (prix === null) throw new ErreurBase(`Poste ${cfcCode}`, null, 'un poste automatique doit avoir un prix')
    const declencheur = DECLENCHEURS.find((d) => d.motif.test(declencheurTexte))?.valeur
    const regleQuantite = REGLES.find((r) => r.motif.test(quantiteTexte))?.valeur
    if (!declencheur) throw new ErreurBase(`Poste ${cfcCode} / déclencheur`, declencheurTexte, 'déclencheur non reconnu')
    if (!regleQuantite) throw new ErreurBase(`Poste ${cfcCode} / quantité`, quantiteTexte, 'règle de quantité non reconnue')
    return {
      cfcCode, libelle, declencheur, unite: normaliserUnite(cellule(l, 'Unité'), `Poste ${cfcCode} / unité`).unite,
      prix, regleQuantite, remarque: normaliserTexte(cellule(l, 'Remarque')),
    }
  })
}

// ------------------------------------------------------------- les contrôles

export type GraviteAnomalie = 'bloquante' | 'avertissement'

export interface Anomalie {
  gravite: GraviteAnomalie
  code: 'cfc_inconnu' | 'sans_etape' | 'neant_avec_prix' | 'travaux_sans_prix' | 'lien_inconnu' | 'etape_orpheline'
  articleId: string | null
  message: string
}

/**
 * Ce qui cloche dans la base, séparé en deux.
 *
 * Bloquant : l'import écrirait une donnée incohérente, il doit s'arrêter.
 * Avertissement : la donnée est écrivable mais douteuse, la fiche l'affiche et
 * la liste permet de filtrer dessus. Un prix d'amélioration manquant est le cas
 * courant, trente-six articles sont dans ce cas et c'est voulu.
 */
export function controler(base: {
  articles: ArticleBase[]
  nomenclature: NoeudCfc[]
  liens: LienEtape[]
  etapes: EtapeBase[]
}): Anomalie[] {
  const anomalies: Anomalie[] = []
  const codes = new Set(base.nomenclature.map((n) => n.code))
  const ids = new Set(base.articles.map((a) => a.id))
  const numeros = new Set(base.etapes.map((e) => e.numero))
  const avecEtape = new Set(base.liens.map((l) => l.articleId))

  for (const a of base.articles) {
    if (!codes.has(a.cfcCode)) {
      anomalies.push({ gravite: 'bloquante', code: 'cfc_inconnu', articleId: a.id, message: `code CFC ${a.cfcCode} absent de la nomenclature` })
    }
    if (!avecEtape.has(a.id)) {
      anomalies.push({ gravite: 'bloquante', code: 'sans_etape', articleId: a.id, message: 'aucune étape de visite' })
    }
    for (const e of a.etats) {
      if (aucunTravail(e.travaux) && e.prix !== null && e.prix > 0) {
        anomalies.push({ gravite: 'avertissement', code: 'neant_avec_prix', articleId: a.id, message: `état ${e.etat} : « Néant » mais un prix de ${e.prix}` })
      }
      if (e.travaux && !aucunTravail(e.travaux) && e.prix === null) {
        anomalies.push({ gravite: 'avertissement', code: 'travaux_sans_prix', articleId: a.id, message: `état ${e.etat} : travaux décrits sans prix` })
      }
    }
  }

  for (const l of base.liens) {
    if (!ids.has(l.articleId)) {
      anomalies.push({ gravite: 'bloquante', code: 'lien_inconnu', articleId: l.articleId, message: `l’ordre de visite cite un article absent de la feuille Articles` })
    }
    if (!numeros.has(l.etapeNumero)) {
      anomalies.push({ gravite: 'bloquante', code: 'etape_orpheline', articleId: l.articleId, message: `étape ${l.etapeNumero} inconnue` })
    }
  }
  return anomalies
}
