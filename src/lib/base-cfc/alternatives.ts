/**
 * Les groupes d'alternatives : plusieurs types d'ouvrage sur une même surface.
 *
 * Une façade est rarement d'un seul type. La moitié peut être crépie et
 * l'autre ventilée, et jusqu'ici chacun des sept types de façade recevait la
 * surface entière : le devis comptait la façade sept fois. C'est le défaut que
 * ce module corrige.
 *
 * Deux choses à retenir :
 *
 * Les parts se comptent PAR ÉTAPE. Les revêtements de sol de la cage
 * d'escalier totalisent cent pour cent, ceux des appartements aussi, et les
 * deux ne se mélangent pas : ce sont deux surfaces différentes.
 *
 * Les portes extérieures ne se partagent pas en pourcentage mais en nombre.
 * On ne dit pas « trente pour cent de portes vitrées », on dit « trois portes
 * vitrées sur dix ».
 */

/** Le groupe des portes se compte en nombre, pas en pourcentage. */
export const GROUPE_EN_NOMBRE = 'Portes extérieures (en nombre)'

export interface MembreDuGroupe {
  articleId: string
  nom: string
  /** Coché = ce type est présent dans le bâtiment. */
  present: boolean
  /** Part de la quantité du groupe, en pourcent. Ou nombre d'unités pour les portes. */
  part: number | null
}

export interface Groupe {
  nom: string
  etapeNumero: number
  /** Quantité à partager entre les types présents. */
  quantiteDuGroupe: number | null
  membres: MembreDuGroupe[]
}

export type RaisonInvalide =
  | 'aucun_present'
  | 'part_manquante'
  | 'somme_differente'

export interface EtatDuGroupe {
  nom: string
  etapeNumero: number
  valide: boolean
  raison: RaisonInvalide | null
  /** Somme des parts renseignées : cent attendu, ou le nombre total de portes. */
  somme: number
  attendu: number
  message: string | null
}

const arrondi = (v: number) => Math.round(v * 100) / 100

/** Un groupe compté en nombre d'unités plutôt qu'en pourcentage. */
export function compteEnNombre(nomDuGroupe: string): boolean {
  return nomDuGroupe === GROUPE_EN_NOMBRE
}

/**
 * Ce qu'il manque à un groupe pour être exploitable.
 *
 * Un seul type présent reçoit tout, sans qu'on ait à écrire cent : exiger la
 * saisie dans ce cas ne servirait qu'à faire perdre du temps sur le terrain.
 */
export function etatDuGroupe(groupe: Groupe, totalAttendu?: number): EtatDuGroupe {
  const enNombre = compteEnNombre(groupe.nom)
  const attendu = enNombre ? (totalAttendu ?? groupe.quantiteDuGroupe ?? 0) : 100
  const presents = groupe.membres.filter((m) => m.present)
  const base = { nom: groupe.nom, etapeNumero: groupe.etapeNumero, attendu }

  if (presents.length === 0) {
    return {
      ...base, valide: false, raison: 'aucun_present', somme: 0,
      message: `${groupe.nom} : aucun type coché, l'ouvrage ne sera ni relevé ni chiffré.`,
    }
  }

  if (presents.length === 1 && !enNombre) {
    return { ...base, valide: true, raison: null, somme: 100, message: null }
  }

  const sansPart = presents.filter((m) => m.part === null)
  const somme = arrondi(presents.reduce((s, m) => s + (m.part ?? 0), 0))
  if (sansPart.length > 0) {
    return {
      ...base, valide: false, raison: 'part_manquante', somme,
      message: enNombre
        ? `${groupe.nom} : il manque le nombre pour ${sansPart.map((m) => m.nom).join(', ')}.`
        : `${groupe.nom} : il manque la part pour ${sansPart.map((m) => m.nom).join(', ')}.`,
    }
  }

  if (Math.abs(somme - attendu) > 0.01) {
    return {
      ...base, valide: false, raison: 'somme_differente', somme,
      message: enNombre
        ? `${groupe.nom} : ${somme} portes réparties pour ${attendu} portes d'entrée.`
        : `${groupe.nom} : les parts totalisent ${somme} % au lieu de 100 %.`,
    }
  }

  return { ...base, valide: true, raison: null, somme, message: null }
}

/**
 * La quantité qui revient à chaque type présent.
 *
 * Les types non cochés ne figurent pas dans le résultat : ils n'apparaîtront
 * ni au rapport ni au devis, ce qui est la raison d'être des groupes.
 */
export function quantitesDuGroupe(groupe: Groupe, totalAttendu?: number): Map<string, number | null> {
  const parArticle = new Map<string, number | null>()
  const enNombre = compteEnNombre(groupe.nom)
  const presents = groupe.membres.filter((m) => m.present)

  for (const m of presents) {
    if (enNombre) {
      // Le nombre saisi EST la quantité : trois portes vitrées font trois pièces.
      parArticle.set(m.articleId, m.part)
      continue
    }
    if (presents.length === 1) {
      parArticle.set(m.articleId, groupe.quantiteDuGroupe)
      continue
    }
    if (m.part === null || groupe.quantiteDuGroupe === null) {
      parArticle.set(m.articleId, null)
      continue
    }
    parArticle.set(m.articleId, arrondi(groupe.quantiteDuGroupe * (m.part / 100)))
  }
  void totalAttendu
  return parArticle
}

/**
 * Ce qui empêche d'éditer le rapport.
 *
 * Un groupe mal réparti fausse le devis sans rien afficher d'anormal : c'est
 * exactement le genre d'erreur qui se découvre chez le client. Elle est donc
 * bloquante, et nommée groupe par groupe et étape par étape.
 */
export function groupesIncomplets(groupes: Groupe[], totauxAttendus?: Map<string, number>): EtatDuGroupe[] {
  return groupes
    .map((g) => etatDuGroupe(g, totauxAttendus?.get(g.nom)))
    .filter((e) => !e.valide)
}

/**
 * Rassemble les relevés en groupes, un par couple (groupe, étape).
 *
 * C'est ici que se joue le « par étape » : deux relevés du même groupe dans
 * deux étapes différentes forment deux groupes distincts, chacun avec ses
 * cent pour cent.
 */
export function groupesDesReleves(
  releves: {
    articleId: string
    nom: string
    etapeNumero: number
    groupeAlternatives: string | null
    present: boolean
    part: number | null
  }[],
  quantiteParGroupe: (nom: string, etapeNumero: number) => number | null,
): Groupe[] {
  const par = new Map<string, Groupe>()
  for (const r of releves) {
    if (!r.groupeAlternatives) continue
    const cle = `${r.groupeAlternatives}@@${r.etapeNumero}`
    if (!par.has(cle)) {
      par.set(cle, {
        nom: r.groupeAlternatives,
        etapeNumero: r.etapeNumero,
        quantiteDuGroupe: quantiteParGroupe(r.groupeAlternatives, r.etapeNumero),
        membres: [],
      })
    }
    par.get(cle)!.membres.push({ articleId: r.articleId, nom: r.nom, present: r.present, part: r.part })
  }
  return [...par.values()].sort((a, b) => a.etapeNumero - b.etapeNumero || a.nom.localeCompare(b.nom))
}
